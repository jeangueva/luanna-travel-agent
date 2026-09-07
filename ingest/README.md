# luanna-eventos-ingest

Worker de Cloudflare con cron dominical (`0 2 * * 0`). Ingiere eventos
deportivos oficiales y los deja en revisión. Guía completa de operación en
[`../EVENTOS.md`](../EVENTOS.md).

## Flujo

```
queries.ts    matriz categoría × país × año  → hasta MAX_QUERIES_POR_CORRIDA
brave.ts      /res/v1/web/search?extra_snippets=true, top 5 → un bloque de texto
extract.ts    claude-opus-5 + structured outputs (zod) → eventos tipados
validar.ts    descarta fecha no ISO / inexistente / pasada / confianza < 0.4
geocode.ts    contrasta la coordenada del LLM contra Mapbox (tolerancia 50 km)
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

## Comandos

```bash
npm test                                   # lógica pura, sin red
npm run typecheck
npx wrangler dev --test-scheduled          # luego: curl "localhost:8787/__scheduled"
npx wrangler tail                          # ver una corrida en vivo
```
