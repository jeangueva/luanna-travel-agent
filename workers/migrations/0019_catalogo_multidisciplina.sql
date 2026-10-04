-- Catálogo multi-disciplina para toda Latinoamérica: el hub de datos y los
-- vuelos a la sede, que es lo que monetiza.
--
-- Esta migración se reaplica entera cada vez que corre workers/scripts/migrate.ts
-- (el runner no lleva tabla de tracking y parte el archivo por punto y coma).
-- Por eso: todo es idempotente y no hay bloques DO ni punto y coma dentro de
-- cadenas.
--
-- Cambios:
--   · categoria: de 4 valores a 8 (running, trail_running, cycling, acuatlon,
--     duatlon, acuabike, triatlon, aguas_abiertas). 'maraton' pasa a running con
--     la etiqueta maraton, y 'ciclismo' pasa a cycling.
--   · etiquetas TEXT[]: el tipo de prueba (maraton, media_maraton, ironman_70_3,
--     olimpico, sprint, ultra...). Varias por evento, sin migrar para agregar una.
--   · aeropuerto_iata: código de ciudad o metro del destino. Sin esto no hay
--     búsqueda de vuelos: Aviasales no entiende "Cusco", entiende CUZ.
--   · fecha_fin / fecha_precision: hay pruebas de varios días, y muchas fechas
--     se conocen solo por mes. Marcarlo evita mostrar como exacto lo que no lo es.
--   · costo_min / costo_max / moneda / costo_fuente_url / costo_actualizado_at:
--     rango aproximado de inscripción, con procedencia y fecha de la lectura.
--   · inscripcion_url: a dónde mandar al atleta a inscribirse.

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS etiquetas TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS fecha_fin DATE;

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS fecha_precision VARCHAR(15) NOT NULL DEFAULT 'exacta'
  CHECK (fecha_precision IN ('exacta', 'aproximada', 'por_confirmar'));

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS aeropuerto_iata VARCHAR(3)
  CHECK (aeropuerto_iata ~ '^[A-Z]{3}$');

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS costo_min NUMERIC(12, 2) CHECK (costo_min >= 0);

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS costo_max NUMERIC(12, 2) CHECK (costo_max >= 0);

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) CHECK (moneda ~ '^[A-Z]{3}$');

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS costo_fuente_url TEXT;

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS costo_actualizado_at TIMESTAMPTZ;

ALTER TABLE eventos_deportivos
  ADD COLUMN IF NOT EXISTS inscripcion_url TEXT;

-- Un rango invertido (max < min) es un error de captura, no un dato.
ALTER TABLE eventos_deportivos
  DROP CONSTRAINT IF EXISTS eventos_deportivos_costo_rango_check;

ALTER TABLE eventos_deportivos
  ADD CONSTRAINT eventos_deportivos_costo_rango_check
  CHECK (costo_max IS NULL OR costo_min IS NULL OR costo_max >= costo_min);

ALTER TABLE eventos_deportivos
  DROP CONSTRAINT IF EXISTS eventos_deportivos_fecha_fin_check;

ALTER TABLE eventos_deportivos
  ADD CONSTRAINT eventos_deportivos_fecha_fin_check
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio);

-- Categorías. Primero se suelta el CHECK viejo, después se reclasifican las
-- filas con los valores heredados, y recién entonces se pone el CHECK nuevo.
ALTER TABLE eventos_deportivos
  DROP CONSTRAINT IF EXISTS eventos_deportivos_categoria_check;

UPDATE eventos_deportivos
SET categoria = 'running',
    etiquetas = CASE WHEN 'maraton' = ANY(etiquetas)
                     THEN etiquetas ELSE array_append(etiquetas, 'maraton') END
WHERE categoria = 'maraton';

UPDATE eventos_deportivos
SET categoria = 'cycling'
WHERE categoria = 'ciclismo';

ALTER TABLE eventos_deportivos
  ADD CONSTRAINT eventos_deportivos_categoria_check
  CHECK (categoria IN (
    'running', 'trail_running', 'cycling', 'acuatlon',
    'duatlon', 'acuabike', 'triatlon', 'aguas_abiertas'
  ));

-- Filtro por etiqueta (etiquetas @> ARRAY['ironman_70_3']) para el hub.
CREATE INDEX IF NOT EXISTS idx_eventos_etiquetas
  ON eventos_deportivos USING GIN (etiquetas);

-- El hub filtra por país y ordena por fecha; solo sobre lo publicado.
CREATE INDEX IF NOT EXISTS idx_eventos_pais_fecha
  ON eventos_deportivos(pais, fecha_inicio)
  WHERE estado_publicacion = 'published';
