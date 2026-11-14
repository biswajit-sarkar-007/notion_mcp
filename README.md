<div align="center">

# Notion Agent

**Chat with your Notion pages. Read, search and edit them in plain English.**

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-Notion-000000?logo=notion&logoColor=white)
![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM%20API-76B900?logo=nvidia&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## What it does

Notion Agent is a small web app that connects an LLM to your Notion workspace through the official [Notion MCP server](https://github.com/makenotion/notion-mcp-server). You type a request, the model decides which Notion tools to call, runs them, and reports back.

> "Summarize this page"
> "Add a heading called Tasks with three bullet points under it"
> "Find every page that mentions the Q4 roadmap"

It runs on NVIDIA's free hosted models, so you don't need an OpenAI key.



https://github.com/user-attachments/assets/0eae90d8-bd2c-48af-a35f-1035f991ea98




## Features

- **Real Notion access.** Reads, searches, creates and updates pages and blocks through MCP tools.
- **Agent loop.** The model can chain several tool calls before it answers (up to 8 steps per message).
- **Free models.** Uses the OpenAI-compatible NVIDIA API at `integrate.api.nvidia.com/v1`.
- **Session memory.** Keeps the last 10 messages of each chat for follow-up questions.
- **Tool trace.** Every reply shows which Notion tools were used.
- **Minimal UI.** One plain HTML page with automatic light and dark mode. No build step.

## How it works

```
Browser (HTML + JS)
      │  POST /api/chat
      ▼
Express server ──► NVIDIA API (LLM with tool calling)
      │                    │
      │◄── tool calls ─────┘
      ▼
Notion MCP server (npx @notionhq/notion-mcp-server)
      │
      ▼
Notion API
```

1. The server starts the Notion MCP server over stdio and loads its tool list.
2. Each chat message goes to the model together with those tools.
3. If the model asks for a tool, the server runs it through MCP and sends the result back.
4. This repeats until the model gives a final answer.

## Quick start

**Requirements:** Node.js 20 or newer, a Notion account, and a free NVIDIA API key.

```bash
git clone https://github.com/biswajit-sarkar-007/notion-mcp-agent.git
cd notion-mcp-agent
npm install
cp .env.example .env
```

Open `.env` and fill in your keys (see [Configuration](#configuration)), then:

```bash
npm start
```

Open **http://localhost:3000**, paste your page ID, and start chatting.

## Setup guide

### 1. Get an NVIDIA API key
Sign in at [build.nvidia.com](https://build.nvidia.com), open any model, and generate an API key. It starts with `nvapi-`.

### 2. Create a Notion integration
1. Go to [notion.so/profile/integrations](https://www.notion.so/profile/integrations).
2. Click **New integration**, choose **Internal**, and pick your workspace.
3. Enable the capabilities you need: read, update and insert content.
4. Copy the **Internal Integration Secret** into `NOTION_API_KEY`.

### 3. Connect your page
In Notion, open your page, click **⋯ → Connections**, and add your integration. The integration can only see pages you connect, plus their sub-pages.

### 4. Find your page ID
Copy the page URL. The page ID is the 32-character string at the end:

```
https://www.notion.so/My-Page-1f5b8a8ba283abcd1234567890abcdef
                               └──────────── page ID ────────────┘
```

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NVIDIA_API_KEY` | Yes | — | Your NVIDIA API key |
| `NOTION_API_KEY` | Yes | — | Notion integration secret |
| `NVIDIA_BASE_URL` | No | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible API base URL |
| `NVIDIA_MODEL` | No | `meta/llama-3.3-70b-instruct` | Model ID. Pick one that supports tool calling |
| `NOTION_VERSION` | No | `2022-06-28` | Notion API version sent by the MCP server |
| `PORT` | No | `3000` | Web server port |

## Project structure

```
notion-mcp-agent/
├── server.js          # Express server, MCP client and agent loop
├── public/
│   ├── index.html     # Chat page
│   ├── style.css      # Minimal styles
│   └── app.js         # Browser logic
├── .env.example       # Environment template
└── package.json
```

## API

| Method | Endpoint | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/session` | `{ pageId }` | Start a chat session |
| `POST` | `/api/page` | `{ sessionId, pageId }` | Change the active page |
| `POST` | `/api/chat` | `{ sessionId, message }` | Send a message, get `{ reply, trace }` |
| `POST` | `/api/reset` | `{ sessionId }` | Clear chat history |

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `object_not_found` | The page isn't connected to your integration. Add it under **⋯ → Connections**. |
| `401` from Notion | `NOTION_API_KEY` is wrong, or from a different integration. |
| `401` or `403` from NVIDIA | Check `NVIDIA_API_KEY` and that it hasn't expired. |
| Model ignores tools or errors on tool calls | Set `NVIDIA_MODEL` to another model that lists function calling. |
| Server exits on start | A key is missing from `.env`. |

## Security notes

- Keep `.env` out of version control. It is already in `.gitignore`.
- Chat history lives in server memory and is lost on restart.
- The server has no login. Run it locally, or add authentication before you deploy it.
- The agent can edit pages the integration can access. Only connect pages you're comfortable with it changing.

## Roadmap

- [ ] Streaming responses
- [ ] Persistent chat history
- [ ] Confirmation step before write actions
- [ ] Page picker instead of pasting IDs

## License

MIT
