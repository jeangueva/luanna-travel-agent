export function renderPreferencesPage(token: string): string {
  const safeToken = token.replace(/[^A-Za-z0-9._-]/g, "");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Mis preferencias · Luanna</title>
<style>
  :root { --bg: #0b1220; --card: #131c2e; --txt: #e8edf5; --muted: #8b97a8; --accent: #25d366; --border: #243049; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--txt); font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 520px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 22px; margin: 8px 0 4px; }
  p.sub { color: var(--muted); margin: 0 0 24px; }
  fieldset { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin: 0 0 16px; }
  legend { padding: 0 6px; color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .04em; }
  label { display: block; margin: 0 0 6px; font-size: 13px; color: var(--muted); }
  input[type=text], input[type=number] {
    width: 100%; background: #0a1322; color: var(--txt); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px; font-size: 15px;
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .styles { display: flex; flex-wrap: wrap; gap: 8px; }
  .styles label {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px;
    background: #0a1322; border: 1px solid var(--border); border-radius: 999px;
    cursor: pointer; color: var(--txt); font-size: 14px;
  }
  .styles input { accent-color: var(--accent); }
  .help { color: var(--muted); font-size: 12px; margin: 6px 0 0; }
  button {
    width: 100%; background: var(--accent); color: #062a14; border: 0;
    border-radius: 10px; padding: 14px; font-size: 16px; font-weight: 600; cursor: pointer;
    margin-top: 8px;
  }
  button:disabled { opacity: .6; cursor: not-allowed; }
  #status { text-align: center; color: var(--muted); margin: 12px 0 0; min-height: 20px; }
  #status.ok { color: var(--accent); }
  #status.err { color: #ff6b6b; }
</style>
</head>
<body>
<main>
  <h1>Mis preferencias</h1>
  <p class="sub">Luanna usa esto para recomendarte mejor.</p>
  <form id="form">
    <fieldset>
      <legend>Origen</legend>
      <label for="origin">Ciudad desde donde viajas</label>
      <input type="text" id="origin" name="origin" placeholder="Lima, Madrid, CDMX..." />
    </fieldset>

    <fieldset>
      <legend>Destinos</legend>
      <label for="countries">Países que te interesan</label>
      <input type="text" id="countries" name="countries" placeholder="México, España, Portugal" />
      <p class="help">Sepáralos con comas.</p>

      <label for="cities" style="margin-top:12px">Ciudades específicas</label>
      <input type="text" id="cities" name="cities" placeholder="CDMX, Barcelona, Lisboa" />
    </fieldset>

    <fieldset>
      <legend>Presupuesto (por viaje)</legend>
      <div class="row">
        <div>
          <label for="budget_min">Mínimo</label>
          <input type="number" id="budget_min" name="budget_min" min="0" step="50" />
        </div>
        <div>
          <label for="budget_max">Máximo</label>
          <input type="number" id="budget_max" name="budget_max" min="0" step="50" />
        </div>
      </div>
      <label for="budget_currency" style="margin-top:12px">Moneda</label>
      <input type="text" id="budget_currency" name="budget_currency" maxlength="3" placeholder="USD" />
    </fieldset>

    <fieldset>
      <legend>Estilo de viaje</legend>
      <div class="styles" id="styles">
        <label><input type="checkbox" value="aventura" /> Aventura</label>
        <label><input type="checkbox" value="relax" /> Relax</label>
        <label><input type="checkbox" value="cultura" /> Cultura</label>
        <label><input type="checkbox" value="gastronomia" /> Gastronomía</label>
        <label><input type="checkbox" value="naturaleza" /> Naturaleza</label>
        <label><input type="checkbox" value="fiesta" /> Fiesta</label>
      </div>
    </fieldset>

    <button type="submit" id="save">Guardar</button>
    <div id="status"></div>
  </form>

  <h2 style="font-size:18px;margin:32px 0 12px">Mis alertas de precio</h2>
  <p class="sub" style="margin-bottom:12px">Te aviso cuando un vuelo cuesta menos que tu límite.</p>

  <ul id="watchlist" style="list-style:none;padding:0;margin:0 0 16px"></ul>

  <fieldset>
    <legend>Nueva alerta</legend>
    <div class="row">
      <div>
        <label for="w_origin">Origen (IATA)</label>
        <input type="text" id="w_origin" maxlength="3" placeholder="LIM" />
      </div>
      <div>
        <label for="w_dest_iata">Destino (IATA)</label>
        <input type="text" id="w_dest_iata" maxlength="3" placeholder="MAD" />
      </div>
    </div>
    <label for="w_dest" style="margin-top:12px">Nombre del destino</label>
    <input type="text" id="w_dest" placeholder="Madrid" />
    <div class="row" style="margin-top:12px">
      <div>
        <label for="w_max">Precio máx (USD)</label>
        <input type="number" id="w_max" min="50" step="50" placeholder="600" />
      </div>
      <div>
        <label for="w_freq">Cada (días)</label>
        <input type="number" id="w_freq" min="1" max="30" value="7" />
      </div>
    </div>
    <button type="button" id="w_add">Agregar alerta</button>
    <div id="w_status"></div>
  </fieldset>
</main>
<script>
  const TOKEN = ${JSON.stringify(safeToken)};
  const $ = (id) => document.getElementById(id);
  const status = $("status");

  function parseList(s) {
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  function readStyles() {
    return [...document.querySelectorAll("#styles input:checked")].map((el) => el.value);
  }
  function fillStyles(values) {
    const set = new Set(values || []);
    document.querySelectorAll("#styles input").forEach((el) => { el.checked = set.has(el.value); });
  }
  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = kind || "";
  }

  async function load() {
    try {
      const r = await fetch("/api/prefs?token=" + encodeURIComponent(TOKEN));
      if (!r.ok) throw new Error(await r.text());
      const p = await r.json();
      $("origin").value = p.origin || "";
      $("countries").value = (p.countries || []).join(", ");
      $("cities").value = (p.cities || []).join(", ");
      $("budget_min").value = p.budget_min ?? "";
      $("budget_max").value = p.budget_max ?? "";
      $("budget_currency").value = p.budget_currency || "USD";
      fillStyles(p.styles);
    } catch (e) {
      setStatus("No pude cargar tus preferencias: " + e.message, "err");
    }
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("save").disabled = true;
    setStatus("Guardando...");
    try {
      const body = {
        origin: $("origin").value.trim() || null,
        countries: parseList($("countries").value),
        cities: parseList($("cities").value),
        styles: readStyles(),
        budget_min: $("budget_min").value ? Number($("budget_min").value) : null,
        budget_max: $("budget_max").value ? Number($("budget_max").value) : null,
        budget_currency: ($("budget_currency").value.trim() || "USD").toUpperCase(),
      };
      const r = await fetch("/api/prefs?token=" + encodeURIComponent(TOKEN), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      setStatus("Guardado ✓", "ok");
    } catch (e) {
      setStatus("Error: " + e.message, "err");
    } finally {
      $("save").disabled = false;
    }
  });

  load();

  const wStatus = $("w_status");
  function setWStatus(msg, kind) {
    wStatus.textContent = msg;
    wStatus.className = kind || "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function loadWatchlist() {
    try {
      const r = await fetch("/api/watchlist?token=" + encodeURIComponent(TOKEN));
      if (!r.ok) throw new Error(await r.text());
      const { items } = await r.json();
      const ul = $("watchlist");
      if (!items.length) {
        ul.innerHTML = '<li style="color:var(--muted);padding:12px 0">Aún no tienes alertas.</li>';
        return;
      }
      ul.innerHTML = items.map((it) => {
        const route = (it.origin_iata || "?") + " → " + (it.destination_iata || "?");
        const last = it.last_notified_at
          ? "Notificado: " + new Date(it.last_notified_at).toLocaleDateString()
          : "Sin notificaciones aún";
        return '<li style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
          '<div><div style="font-weight:600">' + escapeHtml(it.destination) + ' (' + escapeHtml(route) + ')</div>' +
          '<div style="color:var(--muted);font-size:13px;margin-top:2px">Máx $' + it.max_price + ' · cada ' + it.frequency_days + ' días · ' + escapeHtml(last) + '</div></div>' +
          '<button type="button" data-id="' + it.id + '" class="del" style="width:auto;background:transparent;color:#ff6b6b;border:1px solid var(--border);padding:8px 12px;font-size:13px;font-weight:500;margin:0">Quitar</button>' +
          '</li>';
      }).join("");
      ul.querySelectorAll(".del").forEach((btn) => {
        btn.addEventListener("click", () => removeWatch(btn.dataset.id));
      });
    } catch (e) {
      $("watchlist").innerHTML = '<li style="color:#ff6b6b">Error: ' + escapeHtml(e.message) + '</li>';
    }
  }

  async function removeWatch(id) {
    if (!confirm("¿Quitar esta alerta?")) return;
    try {
      const r = await fetch("/api/watchlist?token=" + encodeURIComponent(TOKEN) + "&id=" + id, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      await loadWatchlist();
    } catch (e) {
      setWStatus("Error: " + e.message, "err");
    }
  }

  $("w_add").addEventListener("click", async () => {
    const origin_iata = $("w_origin").value.trim().toUpperCase();
    const destination_iata = $("w_dest_iata").value.trim().toUpperCase();
    const destination = $("w_dest").value.trim();
    const max_price_usd = Number($("w_max").value);
    const frequency_days = Number($("w_freq").value) || 7;
    if (origin_iata.length !== 3 || destination_iata.length !== 3 || !destination || !max_price_usd) {
      setWStatus("Completa los 4 campos (IATA 3 letras + destino + precio).", "err");
      return;
    }
    setWStatus("Agregando...");
    try {
      const r = await fetch("/api/watchlist?token=" + encodeURIComponent(TOKEN), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin_iata, destination_iata, destination, max_price_usd, frequency_days }),
      });
      if (!r.ok) throw new Error(await r.text());
      $("w_origin").value = "";
      $("w_dest_iata").value = "";
      $("w_dest").value = "";
      $("w_max").value = "";
      setWStatus("Agregada ✓", "ok");
      await loadWatchlist();
    } catch (e) {
      setWStatus("Error: " + e.message, "err");
    }
  });

  loadWatchlist();
</script>
</body>
</html>`;
}
