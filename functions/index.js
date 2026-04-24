// SSR for /
// Fetches cases from Notion at the edge and injects them into index.html
// so the first paint shows real cases (no flash of static placeholders).
// Falls back to the untouched HTML (with static placeholder rows) if Notion is unreachable.

const DB_ID = '34802bece9b88022a942d95ef8b29797';
const NOTION_VERSION = '2022-06-28';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Only SSR the root path
  if (url.pathname !== '/') {
    return env.ASSETS.fetch(request);
  }

  // Fetch the static index.html
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/index.html';
  const htmlResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

  // Try to get cases from Notion; fall back silently on any failure
  let cases = null;
  try {
    cases = await fetchCases(env);
  } catch (_) { /* fallback to static HTML */ }

  if (!cases || !cases.length) {
    return htmlResponse;
  }

  const rewriter = new HTMLRewriter()
    .on('.case-list', new CaseListHandler(cases))
    .on('.cases-count b', new CountHandler(cases.length));

  const transformed = rewriter.transform(htmlResponse);

  // Short edge cache — HTML refreshes every 5 min so new cases in Notion show up quickly
  const headers = new Headers(transformed.headers);
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}

// ── HTMLRewriter handlers ────────────────────────────────────────────

class CaseListHandler {
  constructor(cases) { this.cases = cases; }
  element(element) {
    element.setAttribute('data-ssr', '1');
    element.setInnerContent(renderCases(this.cases), { html: true });
  }
}

class CountHandler {
  constructor(count) { this.count = count; }
  element(element) {
    element.setInnerContent(String(this.count).padStart(2, '0'));
  }
}

// ── Rendering (must match the client-side loadCases() in index.html) ──

const ICONS = ['✦', '◆', '⟐', '⚘', '❋', '✺'];
const IC_CLASSES = ['a', 'b', 'c', 'd', 'e', 'a'];

function pkey(p) {
  const n = (p || '').toLowerCase();
  if (n.includes('meta') || n.includes('facebook') || n.includes('instagram')) return 'meta';
  if (n.includes('vk') || n.includes('вк')) return 'vk';
  if (n.includes('ya') || n.includes('яндекс') || n.includes('директ')) return 'ya';
  if (n.includes('tg') || n.includes('tele')) return 'tg';
  if (n.includes('goog')) return 'g';
  return '';
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCases(cases) {
  return cases.map((c, i) => {
    const icon = ICONS[i % ICONS.length];
    const ic = IC_CLASSES[i % IC_CLASSES.length];
    const platforms = (c.platform || []).slice(0, 2).map(p =>
      `<span class="case-chip ${pkey(p)}">${esc(p)}</span>`).join('');
    const result = c.result ? `<span class="case-chip result">${esc(c.result)}</span>` : '';
    return `<a href="/cases/${esc(c.slug)}" class="case-row">
<div class="case-ic ${ic}"><span>${icon}</span></div>
<div class="case-main">
<div class="case-title">${esc(c.name)}</div>
${c.description ? `<div class="case-desc">${esc(c.description)}</div>` : ''}
</div>
<div class="case-meta">${platforms}${result}</div>
<div class="case-arrow">→</div>
</a>`;
  }).join('');
}

// ── Notion fetch + formatting (mirrors api/cases.js) ──────────────────

async function fetchCases(env) {
  const token = env.NOTION_TOKEN;
  if (!token) return null;
  const dbId = env.NOTION_DATABASE_ID || DB_ID;

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: { property: 'published', checkbox: { equals: true } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 100,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.results || []).map(formatCase).filter(c => c.slug);
}

function formatCase(page) {
  const p = page.properties || {};
  return {
    slug: plainText(pick(p, ['slug', 'Slug'])),
    name: titleText(pick(p, ['Name', 'name', 'Title', 'title'])) || 'Без названия',
    description: plainText(pick(p, ['description', 'Description'])),
    platform: multiSelect(pick(p, ['platform', 'Platform'])),
    result: plainText(pick(p, ['result', 'Result'])),
  };
}

function pick(obj, keys) {
  for (const k of keys) if (obj[k] != null) return obj[k];
  const lower = {};
  for (const k in obj) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) if (lower[k.toLowerCase()] != null) return lower[k.toLowerCase()];
  return undefined;
}
function titleText(prop) {
  if (!prop || !prop.title) return '';
  return prop.title.map(t => t.plain_text || '').join('');
}
function plainText(prop) {
  if (!prop) return '';
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text || '').join('');
  if (prop.title) return titleText(prop);
  return '';
}
function multiSelect(prop) {
  if (!prop || !prop.multi_select) return [];
  return prop.multi_select.map(o => o.name);
}
