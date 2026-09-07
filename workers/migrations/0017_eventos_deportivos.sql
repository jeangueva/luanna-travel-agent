-- Plataforma de logística deportiva: catálogo de eventos que alimenta las
-- páginas estáticas (SSG/ISR) de web/app/eventos. Vive en el mismo Neon del
-- bot: una sola base, un solo runner de migraciones, cero servicios nuevos.
--
-- Desviaciones respecto al esquema del PRD, todas aditivas:
--   · fuente_url / confianza / geo_fuente — el pipeline de ingesta escribe
--     draft; el revisor necesita saber de dónde salió cada coordenada antes
--     de publicar. Sin procedencia la revisión es fe ciega.
--   · tramos — el Benchmark 2 (triatlón: natación, T1, ciclismo, T2, carrera)
--     exige varios trazados por evento; ruta_gpx_url sola no lo modela.
--   · badges / descripcion — los pide el layout del §5.1 (hero + SEO).
CREATE TABLE IF NOT EXISTS eventos_deportivos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    nombre_oficial VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL
      CHECK (categoria IN ('triatlon', 'aguas_abiertas', 'maraton', 'ciclismo')),
    fecha_inicio DATE NOT NULL,
    ciudad_sede VARCHAR(100),
    pais VARCHAR(100),
    latitud_partida DOUBLE PRECISION NOT NULL
      CHECK (latitud_partida BETWEEN -90 AND 90),
    longitud_partida DOUBLE PRECISION NOT NULL
      CHECK (longitud_partida BETWEEN -180 AND 180),
    ruta_gpx_url TEXT,
    clima_proyectado JSONB,
    estado_publicacion VARCHAR(20) NOT NULL DEFAULT 'draft'
      CHECK (estado_publicacion IN ('draft', 'published', 'rechazado')),
    -- Procedencia y confianza de la extracción.
    fuente_url TEXT,
    geo_fuente VARCHAR(20) NOT NULL DEFAULT 'llm'
      CHECK (geo_fuente IN ('llm', 'mapbox', 'manual')),
    confianza REAL NOT NULL DEFAULT 0 CHECK (confianza BETWEEN 0 AND 1),
    -- Contenido de página.
    descripcion TEXT,
    badges JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ "tipo": "natacion" | "t1" | "ciclismo" | "t2" | "carrera",
    --    "nombre": "Natación 1.5K", "gpx_url": "https://…" }]
    tramos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos_deportivos(estado_publicacion);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos_deportivos(fecha_inicio);
-- El listado por categoría solo pagina publicados en orden de fecha; sin este
-- índice compuesto cada build de ISR hace seq scan sobre la tabla entera.
CREATE INDEX IF NOT EXISTS idx_eventos_cat_fecha
  ON eventos_deportivos(categoria, fecha_inicio)
  WHERE estado_publicacion = 'published';

-- Bitácora del cron. Sin esto, un domingo en que Brave devuelve 429 se ve
-- exactamente igual que un domingo sin eventos nuevos.
CREATE TABLE IF NOT EXISTS ingesta_runs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    queries INTEGER NOT NULL DEFAULT 0,
    candidatos INTEGER NOT NULL DEFAULT 0,
    insertados INTEGER NOT NULL DEFAULT 0,
    actualizados INTEGER NOT NULL DEFAULT 0,
    rechazados INTEGER NOT NULL DEFAULT 0,
    errores JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ingesta_runs_started ON ingesta_runs(started_at DESC);
