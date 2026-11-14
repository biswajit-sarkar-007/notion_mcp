const $ = (id) => document.getElementById(id);
const log = $('log'), input = $('input'), sendBtn = $('send'), pageInput = $('pageId');

pageInput.value = localStorage.getItem('pageId') || '';
let sessionId = null;

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function ensureSession() {
  if (!sessionId) ({ sessionId } = await api('/api/session', { pageId: pageInput.value }));
  return sessionId;
}

function add(role, html, text) {
  log.querySelector('.empty')?.remove();
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  if (html !== undefined) el.innerHTML = html; else el.textContent = text;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

const render = (md) => DOMPurify.sanitize(marked.parse(md));

$('setPage').onclick = async () => {
  const id = pageInput.value.trim();
  localStorage.setItem('pageId', id);
  await api('/api/page', { sessionId: await ensureSession(), pageId: id });
  add('bot', render(id ? `Page set to \`${id}\`.` : 'Page cleared.'));
};

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  sendBtn.disabled = true;
  add('user', undefined, text);
  const wait = add('bot typing', undefined, 'Thinking…');
  try {
    const sid = await ensureSession();
    await api('/api/page', { sessionId: sid, pageId: pageInput.value });
    const { reply, trace } = await api('/api/chat', { sessionId: sid, message: text });
    wait.className = 'msg bot';
    wait.innerHTML = render(reply || '_No response._');
    if (trace.length) {
      const t = document.createElement('div');
      t.className = 'tools';
      t.textContent = 'Used: ' + trace.map((x) => (x.ok ? x.tool : x.tool + ' (failed)')).join(', ');
      wait.append(t);
    }
  } catch (err) {
    wait.className = 'msg err';
    wait.textContent = err.message;
  } finally {
    sendBtn.disabled = false;
    input.focus();
    log.scrollTop = log.scrollHeight;
  }
};

$('reset').onclick = async () => {
  if (sessionId) await api('/api/reset', { sessionId });
  log.innerHTML = '<p class="empty">Chat cleared.</p>';
};
