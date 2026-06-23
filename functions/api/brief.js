// POST /api/brief — receives the brief form text and forwards it to the Telegram lead bot.
// Secrets live in Cloudflare Pages env vars (Settings → Environment variables), NOT in code:
//   TG_BOT_TOKEN  — bot token from @BotFather
//   TG_CHAT_ID    — chat id that should receive the leads (Yulia's chat / a private channel)

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const token = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;
  if (!token || !chatId) {
    return json({ error: 'bot not configured' }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  // The client sends the already-formatted brief text. Keep it sane.
  let text = typeof data.text === 'string' ? data.text.trim() : '';
  if (text.length < 10) return json({ error: 'empty brief' }, 400);
  if (text.length > 3500) text = text.slice(0, 3500) + '…';

  const lang = data.lang === 'en' ? 'EN' : 'RU';
  const message = `🆕 Бриф с сайта · ${lang}\n\n${text}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });
    if (!tgRes.ok) {
      const detail = await tgRes.text();
      return json({ error: 'telegram error', detail }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'send failed', detail: String(e) }, 502);
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
