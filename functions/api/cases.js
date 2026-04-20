// GET /api/cases
// returns list of published cases from Notion database
// env vars: NOTION_TOKEN, NOTION_DATABASE_ID

const DB_ID = '34802bece9b88022a942d95ef8b29797';
const NOTION_VERSION = '2022-06-28';

export async function onRequest(context) {
  const token = context.env.NOTION_TOKEN;
  if (!token) {
    return json({ error: 'NOTION_TOKEN not configured' }, 500);
  }
  const dbId = context.env.NOTION_DATABASE_ID || DB_ID;

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: 'published',
          checkbox: { equals: true },
        },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
        page_size: 100,
      }),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.message || 'Notion error' }, res.status);

    const cases = (data.results || []).map(formatCase).filter(c => c.slug);
    return json({ cases }, 200, {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

function formatCase(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    slug: plainText(p.slug),
    name: titleText(p.Name) || 'Без названия',
    description: plainText(p.description),
    platform: multiSelect(p.platform),
    result: plainText(p.result),
    period: plainText(p.period),
    cover: coverUrl(page),
  };
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
function coverUrl(page) {
  const c = page.cover;
  if (!c) return null;
  return (c.external && c.external.url) || (c.file && c.file.url) || null;
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
