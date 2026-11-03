/**
 * Script universal para incrustar un portal en cualquier web:
 *   <div data-luanna="ID-DE-LA-SEDE" data-lang="es"></div>
 *   <script src="https://luanna.app/embed.js" async></script>
 * Crea un iframe aislado (los estilos de la web anfitriona no lo rompen) y
 * ajusta su altura con los mensajes que envía el portal.
 */
const script = (origen: string) => `(() => {
  const ORIGEN = ${JSON.stringify(origen)};
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function montar(nodo) {
    if (nodo.dataset.luannaListo) return;
    const id = nodo.dataset.luanna;
    if (!UUID.test(id || '')) { console.warn('[luanna] data-luanna debe ser el id de tu sede'); return; }
    nodo.dataset.luannaListo = '1';
    const url = new URL('/p/' + id, ORIGEN);
    url.searchParams.set('embed', '1');
    if (nodo.dataset.lang === 'es' || nodo.dataset.lang === 'en') url.searchParams.set('lang', nodo.dataset.lang);
    const iframe = document.createElement('iframe');
    iframe.src = url.toString();
    iframe.title = nodo.dataset.titulo || 'Cómo llegar y dónde quedarte';
    iframe.loading = 'lazy';
    iframe.allow = 'clipboard-write';
    iframe.style.cssText = 'width:100%;min-height:640px;border:0;display:block;color-scheme:normal;';
    iframe.dataset.luannaId = id;
    nodo.replaceChildren(iframe);
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== ORIGEN || !e.data || e.data.luanna !== 'altura') return;
    document.querySelectorAll('iframe[data-luanna-id]').forEach((f) => {
      if (f.contentWindow === e.source) { f.style.height = Math.ceil(e.data.alto) + 'px'; f.style.minHeight = '0'; }
    });
  });
  const todo = () => document.querySelectorAll('[data-luanna]').forEach(montar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', todo); else todo();
  new MutationObserver(todo).observe(document.documentElement, { childList: true, subtree: true });
})();`

export function GET(request: Request) {
  return new Response(script(new URL(request.url).origin), { headers: {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  } })
}
