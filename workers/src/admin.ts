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
    --rausch: #DB892D;
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
    --rausch: #DB892D;
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
    --sidebar-w: 244px;
    --sidebar-w-collapsed: 64px;
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
    display: flex; min-height: 100vh;
  }

  /* ── Sidebar ── */
  aside.sidebar {
    width: var(--sidebar-w);
    background: #fff;
    border-right: 1px solid var(--border);
    padding: 18px 14px;
    display: flex; flex-direction: column; gap: 8px;
    position: sticky; top: 0; height: 100vh;
    transition: width .2s ease, transform .25s ease;
    flex-shrink: 0;
  }
  body.collapsed aside.sidebar { width: var(--sidebar-w-collapsed); padding: 18px 8px; }
  body.collapsed aside.sidebar .nav-label,
  body.collapsed aside.sidebar .brand-text,
  body.collapsed aside.sidebar .sidebar-foot small { display: none; }

  .brand {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 8px 14px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
  }
  .brand-mark {
    width: 32px; height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, var(--rausch), var(--rausch-dark));
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 700; font-size: 16px;
    flex-shrink: 0;
  }
  .brand-text {
    font-size: 14px; font-weight: 700; color: var(--text);
    letter-spacing: -0.2px;
  }
  .brand-text small {
    display: block;
    font-size: 11px; font-weight: 500;
    color: var(--text-3);
    text-transform: uppercase; letter-spacing: 0.4px;
    margin-top: 1px;
  }

  .nav-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .nav-item {
    display: flex; align-items: center; gap: 11px;
    padding: 10px 12px;
    border-radius: 10px;
    color: var(--text-2);
    cursor: pointer;
    transition: background .15s, color .15s;
    font-size: 14px; font-weight: 600;
    background: transparent; border: none; width: 100%;
    text-align: left;
    font-family: var(--font);
  }
  .nav-item:hover { background: var(--surface); color: var(--text); }
  .nav-item.active {
    background: rgba(255, 56, 92, 0.10);
    color: var(--rausch);
  }
  .nav-icon {
    width: 18px; height: 18px;
    flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
  }

  .sidebar-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; }
  .sidebar-foot form { margin: 0; }
  .sidebar-foot small { font-size: 11px; color: var(--text-3); padding: 0 8px; }

  /* Hamburger / collapse button */
  .topbar {
    display: flex; align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,.92);
    backdrop-filter: saturate(180%) blur(10px);
    position: sticky; top: 0; z-index: 5;
  }
  .toggle-btn {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: #fff;
    color: var(--text-2);
    cursor: pointer;
    flex-shrink: 0;
  }
  .toggle-btn:hover { color: var(--rausch); border-color: var(--rausch); }
  .topbar-title {
    font-size: 16px; font-weight: 700;
    color: var(--text);
    letter-spacing: -0.2px;
  }
  .topbar-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .badge {
    font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
    text-transform: uppercase;
    color: var(--rausch);
    background: rgba(255,56,92,0.08);
    padding: 4px 10px; border-radius: 999px;
  }
  .pill-btn {
    font-size: 12px; font-weight: 600;
    color: var(--text-2);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 12px; border-radius: 999px;
    cursor: pointer;
    transition: all .15s;
    font-family: var(--font);
  }
  .pill-btn:hover { color: var(--rausch); border-color: var(--rausch); }

  /* ── Main content ── */
  .main-wrap { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  main { padding: 22px 24px 60px; max-width: 1200px; width: 100%; }

  .panel { display: none; animation: fade .2s ease-out; }
  .panel.active { display: block; }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  h2 {
    font-size: 13px; font-weight: 700;
    letter-spacing: 0.32px; text-transform: uppercase;
    color: var(--rausch);
    margin: 26px 0 12px;
  }
  h2:first-child { margin-top: 0; }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  .kpi {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow: var(--shadow);
  }
  .kpi-label { font-size: 11px; font-weight: 700; letter-spacing: 0.24px; text-transform: uppercase; color: var(--text-3); }
  .kpi-value { font-size: 28px; font-weight: 700; letter-spacing: -0.4px; margin-top: 4px; color: var(--text); }
  .kpi-value.warn { color: var(--amber); }
  .kpi-value.bad { color: var(--red); }
  .kpi-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }

  .twocol { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
  @media (max-width: 880px) { .twocol { grid-template-columns: 1fr; } }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px;
    box-shadow: var(--shadow);
    overflow-x: auto;
  }
  .card h3 { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 14px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid var(--border); }
  th { font-size: 11px; font-weight: 700; color: var(--text-3); letter-spacing: 0.16px; text-transform: uppercase; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .ctx-pill { font-size: 11px; font-weight: 600; color: var(--text-2); background: var(--surface); padding: 2px 8px; border-radius: 4px; display: inline-block; white-space: nowrap; }
  .ctx-pill.error { color: var(--red); background: rgba(220,38,38,0.08); }
  .ctx-pill.cron { color: var(--teal); background: rgba(0,168,126,0.08); }
  .ctx-pill.web { color: var(--rausch); background: rgba(255,56,92,0.08); }

  .empty { font-size: 12px; color: var(--text-3); text-align: center; padding: 24px 12px; }

  .spark { width: 100%; height: 70px; display: block; }
  .spark-axis { stroke: var(--border); }
  .spark-legend { display: flex; gap: 12px; font-size: 11px; color: var(--text-2); margin-top: 8px; }
  .spark-legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }

  .row-msg { font-size: 12px; color: var(--text); font-family: "SF Mono", Menlo, monospace; word-break: break-word; }
  .ago { font-size: 11px; color: var(--text-3); white-space: nowrap; }

  .links-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
  .link-tile { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-decoration: none; color: var(--text); transition: all .15s; }
  .link-tile:hover { border-color: var(--rausch); color: var(--rausch); transform: translateY(-1px); }
  .link-tile .lt-title { font-size: 13px; font-weight: 700; }
  .link-tile .lt-sub { font-size: 11px; color: var(--text-3); margin-top: 3px; }

  .loading { text-align: center; padding: 80px 20px; color: var(--text-3); font-size: 14px; }
  .err-banner { background: rgba(220,38,38,0.08); color: var(--red); padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; }

  /* Mobile sidebar = off-canvas drawer */
  .scrim { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 19; }
  body.menu-open .scrim { display: block; }

  @media (max-width: 720px) {
    aside.sidebar {
      position: fixed; left: 0; top: 0; height: 100vh;
      transform: translateX(-100%);
      z-index: 20;
      width: 260px;
      box-shadow: 0 0 30px rgba(0,0,0,.18);
    }
    body.menu-open aside.sidebar { transform: translateX(0); }
    body.collapsed aside.sidebar { width: 260px; padding: 18px 14px; }
    body.collapsed aside.sidebar .nav-label,
    body.collapsed aside.sidebar .brand-text,
    body.collapsed aside.sidebar .sidebar-foot small { display: block; }
    main { padding: 16px 14px 60px; }
    .topbar { padding: 10px 14px; }
    .topbar-title { font-size: 14px; }
    .badge { display: none; }
  }
  @media (max-width: 380px) {
    main { padding: 14px 10px 50px; }
    .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .kpi { padding: 12px 14px; }
    .kpi-value { font-size: 22px; }
    .card { padding: 14px; }
    table { font-size: 12px; }
    th, td { padding: 6px 4px; }
    .topbar-actions .pill-btn { padding: 5px 10px; font-size: 11px; }
  }
