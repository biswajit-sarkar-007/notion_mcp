import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const {
  NVIDIA_API_KEY,
  NOTION_API_KEY,
  NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1',
  NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b',
  NOTION_VERSION = '2022-06-28',
  PORT = 3000,
} = process.env;

if (!NVIDIA_API_KEY || !NOTION_API_KEY) {
  console.error('Missing NVIDIA_API_KEY or NOTION_API_KEY in .env');
  process.exit(1);
}

const MAX_HISTORY = 10;   // messages kept per session
const MAX_STEPS = 8;      // max tool-call rounds per question

const llm = new OpenAI({ apiKey: NVIDIA_API_KEY, baseURL: NVIDIA_BASE_URL });

// ---- Notion MCP connection ------------------------------------------------
const mcp = new Client({ name: 'notion-mcp-agent', version: '1.0.0' });
await mcp.connect(
  new StdioClientTransport({
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: {
      ...process.env,
      OPENAPI_MCP_HEADERS: JSON.stringify({
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
      }),
    },
  })
);

const { tools: mcpTools } = await mcp.listTools();
const tools = mcpTools.map((t) => ({
  type: 'function',
  function: {
    name: t.name,
    description: (t.description || '').slice(0, 1000),
    parameters: t.inputSchema ?? { type: 'object', properties: {} },
  },
}));
console.log(`Connected to Notion MCP (${tools.length} tools). Model: ${NVIDIA_MODEL}`);

// ---- Agent ----------------------------------------------------------------
const sessions = new Map(); // sessionId -> { pageId, history }

const systemPrompt = (pageId) => `You are an expert Notion assistant. You can read and modify the user's Notion workspace through tools.
Rules:
1. Use the tools for every read, search or update. Never guess page content.
2. ${pageId ? `Use page ID ${pageId} for all operations unless the user gives another ID.` : 'No page ID is set. Ask for one if the task needs it.'}
3. After making changes, say what you changed and confirm it worked.
4. If a tool fails, explain the problem and suggest an alternative.
5. Keep answers short. Use Markdown.`;

async function runAgent(session, userText) {
  session.history.push({ role: 'user', content: userText });
  const trace = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const messages = [
      { role: 'system', content: systemPrompt(session.pageId) },
      ...session.history.slice(-MAX_HISTORY),
    ];
    const res = await llm.chat.completions.create({
      model: NVIDIA_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 2048,
    });
    const msg = res.choices[0].message;
    session.history.push(msg);

    if (!msg.tool_calls?.length) return { reply: msg.content ?? '', trace };

    for (const call of msg.tool_calls) {
      let output;
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await mcp.callTool({ name: call.function.name, arguments: args });
        output = (result.content ?? []).map((c) => c.text ?? '').join('\n');
        trace.push({ tool: call.function.name, ok: !result.isError });
      } catch (err) {
        output = `Tool error: ${err.message}`;
        trace.push({ tool: call.function.name, ok: false });
      }
      session.history.push({
        role: 'tool',
        tool_call_id: call.id,
        content: output.slice(0, 12000),
      });
    }
  }
  return { reply: 'I stopped after too many tool steps. Try a more specific request.', trace };
}

// ---- HTTP API -------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static('public'));

const getSession = (id) => {
  if (!sessions.has(id)) sessions.set(id, { pageId: '', history: [] });
  return sessions.get(id);
};

app.post('/api/session', (req, res) => {
  const id = crypto.randomUUID();
  getSession(id).pageId = String(req.body?.pageId ?? '').trim();
  res.json({ sessionId: id });
});

app.post('/api/page', (req, res) => {
  const { sessionId, pageId } = req.body ?? {};
  if (!sessions.has(sessionId)) return res.status(404).json({ error: 'Unknown session' });
  sessions.get(sessionId).pageId = String(pageId ?? '').trim();
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (!sessions.has(sessionId)) return res.status(404).json({ error: 'Unknown session' });
  if (!message?.trim()) return res.status(400).json({ error: 'Message is empty' });
  try {
    res.json(await runAgent(sessions.get(sessionId), message.trim()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  const s = sessions.get(req.body?.sessionId);
  if (s) s.history = [];
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));

process.on('SIGINT', async () => { await mcp.close(); process.exit(0); });
