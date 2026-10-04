# luanna-eventos-ingest

Worker de Cloudflare con cron dominical (`0 2 * * 0`). Ingiere eventos
deportivos oficiales y los deja en revisión. Guía completa de operación en
[`../EVENTOS.md`](../EVENTOS.md).

## Flujo

```
queries.ts    matriz año × país × categoría (14 países LatAm × 8 disciplinas); la
              ventana de MAX_QUERIES_POR_CORRIDA rota cada semana
brave.ts      /res/v1/web/search?extra_snippets=true, top 5 → un bloque de texto
extract.ts    claude-opus-5 + structured outputs (zod) → eventos tipados
validar.ts    descarta fecha no ISO / inexistente / pasada / confianza < 0.4;
              deja solo etiquetas del catálogo; descarta costos sin moneda o
              con rango corrupto (conserva el evento)
geocode.ts    contrasta la coordenada del LLM contra Mapbox (tolerancia 50 km)
iata.ts       código IATA del destino (autocomplete de Travelpayouts), aceptado
              solo si la ciudad queda a menos de 120 km de la partida; si no,
              null y la página no ofrece vuelos hasta que un revisor lo fije
db.ts         UPSERT por slug como draft, sin degradar filas ya publicadas
```

Cada paso falla hacia adelante: una query que revienta no cancela la corrida,
queda anotada en `ingesta_runs.errores`.

## Notas de implementación

- **El slug es la clave de conflicto.** Se deriva solo del nombre y el año,
  normalizando acentos y puntuación, para que el mismo evento produzca el mismo
  slug entre corridas. Si no, cada domingo crea un duplicado y la página cambia
  de URL.
- **`Date.parse("2026-02-30")` no falla**: V8 lo corre a marzo 2 en silencio.
  `validar.ts` verifica la fecha por round-trip de componentes.
- **Pausa de 1.2 s entre queries**: el plan gratuito de Brave es 1 req/s.
- **El modelo se cambia con `LLM_MODEL`**, sin tocar código.
- **Rotación de la matriz**: 224 combinaciones no caben en una corrida, así que
  cada semana toma la siguiente ventana de `MAX_QUERIES_POR_CORRIDA` (40) y en
  unas 6 semanas se cubre todo. Subir el tope acorta el ciclo, a costa de Brave
  y del LLM.
- **Un IATA equivocado no falla, miente**: muestra precios de vuelos a otra
  ciudad. Por eso `resolverIata` devuelve `null` ante cualquier duda, y el
  revisor lo fija con `PATCH /admin/eventos/<slug>/iata {"iata":"CUZ"}`.
- **El cron nunca pisa lo que un humano fijó**: coordenadas manuales, IATA,
  etiquetas, costo y descripción ya cargados sobreviven a la siguiente corrida.

## Comandos

```bash
npm test                                   # lógica pura, sin red
npm run typecheck
npx tsx scripts/backfill-iata.ts [--apply]  # IATA de eventos previos a la 0019
npx wrangler dev --test-scheduled          # luego: curl "localhost:8787/__scheduled"
npx wrangler tail                          # ver una corrida en vivo
```
