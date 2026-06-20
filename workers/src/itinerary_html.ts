// Renders a stored Itinerary to a self-contained HTML document. This is the
// single source of truth for BOTH the shareable web view (/trip/:slug) and the
// PDF export (Browser Rendering prints this same page with ?print=1). Inline
// CSS only — no external assets — so Browser Rendering needs zero network for
// styling and the page is fully portable. All LLM/user text is HTML-escaped.
import {
  googleMapsTripUrl,
  googleMapsUrl,
  orderedPlaces,
  type Itinerary,
} from "./itinerary";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ratingDots(rating?: number): string {
  if (!rating) return "";
  const full = "●".repeat(rating);
  const empty = "○".repeat(5 - rating);
  return `<span class="rating">${full}<span class="rating-empty">${empty}</span></span>`;
}

function placeCard(
  place: Itinerary["parts"][number]["days"][number]["places"][number],
  n: number,
): string {
  const photo = place.photo
    ? `<div class="place-photo" style="background-image:url('${esc(place.photo)}')"></div>`
    : `<div class="place-photo place-photo--empty">📍</div>`;
  const meta: string[] = [];
  if (place.category) meta.push(esc(place.category));
  if (place.time) meta.push(esc(place.time));
  const tips =
    place.tips.length > 0
      ? `<ul class="tips">${place.tips
          .map((t) => `<li>💡 ${esc(t)}</li>`)
          .join("")}</ul>`
      : "";
  return `
    <div class="place">
      ${photo}
      <div class="place-body">
        <div class="place-head">
          <span class="pin">${n}</span>
          <a class="place-name" href="${googleMapsUrl(place.maps_query ?? place.name)}" target="_blank" rel="noopener">${esc(place.name)}</a>
          ${ratingDots(place.rating)}
        </div>
        ${meta.length ? `<div class="place-meta">${meta.join(" · ")}</div>` : ""}
        ${place.description ? `<p class="place-desc">${esc(place.description)}</p>` : ""}
        ${tips}
      </div>
    </div>`;
}

