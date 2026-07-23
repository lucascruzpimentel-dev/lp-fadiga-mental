# mcp-wavespeed

Servidor [MCP](https://modelcontextprotocol.io) (stdio) que expõe a tool **`wavespeed_generate_image`**, chamando a API REST do [WaveSpeed AI](https://wavespeed.ai/).

## Pré-requisitos

- Node.js 18+
- Chave de API WaveSpeed: [API Keys](https://wavespeed.ai/accesskey) (com saldo/top-up ativo)

## Instalação

```bash
cd mcp-wavespeed
npm install
npm run build
```

O ponto de entrada compilado é `dist/index.js`.

## Variável de ambiente

| Variável            | Obrigatória | Descrição        |
|---------------------|------------|------------------|
| `WAVESPEED_API_KEY` | Sim        | Bearer token API |

## Configuração no Cursor

Em **Cursor Settings → MCP** (ou no arquivo de configuração MCP do seu ambiente), registre o servidor apontando para o `dist/index.js` **com caminho absoluto** e passe a chave em `env`:

```json
{
  "mcpServers": {
    "wavespeed": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/para/mcp-wavespeed/dist/index.js"],
      "env": {
        "WAVESPEED_API_KEY": "sua_chave_aqui"
      }
    }
  }
}
```

Substitua `/CAMINHO/ABSOLUTO/para/` pelo diretório real deste repositório (por exemplo, dentro de `LP CURSOS ATLETA CAMPEÃO/mcp-wavespeed`).

Reinicie o Cursor ou recarregue os servidores MCP após alterar a configuração.

## Tool: `wavespeed_generate_image`

- **`prompt`** (obrigatório): texto da cena ou estilo desejado.
- **`model`** (opcional): path do modelo na API v3 (padrão `wavespeed-ai/flux-dev`). Outros modelos: [documentação de modelos](https://wavespeed.ai/docs/models).
- **`width` / `height` / `size` / `num_images` / `seed` / `guidance_scale` / `num_inference_steps`**: opcionais, repassados ao corpo JSON do POST quando informados (compatibilidade depende do modelo).
- **`poll_interval_ms`**: intervalo entre consultas ao resultado (padrão `1000`).
- **`timeout_ms`**: tempo máximo de espera (padrão `300000`, 5 minutos).

A resposta da tool lista `task_id`, `model` e URLs em `outputs` quando a geração conclui com sucesso.

## Documentação WaveSpeed

- [Get Started with API](https://wavespeed.ai/docs/get-started-api)
- [How to Generate an Image](https://wavespeed.ai/docs/generate-image)

## Desenvolvimento

```bash
npm run build && npm start
```

Em modo stdio o processo fica aguardando o cliente MCP; Para testes manuais use um cliente MCP ou o próprio Cursor.
