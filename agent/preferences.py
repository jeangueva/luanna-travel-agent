"""
Webview for user preferences (countries + cities + travel style).
Served as HTML form with JSON API backend.
"""

import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse

from agent.memory import get_user_by_token, save_user_preferences, get_user_preferences

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent / "data"


def load_json(filename: str) -> list:
    with open(DATA_DIR / filename, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/api/suggestions/countries")
async def suggestions_countries():
    return JSONResponse(load_json("countries.json"))


@router.get("/api/suggestions/cities")
async def suggestions_cities(q: str = ""):
    cities = load_json("cities.json")
    if q:
        q_lower = q.lower()
        cities = [c for c in cities if q_lower in c["name"].lower() or q_lower in c["country"].lower()]
    return JSONResponse(cities[:50])


@router.get("/api/preferences/{token}")
async def api_get_preferences(token: str):
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    prefs = get_user_preferences(user["id"])
    return JSONResponse(prefs)


@router.post("/api/preferences/{token}")
async def api_save_preferences(token: str, request: Request):
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    body = await request.json()
    countries = body.get("countries", [])
    cities = body.get("cities", [])
    budget = body.get("budget")
    styles = body.get("styles", [])
    origin = body.get("origin")

    save_user_preferences(
        user_id=user["id"],
        countries=countries,
        cities=cities,
        budget=budget,
        styles=styles,
        origin=origin,
    )
    return JSONResponse({"ok": True, "saved": {"countries": len(countries), "cities": len(cities)}})


@router.get("/preferences/{token}", response_class=HTMLResponse)
async def preferences_page(token: str):
    user = get_user_by_token(token)
    if not user:
        return HTMLResponse("<h1>Link expirado o inválido</h1>", status_code=404)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tus preferencias — Luanna</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f4f4f4;
    color: #191c1f;
    line-height: 1.5;
    padding: 20px;
    max-width: 560px;
    margin: 0 auto;
  }}
  h1 {{ font-size: 22px; margin-bottom: 4px; }}
  .subtitle {{ color: #8d969e; font-size: 14px; margin-bottom: 24px; }}
  .section {{ background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; }}
  .section-title {{ font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }}
  .chips {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; min-height: 32px; }}
  .chip {{
    background: #494fdf; color: white; padding: 6px 12px; border-radius: 16px;
    font-size: 13px; display: inline-flex; align-items: center; gap: 6px;
  }}
  .chip .remove {{ cursor: pointer; opacity: 0.7; font-weight: bold; }}
  .chip .remove:hover {{ opacity: 1; }}
  .search-box {{
    position: relative; width: 100%;
  }}
  .search-box input {{
    width: 100%; padding: 10px 14px; border: 1px solid #c9c9cd;
    border-radius: 8px; font-size: 14px; outline: none;
  }}
  .search-box input:focus {{ border-color: #494fdf; }}
  .suggestions {{
    position: absolute; top: 100%; left: 0; right: 0; background: white;
    border: 1px solid #c9c9cd; border-radius: 8px; margin-top: 4px;
    max-height: 240px; overflow-y: auto; z-index: 10; display: none;
  }}
  .suggestions.open {{ display: block; }}
  .suggestion-item {{
    padding: 10px 14px; cursor: pointer; font-size: 14px; border-bottom: 1px solid #f4f4f4;
  }}
  .suggestion-item:hover {{ background: #f4f4f4; }}
  .suggestion-item:last-child {{ border-bottom: none; }}
  .radio-group, .checkbox-group {{ display: flex; gap: 12px; flex-wrap: wrap; }}
  .radio-option, .checkbox-option {{
    flex: 1; min-width: 90px; padding: 10px; border: 1px solid #c9c9cd;
    border-radius: 8px; cursor: pointer; text-align: center; font-size: 13px;
    transition: all 0.15s;
  }}
  .radio-option.selected, .checkbox-option.selected {{
    background: #494fdf; color: white; border-color: #494fdf;
  }}
  button.save {{
    width: 100%; background: #191c1f; color: white; border: none;
    padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 600;
    cursor: pointer; margin-top: 8px;
  }}
  button.save:hover {{ background: #000; }}
  button.save:disabled {{ opacity: 0.5; cursor: not-allowed; }}
  .success {{
    background: #00a87e; color: white; padding: 14px; border-radius: 10px;
    text-align: center; display: none; margin-top: 12px;
  }}
  .success.show {{ display: block; }}
  input[type="text"].origin {{
    width: 100%; padding: 10px 14px; border: 1px solid #c9c9cd;
    border-radius: 8px; font-size: 14px; outline: none;
  }}
</style>
</head>
<body>

<h1>🧳 Tus preferencias</h1>
<p class="subtitle">Dime qué te gusta y Luanna te arma planes a medida.</p>

<div class="section">
  <div class="section-title">🌍 Países favoritos</div>
  <div class="chips" id="countries-chips"></div>
  <div class="search-box">
    <input type="text" id="country-search" placeholder="Buscar país..." autocomplete="off">
    <div class="suggestions" id="country-suggestions"></div>
  </div>
</div>

<div class="section">
  <div class="section-title">🏙️ Ciudades favoritas</div>
  <div class="chips" id="cities-chips"></div>
  <div class="search-box">
    <input type="text" id="city-search" placeholder="Buscar ciudad..." autocomplete="off">
    <div class="suggestions" id="city-suggestions"></div>
  </div>
</div>

<div class="section">
  <div class="section-title">✈️ ¿Desde dónde viajas?</div>
  <input type="text" class="origin" id="origin" placeholder="Ej: Lima, Perú">
</div>

<div class="section">
  <div class="section-title">💰 Presupuesto</div>
  <div class="radio-group">
    <div class="radio-option" data-value="low">Bajo</div>
    <div class="radio-option" data-value="mid">Medio</div>
    <div class="radio-option" data-value="high">Alto</div>
  </div>
</div>

<div class="section">
  <div class="section-title">🎯 Tipo de viaje</div>
  <div class="checkbox-group">
    <div class="checkbox-option" data-value="playa">🏖️ Playa</div>
    <div class="checkbox-option" data-value="aventura">🏔️ Aventura</div>
    <div class="checkbox-option" data-value="cultural">🏛️ Cultural</div>
    <div class="checkbox-option" data-value="gastronomico">🍽️ Gastronómico</div>
    <div class="checkbox-option" data-value="relax">🧘 Relax</div>
  </div>
</div>

<button class="save" id="save-btn">Guardar</button>
<div class="success" id="success">✅ Listo! Vuelve a WhatsApp.</div>

<script>
const TOKEN = "{token}";
const state = {{
  countries: [],
  cities: [],
  budget: null,
  styles: [],
  origin: ""
}};

// Load existing prefs
fetch(`/api/preferences/${{TOKEN}}`)
  .then(r => r.json())
  .then(data => {{
    state.countries = data.countries || [];
    state.cities = data.cities || [];
    state.budget = data.budget;
    state.styles = data.styles || [];
    state.origin = data.origin || "";
    document.getElementById("origin").value = state.origin;
    renderChips();
    renderBudget();
    renderStyles();
  }});

function renderChips() {{
  const countriesEl = document.getElementById("countries-chips");
  countriesEl.innerHTML = state.countries.map((c, i) =>
    `<span class="chip">${{c.name}} <span class="remove" onclick="removeCountry(${{i}})">×</span></span>`
  ).join("");

  const citiesEl = document.getElementById("cities-chips");
  citiesEl.innerHTML = state.cities.map((c, i) =>
    `<span class="chip">${{c.name}} <span class="remove" onclick="removeCity(${{i}})">×</span></span>`
  ).join("");
}}

function renderBudget() {{
  document.querySelectorAll(".radio-option").forEach(el => {{
    el.classList.toggle("selected", el.dataset.value === state.budget);
  }});
}}

function renderStyles() {{
  document.querySelectorAll(".checkbox-option").forEach(el => {{
    el.classList.toggle("selected", state.styles.includes(el.dataset.value));
  }});
}}

function removeCountry(i) {{ state.countries.splice(i, 1); renderChips(); }}
function removeCity(i) {{ state.cities.splice(i, 1); renderChips(); }}

window.removeCountry = removeCountry;
window.removeCity = removeCity;

// Country search
const countrySearch = document.getElementById("country-search");
const countrySuggestions = document.getElementById("country-suggestions");
let allCountries = [];
fetch("/api/suggestions/countries").then(r => r.json()).then(d => allCountries = d);

countrySearch.addEventListener("input", e => {{
  const q = e.target.value.toLowerCase();
  if (!q) {{ countrySuggestions.classList.remove("open"); return; }}
  const matches = allCountries
    .filter(c => c.name.toLowerCase().includes(q))
    .filter(c => !state.countries.find(x => x.code === c.code))
    .slice(0, 8);
  countrySuggestions.innerHTML = matches.map(c =>
    `<div class="suggestion-item" onclick="addCountry('${{c.code}}', '${{c.name.replace(/'/g, "")}}')">${{c.flag}} ${{c.name}}</div>`
  ).join("");
  countrySuggestions.classList.toggle("open", matches.length > 0);
}});

window.addCountry = (code, name) => {{
  state.countries.push({{ code, name }});
  countrySearch.value = "";
  countrySuggestions.classList.remove("open");
  renderChips();
}};

// City search
const citySearch = document.getElementById("city-search");
const citySuggestions = document.getElementById("city-suggestions");

citySearch.addEventListener("input", async e => {{
  const q = e.target.value;
  if (!q) {{ citySuggestions.classList.remove("open"); return; }}
  const r = await fetch(`/api/suggestions/cities?q=${{encodeURIComponent(q)}}`);
  let matches = await r.json();
  matches = matches.filter(c => !state.cities.find(x => x.iata === c.iata)).slice(0, 8);
  citySuggestions.innerHTML = matches.map(c =>
    `<div class="suggestion-item" onclick="addCity('${{c.iata}}', '${{c.name.replace(/'/g, "")}}', '${{c.country_code}}')">${{c.name}}, ${{c.country}}</div>`
  ).join("");
  citySuggestions.classList.toggle("open", matches.length > 0);
}});

window.addCity = (iata, name, country_code) => {{
  state.cities.push({{ iata, name, country_code }});
  citySearch.value = "";
  citySuggestions.classList.remove("open");
  renderChips();
}};

// Budget
document.querySelectorAll(".radio-option").forEach(el => {{
  el.addEventListener("click", () => {{
    state.budget = el.dataset.value;
    renderBudget();
  }});
}});

// Styles
document.querySelectorAll(".checkbox-option").forEach(el => {{
  el.addEventListener("click", () => {{
    const v = el.dataset.value;
    if (state.styles.includes(v)) state.styles = state.styles.filter(s => s !== v);
    else state.styles.push(v);
    renderStyles();
  }});
}});

// Origin
document.getElementById("origin").addEventListener("input", e => {{
  state.origin = e.target.value;
}});

// Save
document.getElementById("save-btn").addEventListener("click", async () => {{
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  const r = await fetch(`/api/preferences/${{TOKEN}}`, {{
    method: "POST",
    headers: {{ "Content-Type": "application/json" }},
    body: JSON.stringify(state)
  }});

  if (r.ok) {{
    document.getElementById("success").classList.add("show");
    btn.textContent = "Guardado";
    setTimeout(() => {{
      btn.disabled = false;
      btn.textContent = "Guardar";
    }}, 2000);
  }} else {{
    btn.disabled = false;
    btn.textContent = "Error, reintentar";
  }}
}});

// Close suggestions on click outside
document.addEventListener("click", e => {{
  if (!e.target.closest(".search-box")) {{
    document.querySelectorAll(".suggestions").forEach(s => s.classList.remove("open"));
  }}
}});
</script>
</body>
</html>"""
