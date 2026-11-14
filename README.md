# Notion Agent

Chat with your Notion pages in the browser. Express backend, Notion MCP server, NVIDIA free models.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add `NVIDIA_API_KEY` (from build.nvidia.com) and `NOTION_API_KEY`.
3. In Notion, share your page with your integration (… menu → Connections).
4. `npm start`, then open http://localhost:3000
5. Paste the page ID (the 32-character part at the end of the page URL).

## Change the model
Set `NVIDIA_MODEL` in `.env`. Pick a model that supports tool calling.
