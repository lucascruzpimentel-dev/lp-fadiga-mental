#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateImage } from "./wavespeed.js";

const DEFAULT_MODEL = "wavespeed-ai/flux-dev";

function buildRequestBody(args: {
  prompt: string;
  width?: number;
  height?: number;
  size?: string;
  num_images?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: args.prompt };
  if (args.width !== undefined) body.width = args.width;
  if (args.height !== undefined) body.height = args.height;
  if (args.size !== undefined && args.size.length > 0) body.size = args.size;
  if (args.num_images !== undefined) body.num_images = args.num_images;
  if (args.seed !== undefined) body.seed = args.seed;
  if (args.guidance_scale !== undefined) body.guidance_scale = args.guidance_scale;
  if (args.num_inference_steps !== undefined)
    body.num_inference_steps = args.num_inference_steps;
  return body;
}

async function main() {
  const apiKey = process.env.WAVESPEED_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "mcp-wavespeed: defina WAVESPEED_API_KEY no ambiente (ex.: mcp.json env)."
    );
    process.exit(1);
  }

  const server = new McpServer(
    { name: "mcp-wavespeed", version: "1.0.0" },
    { capabilities: {} }
  );

  server.registerTool(
    "wavespeed_generate_image",
    {
      description:
        "Gera imagem(ns) via WaveSpeed AI (https://wavespeed.ai/). Retorna URLs públicas em outputs. Use o modelo no path da API (ex.: wavespeed-ai/flux-dev, google/nano-banana-2/text-to-image).",
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe("Descrição em texto da imagem a gerar."),
        model: z
          .string()
          .optional()
          .describe(
            `Identificador do modelo no path da API v3. Padrão: ${DEFAULT_MODEL}.`
          ),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        size: z
          .string()
          .optional()
          .describe('Alternativa a width/height, ex.: "1024*1024".'),
        num_images: z.number().int().min(1).max(10).optional(),
        seed: z.number().int().optional(),
        guidance_scale: z.number().optional(),
        num_inference_steps: z.number().int().optional(),
        poll_interval_ms: z
          .number()
          .int()
          .min(500)
          .max(30_000)
          .optional()
          .describe("Intervalo entre polls (ms). Padrão: 1000."),
        timeout_ms: z
          .number()
          .int()
          .min(10_000)
          .max(600_000)
          .optional()
          .describe("Tempo máximo de espera (ms). Padrão: 300000 (5 min)."),
      },
    },
    async (args, extra) => {
      const {
        poll_interval_ms,
        timeout_ms,
        model: modelArg,
        ...bodyArgs
      } = args;
      const model = (modelArg?.trim() || DEFAULT_MODEL).replace(/^\//, "");
      const intervalMs = poll_interval_ms ?? 1000;
      const timeoutMs = timeout_ms ?? 300_000;
      const body = buildRequestBody(bodyArgs);

      try {
        const result = await generateImage(apiKey, model, body, {
          intervalMs,
          timeoutMs,
          signal: extra.signal,
        });

        const outputs = result.outputs ?? [];
        const text = [
          `status: ${result.status}`,
          `task_id: ${result.id}`,
          `model: ${model}`,
          outputs.length
            ? `outputs:\n${outputs.map((u) => `- ${u}`).join("\n")}`
            : "outputs: (vazio)",
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("mcp-wavespeed:", error);
  process.exit(1);
});
