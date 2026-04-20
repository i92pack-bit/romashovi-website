// GET /api/case?slug=xxx
// returns a single case page: properties + content blocks
// env vars: NOTION_TOKEN, NOTION_DATABASE_ID

const DB_ID = '34802bece9b88022a942d95ef8b29797';
const NOTION_VERSION = '2022-06-28';

export async function onRequest(context) {
  const token = context.env.NOTION_TOKEN;
  if (!token) return json({ error: 'NOTION_TOKEN not configured' }, 500);
  const dbId = context.env.NOTION_DATABASE_ID || DB_ID;

  const url = new URL(context.request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'slug required' }, 400);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };

  try {
    // 1) find page by slug
    const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          and: [
            { property: 'slug', rich_text: { equals: slug } },
            { property: 'published', checkbox: { equals: true } },
          ],
        },
        page_size: 1,
      }),
    });
    const queryData = await queryRes.json();
    if (!queryRes.ok) return json({ error: queryData.message || 'Notion error' }, queryRes.status);
    const page = (queryData.results || [])[0];
    if (!page) return json({ error: 'not found' }, 404);

    // 2) fetch blocks
    const blocks = await fetchAllBlocks(page.id, headers);

    return json({
      meta: formatMeta(page),
      blocks,
    }, 200, {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

async function fetchAllBlocks(pageId, headers) {
  const all = [];
  let cursor = undefined;
  let safety = 0;
  while (safety++ < 20) {
    const url = new URL(`https://api.notion.com/v1/blocks/${pageId}/children`);
    if (cursor) url.searchParams.set('start_cursor', cursor);
    url.searchParams.set('page_size', '100');
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) break;
    for (const b of data.results || []) {
      all.push(minify(b));
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return all;
}

function minify(b) {
  const out = { type: b.type };
  const t = b.type;
  const v = b[t] || {};
  if (v.rich_text) out.text = simplifyRich(v.rich_text);
  if (t === 'image') {
    out.url = (v.external && v.external.url) || (v.file && v.file.url) || '';
    out.caption = simplifyRich(v.caption || []);
  }
  if (t === 'callout') {
    out.icon = v.icon ? (v.icon.emoji || null) : null;
  }
  if (t === 'code') {
    out.language = v.language || '';
  }
  if (t === 'bookmark') {
    out.url = v.url || '';
    out.caption = simplifyRich(v.caption || []);
  }
  if (t === 'divider') {}
  return out;
}

function simplifyRich(arr) {
  return (arr || []).map(t => ({
    text: t.plain_text || '',
    bold: t.annotations && t.annotations.bold,
    italic: t.annotations && t.annotations.italic,
    code: t.annotations && t.annotations.code,
    strikethrough: t.annotations && t.annotations.strikethrough,
    underline: t.annotations && t.annotations.underline,
    color: t.annotations && t.annotations.color !== 'default' ? t.annotations.color : null,
    link: t.href || null,
  }));
}

function formatMeta(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    slug: (p.slug && p.slug.rich_text) ? p.slug.rich_text.map(t => t.plain_text).join('') : '',
    name: (p.Name && p.Name.title) ? p.Name.title.map(t => t.plain_text).join('') : 'Без названия',
    description: (p.description && p.description.rich_text) ? p.description.rich_text.map(t => t.plain_text).join('') : '',
    platform: (p.platform && p.platform.multi_select) ? p.platform.multi_select.map(o => o.name) : [],
    result: (p.result && p.result.rich_text) ? p.result.rich_text.map(t => t.plain_text).join('') : '',
    period: (p.period && p.period.rich_text) ? p.period.rich_text.map(t => t.plain_text).join('') : '',
    cover: page.cover ? ((page.cover.external && page.cover.external.url) || (page.cover.file && page.cover.file.url) || null) : null,
    last_edited: page.last_edited_time,
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}