export function renderItineraryHtml(
  it: Itinerary,
  opts: { baseUrl: string; slug: string; print?: boolean },
): string {
  const ordered = orderedPlaces(it);
  let pinCounter = 0;

  const daysHtml = it.parts
    .map((part) => {
      const partHeader =
        part.title || part.subtitle
          ? `<div class="part-header">
               ${part.title ? `<h2>${esc(part.title)}</h2>` : ""}
               ${part.subtitle ? `<p>${esc(part.subtitle)}</p>` : ""}
             </div>`
          : "";
      const days = part.days
        .map((day) => {
          const places = day.places
            .map((p) => placeCard(p, ++pinCounter))
            .join("");
          const footer: string[] = [];
          if (day.meals) footer.push(`🍽️ ${esc(day.meals)}`);
          if (day.hotel) footer.push(`🏨 ${esc(day.hotel)}`);
          const notes =
            day.notes.length > 0
              ? `<ul class="day-notes">${day.notes
                  .map((nn) => `<li>${esc(nn)}</li>`)
                  .join("")}</ul>`
              : "";
          return `
            <section class="day">
              <div class="day-head">
                <span class="day-num">Día ${day.number}</span>
                <h3>${esc(day.title)}</h3>
              </div>
              ${day.header ? `<div class="day-sub">${esc(day.header)}</div>` : ""}
              <div class="places">${places}</div>
              ${notes}
              ${footer.length ? `<div class="day-footer">${footer.join(" &nbsp;·&nbsp; ")}</div>` : ""}
            </section>`;
        })
        .join("");
      return `<div class="part">${partHeader}${days}</div>`;
    })
    .join("");

  const summaryHtml =
    it.summary.length > 0
      ? `<section class="summary card">
           <h2>Resumen</h2>
           <dl>${it.summary
             .map(
               (r) =>
                 `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`,
             )
             .join("")}</dl>
         </section>`
      : "";

  const mapHtml =
    ordered.length > 0
      ? `<section class="map card">
           <h2>Mapa del viaje · ${ordered.length} lugares</h2>
           <a class="map-cta" href="${googleMapsTripUrl(ordered)}" target="_blank" rel="noopener">🗺️ Abrir ruta en Google Maps</a>
           <ol class="map-list">${ordered
             .map(
               (p) =>
                 `<li><a href="${googleMapsUrl(p.maps_query)}" target="_blank" rel="noopener">${esc(p.name)}</a> <span class="map-day">Día ${p.day}</span></li>`,
             )
             .join("")}</ol>
         </section>`
      : "";

  const budgetHtml = it.budget
    ? `<section class="budget card">
         <h2>Presupuesto</h2>
         ${it.budget.intro ? `<p>${esc(it.budget.intro)}</p>` : ""}
         <table>${it.budget.rows
           .map(
             (r) =>
               `<tr><td>${esc(r.label)}</td><td class="amount">${esc(r.value)}</td></tr>`,
           )
           .join("")}${
             it.budget.total
               ? `<tr class="total"><td>Total</td><td class="amount">${esc(it.budget.total)}</td></tr>`
               : ""
           }</table>
       </section>`
    : "";

  const notesHtml =
    it.notes.length > 0
      ? `<section class="notes card"><h2>Notas</h2><ul>${it.notes
          .map((n) => `<li>${esc(n)}</li>`)
          .join("")}</ul></section>`
      : "";

  const chips =
    it.style.length > 0
      ? `<div class="chips">${it.style
          .map((s) => `<span class="chip">${esc(s)}</span>`)
          .join("")}</div>`
      : "";

  const pdfUrl = `${opts.baseUrl}/trip/${opts.slug}.pdf`;
  const exportBar = opts.print
    ? ""
    : `<div class="bar">
         <span class="brand">Luanna ✈️</span>
         <a class="btn" href="${pdfUrl}">⬇️ Exportar PDF</a>
       </div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(it.title)}</title>
<style>
  :root { --ink:#1d2433; --muted:#6b7587; --line:#e7eaf0; --brand:#0ea5a4; --bg:#f6f8fb; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  a { color:inherit; }
  .bar { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; padding:12px 20px; background:#fff; border-bottom:1px solid var(--line); }
  .brand { font-weight:700; color:var(--brand); }
  .btn { background:var(--brand); color:#fff; text-decoration:none; padding:9px 16px; border-radius:10px; font-weight:600; font-size:14px; }
  .wrap { max-width:820px; margin:0 auto; padding:24px 20px 64px; }
  .cover { text-align:center; padding:40px 0 24px; border-bottom:1px solid var(--line); margin-bottom:24px; }
  .cover h1 { font-size:34px; margin:0 0 6px; line-height:1.15; }
  .cover .sub { color:var(--muted); font-size:17px; margin:0 0 4px; }
  .cover .route { color:var(--brand); font-weight:600; margin-top:10px; }
  .chips { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:14px; }
  .chip { background:#e8f7f7; color:#0b7d7c; border-radius:999px; padding:4px 12px; font-size:13px; font-weight:600; }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 22px; margin:0 0 22px; }
  .card h2 { font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:0 0 14px; }
  .summary dl { display:grid; grid-template-columns:1fr 1fr; gap:10px 22px; margin:0; }
  .summary dt { font-size:12px; color:var(--muted); }
  .summary dd { margin:0; font-weight:600; }
  .map-cta { display:inline-block; background:#eef6ff; color:#1d4ed8; padding:8px 14px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px; margin-bottom:12px; }
  .map-list { margin:0; padding-left:22px; columns:2; column-gap:28px; }
  .map-list li { margin:4px 0; break-inside:avoid; }
  .map-day { color:var(--muted); font-size:12px; }
  .part-header { margin:28px 0 12px; }
  .part-header h2 { font-size:20px; color:var(--ink); text-transform:none; letter-spacing:0; margin:0; }
  .part-header p { color:var(--muted); margin:4px 0 0; }
  .day { background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 20px; margin:0 0 18px; break-inside:avoid; }
  .day-head { display:flex; align-items:baseline; gap:10px; }
  .day-num { background:var(--brand); color:#fff; font-weight:700; font-size:12px; padding:3px 10px; border-radius:999px; white-space:nowrap; }
  .day-head h3 { margin:0; font-size:19px; }
  .day-sub { color:var(--muted); font-size:13px; margin:6px 0 14px; }
  .places { display:flex; flex-direction:column; gap:14px; }
  .place { display:flex; gap:14px; }
  .place-photo { flex:0 0 96px; width:96px; height:96px; border-radius:12px; background-size:cover; background-position:center; background-color:#eef1f6; }
  .place-photo--empty { display:flex; align-items:center; justify-content:center; font-size:28px; }
  .place-body { flex:1; min-width:0; }
  .place-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .pin { background:#eef1f6; color:var(--muted); font-weight:700; font-size:12px; min-width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
  .place-name { font-weight:700; text-decoration:none; }
  .rating { color:var(--brand); font-size:12px; letter-spacing:1px; }
  .rating-empty { color:var(--line); }
  .place-meta { color:var(--muted); font-size:13px; margin-top:2px; }
  .place-desc { margin:6px 0 4px; font-size:14px; line-height:1.5; }
  .tips { margin:6px 0 0; padding-left:18px; }
  .tips li, .day-notes li { font-size:13px; color:#444c5e; margin:2px 0; }
  .day-footer { margin-top:14px; padding-top:12px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
  .budget table { width:100%; border-collapse:collapse; }
  .budget td { padding:7px 0; border-bottom:1px solid var(--line); font-size:14px; }
  .budget .amount { text-align:right; font-weight:600; }
  .budget .total td { border-bottom:none; border-top:2px solid var(--ink); font-weight:700; }
  .foot { text-align:center; color:var(--muted); font-size:12px; margin-top:30px; }
  @media (max-width:560px){ .summary dl{grid-template-columns:1fr;} .map-list{columns:1;} .cover h1{font-size:26px;} }
  @media print {
    body { background:#fff; }
    .bar { display:none; }
    .wrap { max-width:none; padding:0; }
    .card, .day { box-shadow:none; }
    .part { break-before:page; }
    .part:first-child { break-before:auto; }
    @page { size:A4; margin:14mm; }
  }
</style>
</head>
<body>
  ${exportBar}
  <div class="wrap">
    <header class="cover">
      <h1>${esc(it.title)}</h1>
      ${it.subtitle ? `<p class="sub">${esc(it.subtitle)}</p>` : ""}
      <p class="sub">${esc(String(it.total_days))} días${it.dates_label ? ` · ${esc(it.dates_label)}` : ""}</p>
      ${it.route_label ? `<p class="route">${esc(it.route_label)}</p>` : ""}
      ${chips}
    </header>
    ${summaryHtml}
    ${mapHtml}
    ${daysHtml}
    ${budgetHtml}
    ${notesHtml}
    <p class="foot">Generado por Luanna ✈️ · luanna.app</p>
  </div>
</body>
</html>`;
}
