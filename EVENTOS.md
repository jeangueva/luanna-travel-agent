# Plataforma de logística deportiva

SEO programático sobre turismo deportivo: un pipeline semanal ingiere eventos
oficiales, un humano los aprueba, y `web/` sirve una página por evento con el
recorrido en el mapa y el alojamiento a distancia caminable de la partida.

## Qué se construyó, dónde

| Pieza | Ruta | Qué hace |
|---|---|---|
| Esquema | `workers/migrations/0017_eventos_deportivos.sql` | `eventos_deportivos` + `ingesta_runs` |
| Worker de ingesta | `ingest/` | Cron dominical: Brave → Claude → geocoding → UPSERT como `draft`. Además el API de revisión y el almacén de `.gpx` |
| Páginas públicas | `web/app/eventos/…` | Índice, categoría y evento, con ISR de 1 h, sitemap y JSON-LD |
| Componentes | `web/src/components/eventos/` | Hero, lienzo 60/40 (Mapbox + Stay22), cross-selling |

## Decisiones que se apartan del PRD

Cuatro, todas deliberadas:

1. **Neon Postgres, no Supabase.** El proyecto ya corre sobre Neon
   (`workers/src/db.ts`), con su runner de migraciones y su `DATABASE_URL`.
   El DDL del PRD es Postgres y aplica casi textual; Supabase habría sido una
   segunda base de datos para el mismo Postgres. Los `.gpx` van a R2 en vez de
   Supabase Storage, por la misma razón.
2. **`claude-opus-5`, no `claude-3-5-sonnet-20240620`.** Ese id ya no es el
   vigente. El modelo se cambia con la var `LLM_MODEL` en `ingest/wrangler.toml`.
3. **El mapa y Stay22 van lado a lado, no superpuestos.** Stay22 se embebe como
   iframe con su propio mapa; no existe forma soportada de pintar sus pines
   sobre el lienzo de Mapbox. Se implementó la otra variante que el propio §5.1
   contempla — dividida 60/40 en desktop — con ambos mapas anclados a la misma
   coordenada de partida. En móvil, un selector: dos mapas de 300 px apilados
   no son dos mapas.
4. **Las coordenadas del LLM se contrastan contra Mapbox.** El §4 solo pide
   validar que sean numéricas. Una coordenada inventada pasa esa validación y
   produce un mapa impecable del lugar equivocado, con hoteles del lugar
   equivocado. `ingest/src/geocode.ts` geocodifica el lugar de partida y, si
   difiere más de 50 km de lo que dijo el modelo, gana Mapbox.

Columnas añadidas al esquema del §3, todas aditivas: `fuente_url`, `geo_fuente`,
`confianza` (procedencia para el revisor), `tramos` (el Benchmark 2 exige varios
trazados por evento), `badges` y `descripcion` (los pide el layout del §5.1).

## Puesta en marcha

### 1. Base de datos

```bash
cd workers && npm run migrate     # aplica 0017 sobre el Neon existente
```

### 2. Bucket de trazados

```bash
cd ingest && npx wrangler r2 bucket create luanna-gpx
```

### 3. Worker de ingesta

```bash
cd ingest && npm install
for s in DATABASE_URL BRAVE_API_KEY ANTHROPIC_API_KEY MAPBOX_TOKEN \
         ADMIN_API_KEY REVALIDATE_URL REVALIDATE_SECRET; do
  npx wrangler secret put "$s"
done
npx wrangler deploy
```

`DATABASE_URL` es el mismo de `workers/.dev.vars`. `BRAVE_API_KEY` sale de
<https://brave.com/search/api/>; `MAPBOX_TOKEN` de <https://account.mapbox.com>.

### 4. Web

```bash
cd web && cp .env.example .env    # completar antes de construir
npm install && npm run build
npx wrangler secret put DATABASE_URL
npx wrangler secret put REVALIDATE_SECRET
npx @vinext/cloudflare deploy
```

Los `NEXT_PUBLIC_*` se inlinean **durante el build**: ponerlos como secreto de
Workers no funciona. Cada token ausente apaga su módulo — sin Mapbox la página
sale sin mapa pero completa, sin Stay22 cae al enlace de hoteles de
Travelpayouts, sin widgets de TP la barra de cross-selling no se renderiza.

## Ciclo de revisión

El cron nunca publica. Inserta como `draft` y nunca degrada una fila ya
publicada, ni pisa una coordenada corregida a mano (`geo_fuente = 'manual'`).

```bash
API=https://luanna-eventos-ingest.<subdominio>.workers.dev
AUTH="Authorization: Bearer $ADMIN_API_KEY"

curl -H "$AUTH" "$API/admin/drafts"                    # cola de revisión
curl -H "$AUTH" -X PATCH "$API/admin/eventos/<slug>/coordenadas" \
     -d '{"lat":-12.1745,"lon":-77.0221}'              # corrige y fija en manual
curl -H "$AUTH" -X PUT "$API/admin/eventos/<slug>/gpx?tipo=ciclismo&nombre=Ciclismo%2040K" \
     --data-binary @circuito.gpx                       # sube un tramo
curl -H "$AUTH" -X POST "$API/admin/eventos/<slug>/publicar"
curl -H "$AUTH" -X POST "$API/admin/ingesta"           # corrida manual
```

`tipo` acepta `natacion`, `t1`, `ciclismo`, `t2`, `carrera`; añade
`&principal=1` para que ese trazado sea además el principal. Publicar dispara
`/api/revalidate` en `web/`, así la página aparece al aprobar y no una hora
después.

## Benchmarks del §6

```bash
cd ingest
npx tsx scripts/seed-benchmarks.ts \
  --olaya "<lugar de partida del Reto Olaya Inverso>" \
  --triatlon "<sede del Campeonato Nacional>"
```

El script geocodifica el lugar que le pases en vez de traer coordenadas
hardcodeadas: validar el render contra un punto inventado no valida nada.
Ambos entran como `draft`; publícalos con el endpoint de arriba.

## Costo por corrida

Con la matriz por defecto (4 categorías × 5 países × 2 años = 40 queries, el
tope de `MAX_QUERIES_POR_CORRIDA`): 40 llamadas a Brave, 40 a Claude con ~5 KB
de contexto cada una, y una a Mapbox por evento candidato. Ampliar la matriz
multiplica las tres cosas — es el único parámetro que mueve la factura.

## Verificación

```bash
cd ingest && npm test && npm run typecheck
cd ../web && npm test && npm run typecheck && npm run build
```
