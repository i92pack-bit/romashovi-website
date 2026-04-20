// Pages Function for /cases/<slug>
// Serves the static /case.html template with the slug injected as a query param,
// bypassing CF's auto-URL-normalization.
export async function onRequest(context) {
  const slug = context.params.slug;
  const url = new URL(context.request.url);
  url.pathname = '/case.html';
  url.searchParams.set('slug', slug);
  const req = new Request(url.toString(), {
    method: 'GET',
    headers: context.request.headers,
  });
  return context.env.ASSETS.fetch(req);
}
