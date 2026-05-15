export function renderPreferencesPage(token: string): string {
  const safeToken = token.replace(/[^A-Za-z0-9._-]/g, "");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>Mis preferencias · Luanna</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="theme-color" content="#ff385c" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --rausch: #ff385c;
    --rausch-dark: #e00b41;
    --text: #222222;
    --text-2: #6a6a6a;
    --text-3: #929292;
    --bg: #ffffff;
    --surface: #f7f7f7;
    --surface-2: #f2f2f2;
    --border: rgba(0, 0, 0, 0.08);
    --border-strong: rgba(0, 0, 0, 0.18);
    --shadow-card: rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px, rgba(0,0,0,.1) 0 4px 8px;
    --shadow-hover: rgba(0,0,0,.08) 0 4px 12px;
    --r-btn: 8px;
    --r-card: 20px;
    --r-pill: 999px;
    --font: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: var(--font);
    font-weight: 500;
    color: var(--text);
    background: var(--bg);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    padding-bottom: 32px;
  }
  header {
    position: sticky; top: 0; z-index: 20;
    background: rgba(255,255,255,.95);
    backdrop-filter: saturate(180%) blur(10px);
    border-bottom: 1px solid var(--border);
  }
  .nav {
    max-width: 720px; margin: 0 auto;
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo {
    font-size: 22px; font-weight: 700;
    color: var(--rausch); letter-spacing: -0.5px;
    text-decoration: none;
  }
  .logo span { color: var(--text); }
  .phone-pill {
    font-size: 12px; font-weight: 600;
    color: var(--text-2);
    background: var(--surface-2);
    padding: 6px 10px;
    border-radius: var(--r-pill);
  }

  main { max-width: 720px; margin: 0 auto; padding: 24px 20px 16px; }

  .greet {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--r-card);
    padding: 20px;
    box-shadow: var(--shadow-card);
    margin-bottom: 20px;
  }
  .greet-label {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.4px; text-transform: uppercase;
    color: var(--rausch);
    margin-bottom: 6px;
  }
  .greet h1 {
    font-size: 22px; font-weight: 700;
    letter-spacing: -0.4px; line-height: 1.2;
    margin-bottom: 14px;
  }

  input.text,
  select.text,
  .tag-input input {
    font-family: var(--font);
    font-size: 15px; font-weight: 500;
    color: var(--text);
    background: #fff;
    border: 1px solid var(--border-strong);
    border-radius: var(--r-btn);
    padding: 11px 13px;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
    width: 100%;
  }
  input.text:focus,
  select.text:focus {
    border-color: var(--rausch);
    box-shadow: 0 0 0 3px rgba(255, 56, 92, .12);
  }

  .tabs {
    display: flex; gap: 6px;
    background: var(--surface-2);
    padding: 4px;
    border-radius: var(--r-pill);
    margin-bottom: 18px;
  }
  .tab {
    flex: 1;
    text-align: center;
    padding: 10px 14px;
    border: none; background: transparent;
    font-family: var(--font);
    font-size: 14px; font-weight: 600;
    color: var(--text-2);
    border-radius: var(--r-pill);
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
  }
  .tab.active {
    background: var(--rausch);
    color: #fff;
    box-shadow: 0 2px 6px rgba(255,56,92,.25);
  }

  .panel { display: none; animation: fade .25s ease-out; }
  .panel.active { display: block; }
  .tab-intro {
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-2);
    background: var(--surface);
    border-left: 3px solid var(--rausch);
    padding: 12px 14px;
    border-radius: 0 10px 10px 0;
    margin-bottom: 18px;
  }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  .field { margin-bottom: 16px; }
  .field-label {
    display: block;
    font-size: 13px; font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }
  .field-hint {
    font-size: 12px; color: var(--text-3);
    margin-top: 4px;
  }

  .ac-wrap { position: relative; }
  .ac-list {
    position: absolute; left: 0; right: 0; top: 100%;
    margin-top: 4px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    max-height: 240px; overflow-y: auto;
    z-index: 5;
    display: none;
  }
  .ac-list.open { display: block; }
  .ac-item {
    padding: 10px 14px;
    cursor: pointer;
    display: flex; align-items: baseline; gap: 8px;
    border-bottom: 1px solid var(--border);
  }
  .ac-item:last-child { border-bottom: none; }
  .ac-item:hover, .ac-item.active { background: var(--surface); }
  .ac-item-name { font-size: 14px; font-weight: 600; color: var(--text); }
  .ac-item-meta { font-size: 12px; color: var(--text-3); margin-left: auto; }

  .tag-input {
    border: 1px solid var(--border-strong);
    border-radius: var(--r-btn);
    padding: 6px 8px;
    background: #fff;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex; flex-wrap: wrap; gap: 6px;
    align-items: center;
    min-height: 46px;
  }
  .tag-input:focus-within {
    border-color: var(--rausch);
    box-shadow: 0 0 0 3px rgba(255, 56, 92, .12);
  }
  .tag-input input {
    border: none; outline: none; padding: 6px;
    flex: 1; min-width: 100px;
    font-size: 15px;
  }
  #interest-tags-inline { display: contents; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 8px 6px 12px;
    background: rgba(255,56,92,.10);
    color: var(--rausch);
    font-size: 13px; font-weight: 600;
    border-radius: var(--r-pill);
    animation: chipIn .22s ease-out;
  }
  @keyframes chipIn { from { transform: scale(.85); opacity: 0; } to { transform: none; opacity: 1; } }
  .chip button {
    border: none; background: rgba(255,56,92,.15);
    color: var(--rausch);
    width: 18px; height: 18px;
    border-radius: 50%; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; line-height: 1;
    transition: background .15s;
  }
  .chip button:hover { background: var(--rausch); color: #fff; }

  .row-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 10px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px;
    animation: chipIn .22s ease-out;
  }
  .row-card-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .row-title { font-size: 15px; font-weight: 700; color: var(--text); }
  .row-sub { font-size: 12px; color: var(--text-2); }
  .row-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .icon-btn {
    width: 32px; height: 32px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
    color: var(--text-2);
    cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all .15s;
  }
  .icon-btn:hover { color: var(--rausch); border-color: var(--rausch); }

  .form-card {
    background: var(--surface);
    border-radius: var(--r-card);
    padding: 18px;
    margin-bottom: 18px;
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: 6px;
    padding: 12px 18px;
    font-family: var(--font);
    font-size: 14px; font-weight: 600;
    border-radius: var(--r-btn);
    border: none; cursor: pointer;
    transition: all .15s;
    width: 100%;
  }
  .referral-card {
    background: var(--surface);
    border-radius: var(--r-card);
    padding: 16px;
    margin-bottom: 18px;
  }
  .referral-blurb {
    font-size: 13px;
    color: var(--text-2);
    margin-bottom: 12px;
    line-height: 1.45;
  }
  .referral-row {
    display: flex; gap: 8px; align-items: stretch;
  }
  .referral-row input.text { flex: 1; font-size: 13px; }
  .referral-row .btn { width: auto; padding: 0 16px; }
  .name-row {
    display: flex; gap: 8px; align-items: stretch;
  }
  .name-row input.text { flex: 1; }
  .name-save {
    width: auto; flex-shrink: 0;
    padding: 0 18px;
  }
  .name-save.saved {
    background: rgba(0, 168, 126, 0.12);
    color: #00a87e;
  }
  .name-save.saved:hover { background: rgba(0, 168, 126, 0.18); }
  .btn-primary { background: var(--rausch); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--rausch-dark); }
  .btn-primary:disabled { background: var(--text-3); cursor: not-allowed; opacity: .7; }

  .toast {
    position: fixed; left: 50%; bottom: 24px;
    transform: translateX(-50%) translateY(60px);
    background: var(--text); color: #fff;
    font-size: 13px; font-weight: 600;
    padding: 10px 16px;
    border-radius: var(--r-pill);
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    opacity: 0; transition: all .2s ease;
    z-index: 50;
    pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  .empty {
    text-align: center;
    padding: 24px 16px;
    color: var(--text-3);
    font-size: 13px;
  }

  .section-title {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.32px; text-transform: uppercase;
    color: var(--rausch);
    margin: 22px 0 10px;
  }

  @media (max-width: 540px) {
    .nav { padding: 12px 16px; }
    main { padding: 18px 16px; }
    .greet { padding: 16px; }
  }
</style>
</head>
<body>

  <header>
    <div class="nav">
      <a href="/" class="logo">luanna<span>.</span></a>
      <span class="phone-pill" id="phone-display">—</span>
    </div>
  </header>

  <main>
    <section class="greet">
      <div class="greet-label">Tu perfil</div>
      <h1 id="greet-title">Hola 👋</h1>
      <div class="field" style="margin-bottom:0">
        <label class="field-label" for="name-input">¿Cómo quieres que te llame?</label>
        <div class="name-row">
          <input id="name-input" class="text" type="text" placeholder="Jean, María, Alex…" maxlength="80" autocomplete="off" />
          <button class="btn btn-primary name-save" id="name-save" type="button" disabled>Guardar</button>
        </div>
        <div class="field-hint" id="name-hint" style="display:none">
          ✓ Listo, Luanna ya no te volverá a preguntar el nombre.
        </div>
      </div>
    </section>

    <div class="tabs" role="tablist">
      <button class="tab active" data-tab="prefs" role="tab" aria-selected="true">Mis preferencias</button>
      <button class="tab" data-tab="alerts" role="tab" aria-selected="false">Alertas</button>
    </div>

    <section class="panel active" id="panel-prefs" role="tabpanel">
      <p class="tab-intro">
        Cuéntale a Luanna desde <strong>dónde viajas y los destinos que te interesan.</strong>
        Así te recomienda vuelos y hoteles que realmente encajan contigo. ✨
      </p>
      <div class="field">
        <label class="field-label" for="origin-input">¿De dónde viajas?</label>
        <div class="ac-wrap">
          <input id="origin-input" class="text" type="text" placeholder="Lima, Madrid, Buenos Aires…" autocomplete="off" />
          <div class="ac-list" id="origin-ac"></div>
        </div>
        <div class="field-hint">Buscamos en aeropuertos de todo el mundo.</div>
      </div>

      <div class="field">
        <label class="field-label" for="currency-select">Moneda</label>
        <select id="currency-select" class="text"></select>
        <div class="field-hint">Se ajusta automáticamente a tu país de origen.</div>
      </div>

      <div class="field">
        <label class="field-label" for="interest-input">Países o ciudades que te interesan</label>
        <div class="tag-input ac-wrap" id="interest-wrap">
          <div id="interest-tags-inline"></div>
          <input id="interest-input" type="text" placeholder="Escribe un destino y elige de la lista…" autocomplete="off" />
          <div class="ac-list" id="interest-ac"></div>
        </div>
        <div class="field-hint">Toca la X de cualquier destino para quitarlo.</div>
      </div>

      <div class="section-title" id="saved-prefs-label" style="display:none">Destinos guardados</div>
      <div id="saved-prefs"></div>

      <div class="section-title" id="referral-label" style="display:none">Invita a alguien</div>
      <div class="referral-card" id="referral-card" style="display:none">
        <p class="referral-blurb">
          Compártele Luanna a un amigo con este link. Cuando se suscriba,
          ambos seguimos haciendo a esta agente más inteligente 🙌
        </p>
        <div class="referral-row">
          <input id="referral-url" class="text" readonly />
          <button class="btn btn-primary" id="referral-copy" type="button">Copiar</button>
        </div>
        <p class="field-hint" id="referral-count" style="margin-top:8px"></p>
      </div>
    </section>

    <section class="panel" id="panel-alerts" role="tabpanel">
      <p class="tab-intro">
        Crea alertas para que Luanna <strong>te avise por WhatsApp cuando haya precios buenos
        en las rutas que te interesan</strong>. Las revisa según la frecuencia que elijas. 🔔
      </p>
      <div class="form-card">
        <div class="field">
          <label class="field-label" for="alert-origin">Origen</label>
          <div class="ac-wrap">
            <input id="alert-origin" class="text" type="text" placeholder="Ciudad de salida" autocomplete="off" />
            <div class="ac-list" id="alert-origin-ac"></div>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="alert-dest">Destino</label>
          <div class="ac-wrap">
            <input id="alert-dest" class="text" type="text" placeholder="¿A dónde quieres ir?" autocomplete="off" />
            <div class="ac-list" id="alert-dest-ac"></div>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="alert-freq">Frecuencia de aviso</label>
          <select id="alert-freq" class="text">
            <option value="3">Cada 3 días</option>
            <option value="7" selected>Cada 7 días</option>
            <option value="14">Cada 14 días</option>
            <option value="30">Cada 30 días</option>
          </select>
        </div>
        <button class="btn btn-primary" id="alert-create" disabled>Crear alerta</button>
      </div>

      <div class="section-title" id="alerts-label" style="display:none">Alertas activas</div>
      <div id="alerts-list"></div>
    </section>
  </main>

  <div class="toast" id="toast"></div>

  <script>
    const TOKEN = ${JSON.stringify(safeToken)};
    const QS = "?token=" + encodeURIComponent(TOKEN);

    let PLACES = { cities: [], countries: [], currencies: [] };

    const state = {
      name: null,
      phone: null,
      origin: null,
      interests: [],
      currency: "USD",
      alerts: [],
      alertOriginPick: null,
      alertDestPick: null,
    };

    let toastTimer;
    function toast(msg) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1800);
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
      });
    }

    async function api(path, init) {
      const sep = path.indexOf("?") >= 0 ? "&" : "?";
      const url = path + sep + "token=" + encodeURIComponent(TOKEN);
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.text().catch(function () { return ""; });
        const err = new Error(res.status + " " + path + ": " + body.slice(0, 200));
        err.status = res.status;
        err.path = path;
        err.body = body;
        throw err;
      }
      return res.json();
    }

    function explainError(e) {
      if (e && e.status === 401) {
        return "⚠️ Tu link expiró. Vuelve al chat y pídele a Luanna que te lo mande de nuevo.";
      }
      if (e && e.status === 413) return "⚠️ Texto demasiado largo.";
      if (e && e.status === 429) return "⚠️ Mucho movimiento, espera un momento e intenta otra vez.";
      if (e && e.status === 400) return "⚠️ Datos inválidos. Revisa los campos.";
      if (e && typeof e.status === "number") return "⚠️ Error " + e.status + ", reintentando…";
      return "⚠️ Sin conexión. Verifica tu internet.";
    }

    async function searchPlaces(term, type) {
      const trimmed = term.trim();
      if (trimmed.length < 2) return [];
      const url = new URL("https://autocomplete.travelpayouts.com/places2");
      url.searchParams.set("term", trimmed);
      url.searchParams.set("locale", "es");
      url.searchParams.append("types[]", type || "city");
      try {
        const res = await fetch(url.toString());
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data.slice(0, 8) : [];
      } catch (e) { return []; }
    }

    function bindAutocomplete(inputEl, listEl, opts) {
      let activeIdx = -1;
      let results = [];
      let timer;

      function renderList() {
        if (results.length === 0) {
          listEl.classList.remove("open");
          listEl.innerHTML = "";
          return;
        }
        listEl.innerHTML = results.map(function (r, i) {
          const meta = (r.country_name || "") + (r.code ? " · " + r.code : "");
          return '<div class="ac-item' + (i === activeIdx ? " active" : "") + '" data-idx="' + i + '">' +
                 '<div class="ac-item-name">' + escapeHtml(r.name || "") + '</div>' +
                 '<div class="ac-item-meta">' + escapeHtml(meta) + '</div>' +
                 '</div>';
        }).join("");
        listEl.classList.add("open");
      }

      function pick(idx) {
        const r = results[idx];
        if (!r) return;
        opts.onSelect(r, inputEl);
        listEl.classList.remove("open");
        results = []; activeIdx = -1;
      }

      async function refresh() {
        const term = inputEl.value;
        if (term.trim().length < 2) {
          listEl.classList.remove("open");
          listEl.innerHTML = "";
          results = [];
          return;
        }
        results = await searchPlaces(term, opts.type);
        activeIdx = -1;
        renderList();
      }

      inputEl.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(refresh, 180);
      });
      inputEl.addEventListener("blur", function () {
        setTimeout(function () { listEl.classList.remove("open"); }, 150);
      });
      inputEl.addEventListener("focus", function () {
        if (results.length > 0) listEl.classList.add("open");
      });
      inputEl.addEventListener("keydown", function (e) {
        if (!listEl.classList.contains("open") || results.length === 0) return;
        if (e.key === "ArrowDown") { e.preventDefault(); activeIdx = (activeIdx + 1) % results.length; renderList(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = activeIdx <= 0 ? results.length - 1 : activeIdx - 1; renderList(); }
        else if (e.key === "Enter") { e.preventDefault(); pick(activeIdx >= 0 ? activeIdx : 0); }
        else if (e.key === "Escape") { listEl.classList.remove("open"); }
      });
      listEl.addEventListener("mousedown", function (e) {
        const tgt = e.target.closest(".ac-item");
        if (!tgt) return;
        e.preventDefault();
        pick(Number(tgt.dataset.idx));
      });
    }

    function currencyFor(originName) {
      if (!originName || !PLACES) return null;
      const norm = originName.trim().toLowerCase();
      const c = (PLACES.cities || []).find(function (c) { return c.name.toLowerCase() === norm; });
      if (c) return c.currency;
      const co = (PLACES.countries || []).find(function (c) { return c.name.toLowerCase() === norm; });
      if (co) return co.currency;
      return null;
    }

    function populateCurrencies() {
      const sel = document.getElementById("currency-select");
      sel.innerHTML = (PLACES.currencies || []).map(function (c) {
        return '<option value="' + c.code + '">' + escapeHtml(c.label) + '</option>';
      }).join("");
      sel.value = state.currency || "USD";
    }

    function renderSavedPrefs() {
      const container = document.getElementById("saved-prefs");
      const label = document.getElementById("saved-prefs-label");
      const items = state.interests;
      if (items.length === 0) {
        container.innerHTML = '<div class="empty">Sin destinos guardados todavía. Agrega tu primero arriba 👆</div>';
        label.style.display = "none";
      } else {
        label.style.display = "block";
        container.innerHTML = items.map(function (name) {
          return '<div class="row-card"><div class="row-card-main">' +
            '<div class="row-title">' + escapeHtml(name) + '</div>' +
            '</div><div class="row-actions">' +
            '<button class="icon-btn" data-remove="' + encodeURIComponent(name) + '" title="Quitar">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
            '</button></div></div>';
        }).join("");
      }
      // inline chips in input
      const inline = document.getElementById("interest-tags-inline");
      inline.innerHTML = items.map(function (name) {
        return '<span class="chip">' + escapeHtml(name) +
          '<button data-remove-chip="' + encodeURIComponent(name) + '" title="Quitar">×</button>' +
          '</span>';
      }).join("");
    }

    function renderAlerts() {
      const container = document.getElementById("alerts-list");
      const label = document.getElementById("alerts-label");
      if (state.alerts.length === 0) {
        container.innerHTML = '<div class="empty">Sin alertas activas. Crea tu primera con el formulario arriba 👆</div>';
        label.style.display = "none";
        return;
      }
      label.style.display = "block";
      function freqLabel(d) { return d === 1 ? "diario" : "cada " + d + " días"; }
      container.innerHTML = state.alerts.map(function (a) {
        return '<div class="row-card"><div class="row-card-main">' +
          '<div class="row-title">' + escapeHtml(a.origin_iata) + ' → ' + escapeHtml(a.destination_iata || a.destination) + '</div>' +
          '<div class="row-sub">' + freqLabel(a.frequency_days) + '</div>' +
          '</div><div class="row-actions">' +
          '<button class="icon-btn" data-del-alert="' + a.id + '" title="Eliminar alerta">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
          '</button></div></div>';
      }).join("");
    }

    let saveTimer;
    function schedulePrefsSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePrefs, 350);
    }
    async function savePrefs() {
      try {
        await api("/api/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: state.origin,
            countries: state.interests,
            budget_currency: state.currency,
          }),
        });
      } catch (e) { console.error(e); toast(explainError(e)); }
    }

    let nameDirty = false;
    function updateNameSaveBtn() {
      const btn = document.getElementById("name-save");
      const v = document.getElementById("name-input").value.trim();
      const current = state.name || "";
      nameDirty = v !== current;
      btn.disabled = !nameDirty || v.length === 0;
      btn.classList.remove("saved");
      btn.textContent = "Guardar";
    }

    async function saveName() {
      const inp = document.getElementById("name-input");
      const btn = document.getElementById("name-save");
      const v = inp.value.trim();
      if (!v) return;
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        await api("/api/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: v }),
        });
        state.name = v;
        updateGreeting();
        nameDirty = false;
        btn.classList.add("saved");
        btn.textContent = "Guardado ✓";
        document.getElementById("name-hint").style.display = "block";
        toast("Nombre actualizado ✅");
        setTimeout(function () {
          if (!nameDirty) {
            btn.classList.remove("saved");
            btn.textContent = "Guardar";
          }
        }, 2200);
      } catch (e) {
        console.error(e);
        toast(explainError(e));
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    }

    function updateGreeting() {
      document.getElementById("greet-title").textContent =
        state.name ? "Hola " + state.name + " 👋" : "Hola 👋";
    }

    async function loadAlerts() {
      const data = await api("/api/watchlist", {});
      state.alerts = data.items || [];
      renderAlerts();
    }
    async function createAlert() {
      if (!state.alertOriginPick || !state.alertDestPick) return;
      const btn = document.getElementById("alert-create");
      btn.disabled = true;
      try {
        await api("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_iata: state.alertOriginPick.code,
            destination_iata: state.alertDestPick.code,
            destination: state.alertDestPick.name,
            frequency_days: Number(document.getElementById("alert-freq").value),
          }),
        });
        document.getElementById("alert-origin").value = "";
        document.getElementById("alert-dest").value = "";
        state.alertOriginPick = null;
        state.alertDestPick = null;
        await loadAlerts();
        toast("Alerta creada ✅");
      } catch (e) {
        console.error(e); toast(explainError(e));
      } finally {
        updateCreateBtnState();
      }
    }
    async function deleteAlert(id) {
      try {
        await api("/api/watchlist?id=" + id, { method: "DELETE" });
        await loadAlerts();
        toast("Alerta eliminada");
      } catch (e) { console.error(e); toast(explainError(e)); }
    }
    function updateCreateBtnState() {
      const btn = document.getElementById("alert-create");
      btn.disabled = !(state.alertOriginPick && state.alertDestPick);
    }

    async function init() {
      try { PLACES = await (await fetch("/places.json")).json(); }
      catch (e) { console.error("places load failed", e); }

      try {
        const me = await api("/api/me", {});
        state.name = me.name || null;
        state.phone = me.phone || null;
        document.getElementById("name-input").value = state.name || "";
        document.getElementById("phone-display").textContent = state.phone || "Web";
        updateGreeting();
        if (me.referral_code) {
          const refUrl = "https://luanna.app/?ref=" + encodeURIComponent(me.referral_code);
          document.getElementById("referral-url").value = refUrl;
          const count = Number(me.referral_count || 0);
          document.getElementById("referral-count").textContent =
            count === 0
              ? "Aún nadie se sumó con tu link."
              : count === 1
                ? "1 persona se sumó con tu link 🎉"
                : count + " personas se sumaron con tu link 🎉";
          document.getElementById("referral-label").style.display = "block";
          document.getElementById("referral-card").style.display = "block";
          document.getElementById("referral-copy").addEventListener("click", async function () {
            const inp = document.getElementById("referral-url");
            inp.select();
            try {
              await navigator.clipboard.writeText(refUrl);
              toast("Link copiado ✅");
            } catch (e) {
              document.execCommand && document.execCommand("copy");
              toast("Link copiado ✅");
            }
          });
        }
      } catch (e) { console.error("me load failed", e); }

      try {
        const p = await api("/api/prefs", {});
        state.origin = p.origin || null;
        state.interests = Array.isArray(p.countries) ? p.countries : [];
        state.currency = p.budget_currency || "USD";
        document.getElementById("origin-input").value = state.origin || "";
      } catch (e) { console.error("prefs load failed", e); }

      populateCurrencies();
      renderSavedPrefs();

      bindAutocomplete(
        document.getElementById("origin-input"),
        document.getElementById("origin-ac"),
        {
          type: "city",
          onSelect: function (r, inp) {
            const name = r.name;
            inp.value = name;
            state.origin = name;
            const curr = currencyFor(name);
            if (curr) {
              state.currency = curr;
              document.getElementById("currency-select").value = curr;
            }
            schedulePrefsSave();
          },
        }
      );

      bindAutocomplete(
        document.getElementById("interest-input"),
        document.getElementById("interest-ac"),
        {
          type: "city",
          onSelect: function (r, inp) {
            const name = r.name;
            if (state.interests.indexOf(name) === -1) {
              state.interests.push(name);
              renderSavedPrefs();
              schedulePrefsSave();
            }
            inp.value = "";
          },
        }
      );

      bindAutocomplete(
        document.getElementById("alert-origin"),
        document.getElementById("alert-origin-ac"),
        {
          type: "city",
          onSelect: function (r, inp) {
            inp.value = r.name;
            state.alertOriginPick = r;
            updateCreateBtnState();
          },
        }
      );

      bindAutocomplete(
        document.getElementById("alert-dest"),
        document.getElementById("alert-dest-ac"),
        {
          type: "city",
          onSelect: function (r, inp) {
            inp.value = r.name;
            state.alertDestPick = r;
            updateCreateBtnState();
          },
        }
      );

      try { await loadAlerts(); } catch (e) {}

      document.querySelectorAll(".tab").forEach(function (btn) {
        btn.addEventListener("click", function () {
          document.querySelectorAll(".tab").forEach(function (b) {
            b.classList.toggle("active", b === btn);
            b.setAttribute("aria-selected", b === btn ? "true" : "false");
          });
          const target = btn.dataset.tab;
          document.querySelectorAll(".panel").forEach(function (p) {
            p.classList.toggle("active", p.id === "panel-" + target);
          });
        });
      });

      // Name: explicit save button, no blur-autosave. Dirty-tracking enables
      // the button only when the input differs from what's persisted.
      const nameInp = document.getElementById("name-input");
      nameInp.addEventListener("input", updateNameSaveBtn);
      nameInp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (!document.getElementById("name-save").disabled) saveName();
        }
      });
      document.getElementById("name-save").addEventListener("click", saveName);
      // Initialize button state once initial value is loaded
      updateNameSaveBtn();
      // Show "Luanna ya no te pregunta" hint if name was already loaded
      if (state.name) {
        document.getElementById("name-hint").style.display = "block";
      }

      document.getElementById("currency-select").addEventListener("change", function (e) {
        state.currency = e.target.value;
        schedulePrefsSave();
      });

      document.getElementById("origin-input").addEventListener("blur", function (e) {
        if (!e.target.value.trim()) {
          state.origin = null;
          schedulePrefsSave();
        }
      });

      document.body.addEventListener("click", function (e) {
        const removeBtn = e.target.closest("[data-remove]");
        if (removeBtn) {
          const name = decodeURIComponent(removeBtn.dataset.remove);
          state.interests = state.interests.filter(function (n) { return n !== name; });
          renderSavedPrefs();
          schedulePrefsSave();
          return;
        }
        const chipBtn = e.target.closest("[data-remove-chip]");
        if (chipBtn) {
          const name = decodeURIComponent(chipBtn.dataset.removeChip);
          state.interests = state.interests.filter(function (n) { return n !== name; });
          renderSavedPrefs();
          schedulePrefsSave();
          return;
        }
        const delAlert = e.target.closest("[data-del-alert]");
        if (delAlert) {
          if (confirm("¿Eliminar esta alerta?")) deleteAlert(Number(delAlert.dataset.delAlert));
          return;
        }
      });

      document.getElementById("alert-create").addEventListener("click", createAlert);
    }

    init().catch(function (e) { console.error(e); toast("⚠️ Error inicializando"); });
  </script>
</body>
</html>`;
}
