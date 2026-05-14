export function renderAdminLoginPage(error: boolean): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Luanna — admin login</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --rausch: #ff385c;
    --rausch-dark: #e00b41;
    --text: #222;
    --text-2: #6a6a6a;
    --text-3: #929292;
    --bg: #fafafa;
    --card: #fff;
    --surface: #f2f2f2;
    --border: rgba(0,0,0,.08);
    --border-strong: rgba(0,0,0,.18);
    --red: #dc2626;
    --shadow: rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px, rgba(0,0,0,.10) 0 4px 8px;
    --font: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    font-weight: 500;
    color: var(--text);
    background: var(--bg);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 24px 16px;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 22px;
    padding: 28px 26px;
    width: 100%;
    max-width: 380px;
    box-shadow: var(--shadow);
  }
  .logo {
    font-size: 26px; font-weight: 700;
    color: var(--rausch); letter-spacing: -0.5px;
    margin-bottom: 4px;
  }
  .logo span { color: var(--text); }
  .sub {
    font-size: 12px; font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.3px; text-transform: uppercase;
    margin-bottom: 18px;
  }
  h1 {
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.4px; line-height: 1.2;
    margin-bottom: 6px;
  }
  p.lead {
    font-size: 14px; color: var(--text-2);
    margin-bottom: 22px;
  }
  label {
    display: block;
    font-size: 13px; font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }
  input.text {
    width: 100%;
    font-family: var(--font);
    font-size: 15px; font-weight: 500;
    color: var(--text);
    background: #fff;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 12px 14px;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }
  input.text:focus {
    border-color: var(--rausch);
    box-shadow: 0 0 0 3px rgba(255,56,92,.12);
  }
  button.btn {
    width: 100%;
    margin-top: 14px;
    padding: 12px 18px;
    background: var(--rausch);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: var(--font);
    font-size: 15px; font-weight: 700;
    cursor: pointer;
    transition: background .15s;
  }
  button.btn:hover { background: var(--rausch-dark); }
  button.btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .err {
    background: rgba(220, 38, 38, 0.08);
    color: var(--red);
    font-size: 13px;
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 14px;
  }
  .footer-hint {
    font-size: 11px; color: var(--text-3);
    text-align: center; margin-top: 18px;
    line-height: 1.45;
  }
  .footer-hint code {
    background: var(--surface);
    padding: 1px 6px; border-radius: 4px;
    font-family: "SF Mono", Menlo, monospace;
    font-size: 11px;
  }
</style>
</head>
<body>
  <form class="card" method="POST" action="/admin/login" autocomplete="off">
    <div class="logo">luanna<span>.</span></div>
    <div class="sub">Admin access</div>
    <h1>Iniciar sesión</h1>
    <p class="lead">Esta área es solo para el operador. Ingresa tu ADMIN_API_KEY para continuar.</p>
    ${error ? '<div class="err">Contraseña incorrecta. Verificá la key y volvé a intentar.</div>' : ""}
    <label for="password">Contraseña</label>
    <input id="password" name="password" type="password" class="text" autofocus required minlength="8" />
    <button type="submit" class="btn">Entrar</button>
    <p class="footer-hint">
      La key vive como secret de Cloudflare (<code>ADMIN_API_KEY</code>). Si la perdiste, regenerala con
      <code>wrangler secret put ADMIN_API_KEY</code>.
    </p>
  </form>
</body>
</html>`;
}

export function renderAdminDashboardPage(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Luanna — admin</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --rausch: #ff385c;
    --rausch-dark: #e00b41;
    --text: #222;
    --text-2: #6a6a6a;
    --text-3: #929292;
    --bg: #fafafa;
    --card: #fff;
    --surface: #f2f2f2;
    --border: rgba(0,0,0,.08);
    --teal: #00a87e;
    --amber: #f59e0b;
    --red: #dc2626;
    --shadow: rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px, rgba(0,0,0,.08) 0 4px 8px;
    --font: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; min-width: 0; }
  html, body { width: 100%; overflow-x: hidden; }
  body {
    font-family: var(--font);
    font-weight: 500;
    color: var(--text);
    background: var(--bg);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 40px;
  }
  header {
    background: #fff;
    border-bottom: 1px solid var(--border);
    padding: 14px 0;
    position: sticky; top: 0; z-index: 10;
    backdrop-filter: saturate(180%) blur(10px);
    background: rgba(255,255,255,0.95);
  }
  .nav {
    max-width: 1200px; margin: 0 auto;
    padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo {
    font-size: 22px; font-weight: 700; color: var(--rausch);
    letter-spacing: -0.5px;
    text-decoration: none;
  }
  .logo span { color: var(--text); }
  .badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--rausch);
    background: rgba(255,56,92,0.08);
    padding: 4px 10px; border-radius: 999px;
  }
  .refresh {
    font-size: 12px; font-weight: 600;
    color: var(--text-2);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 12px; border-radius: 999px;
    cursor: pointer;
  }
  .refresh:hover { color: var(--rausch); border-color: var(--rausch); }

  main { max-width: 1200px; margin: 0 auto; padding: 24px 20px; width: 100%; }
  @media (max-width: 540px) {
    main { padding: 18px 14px; }
    .nav { padding: 0 14px; }
  }
  @media (max-width: 380px) {
    main { padding: 16px 12px; }
    .nav { padding: 0 12px; }
    .nav .logo { font-size: 18px; }
    .badge { font-size: 10px; padding: 3px 8px; }
    .refresh { padding: 5px 10px; font-size: 11px; }
  }
  h2 {
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.32px; text-transform: uppercase;
    color: var(--rausch);
    margin: 32px 0 12px;
  }
  h2:first-child { margin-top: 0; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  @media (max-width: 380px) {
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .kpi { padding: 12px 14px; }
    .kpi-value { font-size: 24px; }
  }
  .kpi {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: var(--shadow);
  }
  .kpi-label {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.24px; text-transform: uppercase;
    color: var(--text-3);
  }
  .kpi-value {
    font-size: 28px; font-weight: 700;
    letter-spacing: -0.4px;
    margin-top: 4px;
    color: var(--text);
  }
  .kpi-value.warn { color: var(--amber); }
  .kpi-value.bad { color: var(--red); }
  .kpi-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }

  .twocol {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 20px;
  }
  @media (max-width: 880px) { .twocol { grid-template-columns: 1fr; } }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px;
    box-shadow: var(--shadow);
    overflow-x: auto;
  }
  @media (max-width: 380px) {
    .card { padding: 14px; border-radius: 14px; }
  }
  .card h3 {
    font-size: 14px; font-weight: 700;
    color: var(--text);
    margin-bottom: 14px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: auto; }
  @media (max-width: 380px) {
    table { font-size: 12px; }
    th, td { padding: 6px 4px; }
  }
  th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid var(--border); }
  th { font-size: 11px; font-weight: 700; color: var(--text-3); letter-spacing: 0.16px; text-transform: uppercase; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .ctx-pill {
    font-size: 11px; font-weight: 600;
    color: var(--text-2);
    background: var(--surface);
    padding: 2px 8px; border-radius: 4px;
    display: inline-block;
  }
  .ctx-pill.error { color: var(--red); background: rgba(220,38,38,0.08); }
  .ctx-pill.cron { color: var(--teal); background: rgba(0,168,126,0.08); }
  .ctx-pill.web { color: var(--rausch); background: rgba(255,56,92,0.08); }

  .empty {
    font-size: 12px; color: var(--text-3);
    text-align: center; padding: 24px 12px;
  }

  /* sparkline */
  .spark { width: 100%; height: 70px; display: block; }
  .spark-axis { stroke: var(--border); }
  .spark-line-signups { stroke: var(--rausch); }
  .spark-line-messages { stroke: var(--teal); }
  .spark-legend {
    display: flex; gap: 12px;
    font-size: 11px; color: var(--text-2);
    margin-top: 8px;
  }
  .spark-legend .dot {
    display: inline-block;
    width: 8px; height: 8px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }

  .row-msg {
    font-size: 12px; color: var(--text);
    font-family: "SF Mono", Menlo, monospace;
    word-break: break-word;
  }
  .ago { font-size: 11px; color: var(--text-3); white-space: nowrap; }

  .quick-links {
    display: flex; gap: 8px; flex-wrap: wrap;
    margin-top: 12px;
  }
  .quick-links a {
    font-size: 12px; font-weight: 600;
    color: var(--text-2);
    background: var(--surface);
    padding: 6px 10px; border-radius: 6px;
    text-decoration: none;
    transition: all .15s;
  }
  .quick-links a:hover { color: var(--rausch); background: rgba(255,56,92,0.08); }

  .loading {
    text-align: center; padding: 80px 20px;
    color: var(--text-3); font-size: 14px;
  }
  .err-banner {
    background: rgba(220,38,38,0.08);
    color: var(--red);
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13px;
    margin-bottom: 20px;
  }
</style>
</head>
<body>

  <header>
    <div class="nav">
      <a href="/" class="logo">luanna<span>.</span> <span style="color:var(--text-3); font-weight:500">admin</span></a>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
        <span class="badge" id="updated-badge">cargando…</span>
        <button class="refresh" id="refresh-btn">↻ Refrescar</button>
        <form method="POST" action="/admin/logout" style="margin:0;">
          <button class="refresh" type="submit" title="Cerrar sesión">↩ Salir</button>
        </form>
      </div>
    </div>
  </header>

  <main>
    <div id="loading" class="loading">Cargando métricas…</div>
    <div id="err-banner" class="err-banner" style="display:none"></div>
    <div id="content" style="display:none">

      <h2>Hoy</h2>
      <div class="kpi-grid" id="kpi-today"></div>

      <h2>Totales</h2>
      <div class="kpi-grid" id="kpi-totals"></div>

      <h2>Últimos 7 días</h2>
      <div class="twocol">
        <div class="card">
          <h3>Signups + mensajes recibidos</h3>
          <svg class="spark" id="spark" viewBox="0 0 700 80" preserveAspectRatio="none"></svg>
          <div class="spark-legend">
            <span><span class="dot" style="background:var(--rausch)"></span>Signups</span>
            <span><span class="dot" style="background:var(--teal)"></span>Mensajes</span>
          </div>
        </div>
        <div class="card">
          <h3>Clicks por categoría</h3>
          <table id="clicks-table">
            <thead><tr><th>Categoría</th><th class="num">Clicks</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <h2>Errores</h2>
      <div class="twocol">
        <div class="card">
          <h3>Por contexto (últimas 24h)</h3>
          <table id="errors-by-ctx">
            <thead><tr><th>Contexto</th><th class="num">Total</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="card">
          <h3>Top referrers</h3>
          <table id="top-referrers">
            <thead><tr><th>Usuario</th><th class="num">Invitados</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <h3>Errores recientes (últimos 20)</h3>
        <table id="recent-errors">
          <thead><tr><th>Cuándo</th><th>Contexto</th><th>Mensaje</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <h2>Usuarios recientes</h2>
      <div class="card">
        <table id="recent-users">
          <thead><tr><th>Nombre</th><th>Phone</th><th>Creado</th><th>Último msg</th><th class="num">Mensajes</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>

      <h2>Quick links</h2>
      <div class="quick-links">
        <a href="https://us.posthog.com/dashboards" target="_blank" rel="noopener">PostHog</a>
        <a href="https://dashboard.uptimerobot.com/monitors" target="_blank" rel="noopener">UptimeRobot</a>
        <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">Cloudflare</a>
        <a href="/admin/errors/recent" target="_blank" rel="noopener">JSON errors</a>
        <a href="/admin/data-deletion/pending" target="_blank" rel="noopener">JSON deletions</a>
        <a href="/health" target="_blank" rel="noopener">Health</a>
      </div>
    </div>
  </main>

  <script>
    function ago(iso) {
      if (!iso) return "—";
      const d = new Date(iso);
      const s = Math.floor((Date.now() - d.getTime()) / 1000);
      if (s < 60) return s + "s";
      if (s < 3600) return Math.floor(s / 60) + "m";
      if (s < 86400) return Math.floor(s / 3600) + "h";
      return Math.floor(s / 86400) + "d";
    }
    function esc(s) {
      return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    }
    function ctxPillClass(c) {
      if (c.startsWith("cron:")) return "ctx-pill cron";
      if (c.startsWith("webhook:") || c.startsWith("fetch:")) return "ctx-pill error";
      if (c.startsWith("web:")) return "ctx-pill web";
      return "ctx-pill";
    }
    function kpi(label, value, sub, klass) {
      return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div>' +
             '<div class="kpi-value' + (klass ? ' ' + klass : '') + '">' + (value === 0 || value ? value : '—') + '</div>' +
             (sub ? '<div class="kpi-sub">' + esc(sub) + '</div>' : '') + '</div>';
    }
    function renderSparkline(svg, days) {
      const w = 700, h = 80, pad = 8;
      const sigMax = Math.max(1, ...days.map(d => d.signups));
      const msgMax = Math.max(1, ...days.map(d => d.messages));
      // Two lines: signups (rausch) and messages (teal), scaled independently
      function path(get, max) {
        const step = (w - 2 * pad) / Math.max(1, days.length - 1);
        return days.map((d, i) => {
          const x = pad + i * step;
          const y = h - pad - (get(d) / max) * (h - 2 * pad);
          return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
      }
      svg.innerHTML =
        '<line class="spark-axis" x1="0" y1="' + (h - 0.5) + '" x2="' + w + '" y2="' + (h - 0.5) + '" />' +
        '<path d="' + path(d => d.signups, sigMax) + '" fill="none" stroke="var(--rausch)" stroke-width="2"/>' +
        '<path d="' + path(d => d.messages, msgMax) + '" fill="none" stroke="var(--teal)" stroke-width="2"/>';
    }
    function fillTable(id, rows, cols) {
      const tbody = document.querySelector('#' + id + ' tbody');
      if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="empty">Sin datos</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(r => '<tr>' + cols.map(c => '<td' + (c.num ? ' class="num"' : '') + '>' + c.render(r) + '</td>').join('') + '</tr>').join('');
    }
    async function load() {
      try {
        const res = await fetch('/admin/dashboard.json', { credentials: 'include' });
        if (res.status === 401) { window.location.href = '/admin/login'; return; }
        if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('err-banner').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        document.getElementById('updated-badge').textContent = 'actualizado ' + new Date().toLocaleTimeString();

        const t = data.today;
        document.getElementById('kpi-today').innerHTML = [
          kpi('Signups', t.signups),
          kpi('Mensajes', t.messages),
          kpi('Clicks', t.clicks),
          kpi('Errores', t.errors, null, t.errors > 5 ? 'bad' : t.errors > 0 ? 'warn' : ''),
          kpi('Nudges', t.nudges_sent),
          kpi('Ofertas', t.offers_sent),
        ].join('');

        const tot = data.totals;
        document.getElementById('kpi-totals').innerHTML = [
          kpi('Usuarios WA', tot.users),
          kpi('Alertas activas', tot.active_alerts),
          kpi('Deletions pending', tot.pending_deletions, null, tot.pending_deletions > 0 ? 'warn' : ''),
          kpi('Clicks 30d', tot.total_clicks_30d),
          kpi('Referrals', tot.total_referrals),
        ].join('');

        renderSparkline(document.getElementById('spark'), data.trend_7d || []);

        fillTable('clicks-table', data.clicks_by_kind_7d, [
          { num: false, render: r => esc(r.kind) },
          { num: true, render: r => r.count },
        ]);

        fillTable('errors-by-ctx', data.errors_by_context_24h, [
          { num: false, render: r => '<span class="' + ctxPillClass(r.context) + '">' + esc(r.context) + '</span>' },
          { num: true, render: r => r.count },
        ]);

        fillTable('top-referrers', data.top_referrers, [
          { num: false, render: r => esc(r.name || r.phone.slice(0, 14)) },
          { num: true, render: r => r.invites },
        ]);

        fillTable('recent-errors', data.recent_errors, [
          { num: false, render: r => '<span class="ago">' + ago(r.occurred_at) + '</span>' },
          { num: false, render: r => '<span class="' + ctxPillClass(r.context) + '">' + esc(r.context) + '</span>' },
          { num: false, render: r => '<span class="row-msg">' + esc(r.message) + '</span>' },
        ]);

        fillTable('recent-users', data.recent_users, [
          { num: false, render: r => esc(r.name || '—') },
          { num: false, render: r => esc(r.phone) },
          { num: false, render: r => '<span class="ago">' + ago(r.created_at) + '</span>' },
          { num: false, render: r => '<span class="ago">' + (r.last_message_at ? ago(r.last_message_at) : '—') + '</span>' },
          { num: true, render: r => r.message_count },
        ]);
      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        const banner = document.getElementById('err-banner');
        banner.style.display = 'block';
        banner.textContent = 'No pudimos cargar el dashboard: ' + (err.message || err);
      }
    }
    document.getElementById('refresh-btn').addEventListener('click', load);
    load();
  </script>
</body>
</html>`;
}
