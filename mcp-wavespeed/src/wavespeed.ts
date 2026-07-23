const BASE = "https://api.wavespeed.ai/api/v3";

export type SubmitData = {
  id: string;
  status: string;
  urls?: { get?: string };
  error?: string;
};

export type ResultData = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  outputs?: string[];
  error?: string;
};

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

function assertOk<T>(body: ApiEnvelope<T>, context: string): T {
  if (body.code !== 200) {
    throw new Error(
      `${context}: ${body.message ?? "unknown"} (code ${body.code})`
    );
  }
  return body.data;
}

export type GenerateBody = Record<string, unknown>;

export async function submitTask(
  apiKey: string,
  modelPath: string,
  body: GenerateBody
): Promise<SubmitData> {
  const url = `${BASE}/${modelPath.replace(/^\//, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiEnvelope<SubmitData>;
  if (!res.ok) {
    throw new Error(
      `WaveSpeed submit HTTP ${res.status}: ${JSON.stringify(json)}`
    );
  }
  return assertOk(json, "submit");
}

export async function getResult(
  apiKey: string,
  taskId: string
): Promise<ResultData> {
  const url = `${BASE}/predictions/${taskId}/result`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = (await res.json()) as ApiEnvelope<ResultData>;
  if (!res.ok) {
    throw new Error(
      `WaveSpeed result HTTP ${res.status}: ${JSON.stringify(json)}`
    );
  }
  return assertOk(json, "result");
}

export async function pollUntilComplete(
  apiKey: string,
  taskId: string,
  options: { intervalMs: number; timeoutMs: number; signal?: AbortSignal }
): Promise<ResultData> {
  const start = Date.now();
  for (;;) {
    if (options.signal?.aborted) {
      throw new Error("Geração cancelada (abort).");
    }
    if (Date.now() - start > options.timeoutMs) {
      throw new Error(
        `Timeout após ${options.timeoutMs}ms aguardando a tarefa ${taskId}.`
      );
    }
    const data = await getResult(apiKey, taskId);
    if (data.status === "completed") return data;
    if (data.status === "failed") {
      const err = data.error ?? "sem detalhes";
      throw new Error(`WaveSpeed falhou: ${err}`);
    }
    await new Promise((r) => setTimeout(r, options.intervalMs));
  }
}

export async function generateImage(
  apiKey: string,
  modelPath: string,
  body: GenerateBody,
  poll: { intervalMs: number; timeoutMs: number; signal?: AbortSignal }
): Promise<ResultData> {
  const submitted = await submitTask(apiKey, modelPath, body);
  const id = submitted.id;
  if (!id) {
    throw new Error("Resposta de submit sem task id.");
  }
  return pollUntilComplete(apiKey, id, poll);
}
