-- Medición del portal. Sin IP, sin cookies, sin datos personales: solo qué
-- sede, qué pasó, en qué idioma y si estaba incrustado en otra web.
CREATE TABLE IF NOT EXISTS ancla_eventos (
  id bigserial PRIMARY KEY,
  portal_id uuid NOT NULL REFERENCES ancla_portales(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('vista', 'vuelos', 'hoteles')),
  idioma text NOT NULL CHECK (idioma IN ('es', 'en')),
  incrustado boolean NOT NULL DEFAULT false,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ancla_eventos_portal_fecha ON ancla_eventos (portal_id, creado DESC);
