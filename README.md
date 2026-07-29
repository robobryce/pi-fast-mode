# pi-fast-mode

A small, zero-runtime-dependency provider extension for the [Pi coding agent](https://github.com/earendil-works/pi). It powers Autonomous Agent Bootstrap's fast model profiles by routing them through OpenAI's Responses API with the `priority` service tier.

The extension registers one provider stream handler:

| Provider | Custom API | Delegated API | Service tier |
| --- | --- | --- | --- |
| `aab-gateway-fast` | `aab-openai-responses-fast` | `openai-responses` | `priority` |

For every request it preserves the configured model, context, and stream options; presents the model to Pi's OpenAI Responses streamer with `api: "openai-responses"`; maps Pi's requested thinking level to `reasoningEffort` after clamping it to the model's supported levels; falls back to the model's `maxTokens` when the caller did not supply one; and forces `serviceTier: "priority"`.

This package intentionally provides only the stream handler. The provider's base URL, API key, and models remain in Pi's `models.json`; AAB generates that catalog for its fast profiles with the matching custom API name.

## Install

Pin the installation to an immutable commit:

```bash
pi install git:github.com/robobryce/pi-fast-mode@COMMIT
```

Replace `COMMIT` with a full commit SHA from this repository. Pi loads `src/index.ts` through the package's `pi.extensions` metadata.

## Configure

Reference the registered provider and custom API from `~/.pi/agent/models.json`:

```json
{
  "providers": {
    "aab-gateway-fast": {
      "name": "AAB Inference Gateway Fast",
      "baseUrl": "https://gateway.example.com/v1",
      "api": "aab-openai-responses-fast",
      "apiKey": "$AAB_INFERENCE_GATEWAY_API_KEY",
      "models": [
        {
          "id": "openai/gpt-5.6-sol",
          "name": "GPT-5.6 Sol Fast",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 16384,
          "cost": {
            "input": 0,
            "output": 0,
            "cacheRead": 0,
            "cacheWrite": 0
          }
        }
      ]
    }
  }
}
```

Set `defaultProvider` to `aab-gateway-fast` or select one of that provider's models normally. The API key shown above is an environment-variable reference resolved by Pi.

## Development

Requires Node.js 22.19 or newer.

```bash
npm ci
npm run check
```

`npm run check` runs linting, strict TypeScript checking, provider and stream-delegation tests, a package-content dry run, and a production dependency audit. The package is distributed from Git rather than npm; keep `package.json`'s version in sync with any release tag, run the full check before tagging, and keep installation examples pinned to immutable commits.