</style>
</head>
<body>

  <div class="scrim" id="scrim"></div>

  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="brand-mark">L</div>
      <div class="brand-text">luanna<small>admin</small></div>
    </div>

    <ul class="nav-list" id="nav-list">
      <li><button class="nav-item active" data-section="overview">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12 12 4l9 8M5 10v10h4v-6h6v6h4V10"/></svg></span>
        <span class="nav-label">Overview</span>
      </button></li>
      <li><button class="nav-item" data-section="errors">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg></span>
        <span class="nav-label">Errores</span>
      </button></li>
      <li><button class="nav-item" data-section="users">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="17" cy="6" r="3"/><path d="m22 21-1-2a3 3 0 0 0-3-2"/></svg></span>
        <span class="nav-label">Usuarios</span>
      </button></li>
      <li><button class="nav-item" data-section="feedback">
        <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <span class="nav-label">Feedback</span>
      </button></li>
    </ul>

    <div class="sidebar-foot">
      <small id="updated-text">cargando…</small>
      <form method="POST" action="/admin/logout">
        <button class="nav-item" type="submit" title="Cerrar sesión">
          <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg></span>
          <span class="nav-label">Salir</span>
        </button>
      </form>
    </div>
  </aside>

  <div class="main-wrap">
    <div class="topbar">
      <button class="toggle-btn" id="toggle-btn" title="Menú">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="topbar-title" id="topbar-title">Overview</div>
      <div class="topbar-actions">
        <span class="badge" id="updated-badge">cargando…</span>
        <button class="pill-btn" id="refresh-btn">↻ Refrescar</button>
      </div>
    </div>

    <main>
      <div id="loading" class="loading">Cargando métricas…</div>
      <div id="err-banner" class="err-banner" style="display:none"></div>

      <section class="panel active" data-section="overview">
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

        <h2>Quick links</h2>
        <div class="links-grid">
          <a class="link-tile" href="https://us.posthog.com/dashboards" target="_blank" rel="noopener">
            <div class="lt-title">PostHog</div><div class="lt-sub">Eventos + dashboards</div>
          </a>
          <a class="link-tile" href="https://dashboard.uptimerobot.com/monitors" target="_blank" rel="noopener">
            <div class="lt-title">UptimeRobot</div><div class="lt-sub">Synthetic monitor</div>
          </a>
          <a class="link-tile" href="https://dash.cloudflare.com" target="_blank" rel="noopener">
            <div class="lt-title">Cloudflare</div><div class="lt-sub">Worker + DNS + secrets</div>
          </a>
          <a class="link-tile" href="/admin/errors/recent" target="_blank" rel="noopener">
            <div class="lt-title">JSON errores</div><div class="lt-sub">/admin/errors/recent</div>
          </a>
          <a class="link-tile" href="/admin/data-deletion/pending" target="_blank" rel="noopener">
            <div class="lt-title">Deletions pendientes</div><div class="lt-sub">/admin/data-deletion/pending</div>
          </a>
          <a class="link-tile" href="/health" target="_blank" rel="noopener">
            <div class="lt-title">Health</div><div class="lt-sub">/health (DB ping)</div>
          </a>
        </div>
      </section>

      <section class="panel" data-section="errors">
        <h2>Errores</h2>
        <div class="twocol">
          <div class="card">
            <h3>Por contexto (24h)</h3>
            <table id="errors-by-ctx">
              <thead><tr><th>Contexto</th><th class="num">Total</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="card">
            <h3>Resumen de hoy</h3>
            <div class="kpi-grid" id="kpi-errors-mini"></div>
          </div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3>Recientes (últimos 20)</h3>
          <table id="recent-errors">
            <thead><tr><th>Cuándo</th><th>Contexto</th><th>Mensaje</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="panel" data-section="users">
        <h2>Top referrers</h2>
        <div class="card">
          <table id="top-referrers">
            <thead><tr><th>Usuario</th><th class="num">Invitados</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <h2>Usuarios recientes</h2>
        <div class="card">
          <table id="recent-users">
            <thead><tr><th>Nombre</th><th>Phone</th><th>Creado</th><th>Último msg</th><th class="num">Msgs</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>

      <section class="panel" data-section="feedback">
        <h2>Feedback recibido</h2>
        <p class="t-body" style="color:var(--text-2);margin-bottom:14px">
          Mensajes enviados con <code>/feedback</code>, <code>/bug</code> o <code>/idea</code> desde WhatsApp.
        </p>
        <div class="card">
          <table id="recent-feedback">
            <thead><tr><th>Cuándo</th><th>Tipo</th><th>Usuario</th><th>Mensaje</th></tr></thead>
            <tbody><tr><td colspan="4" class="empty">Cargando…</td></tr></tbody>
          </table>
        </div>
      </section>

    </main>
  </div>

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

    // ── Sidebar nav ──
    const titles = { overview: "Overview", errors: "Errores", users: "Usuarios", feedback: "Feedback" };
    let feedbackLoaded = false;
    function activateSection(name) {
      if (!titles[name]) name = "overview";
      document.querySelectorAll('.nav-item[data-section]').forEach(b => {
        b.classList.toggle('active', b.dataset.section === name);
      });
      document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('active', p.dataset.section === name);
      });
      document.getElementById('topbar-title').textContent = titles[name];
      try { localStorage.setItem('luanna_admin_section', name); } catch (e) {}
      // close menu on mobile after navigation
      document.body.classList.remove('menu-open');
      if (name === "feedback" && !feedbackLoaded) {
        feedbackLoaded = true;
        loadFeedback();
      }
    }
    document.querySelectorAll('.nav-item[data-section]').forEach(b => {
      b.addEventListener('click', () => activateSection(b.dataset.section));
    });
    const initialSection = (() => {
      try { return localStorage.getItem('luanna_admin_section') || 'overview'; } catch (e) { return 'overview'; }
    })();
    activateSection(initialSection);

    // ── Toggle: desktop collapses, mobile slides out ──
    const isMobile = () => window.matchMedia('(max-width: 720px)').matches;
    function setCollapsed(v) {
      document.body.classList.toggle('collapsed', v);
      try { localStorage.setItem('luanna_admin_collapsed', v ? '1' : '0'); } catch (e) {}
    }
    if (!isMobile()) {
      try {
        if (localStorage.getItem('luanna_admin_collapsed') === '1') setCollapsed(true);
      } catch (e) {}
    }
    document.getElementById('toggle-btn').addEventListener('click', () => {
      if (isMobile()) {
        document.body.classList.toggle('menu-open');
      } else {
        setCollapsed(!document.body.classList.contains('collapsed'));
      }
    });
    document.getElementById('scrim').addEventListener('click', () => {
      document.body.classList.remove('menu-open');
    });

    async function load() {
      try {
        const res = await fetch('/admin/dashboard.json', { credentials: 'include' });
        if (res.status === 401) { window.location.href = '/admin/login'; return; }
        if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
        const data = await res.json();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('err-banner').style.display = 'none';
        const stamp = new Date().toLocaleTimeString();
        document.getElementById('updated-badge').textContent = 'actualizado ' + stamp;
        document.getElementById('updated-text').textContent = 'actualizado ' + stamp;

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

        document.getElementById('kpi-errors-mini').innerHTML = [
          kpi('Hoy', t.errors, null, t.errors > 5 ? 'bad' : t.errors > 0 ? 'warn' : ''),
          kpi('Contextos 24h', (data.errors_by_context_24h || []).length),
          kpi('Webhooks dup', '—', 'placeholder'),
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
    async function loadFeedback() {
      const tbody = document.querySelector('#recent-feedback tbody');
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Cargando…</td></tr>';
      try {
        const res = await fetch('/admin/feedback/recent?limit=100', { credentials: 'include' });
        if (res.status === 401) { window.location.href = '/admin/login'; return; }
        if (!res.ok) throw new Error(res.status + '');
        const data = await res.json();
        const rows = data.feedback || [];
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty">Sin feedback aún</td></tr>';
          return;
        }
        tbody.innerHTML = rows.map(r =>
          '<tr>' +
          '<td><span class="ago">' + ago(r.created_at) + '</span></td>' +
          '<td><span class="ctx-pill">' + esc(r.kind) + '</span></td>' +
          '<td>' + esc(r.phone ? r.phone.slice(0, 14) : '—') + '</td>' +
          '<td><span class="row-msg">' + esc(r.text) + '</span></td>' +
          '</tr>'
        ).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Error: ' + esc(err.message || err) + '</td></tr>';
      }
    }

    document.getElementById('refresh-btn').addEventListener('click', () => {
      load();
      if (document.querySelector('.panel[data-section="feedback"]').classList.contains('active')) {
        loadFeedback();
      }
    });
    load();
    // If user landed directly on the feedback tab (via localStorage), load it.
    if (initialSection === 'feedback') loadFeedback();
  </script>
</body>
</html>`;
}
