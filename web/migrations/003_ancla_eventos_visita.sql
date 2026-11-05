-- Cada tipo de evento cuenta una vez por visita (ficha firmada del portal).
ALTER TABLE ancla_eventos ADD COLUMN IF NOT EXISTS visita text;
CREATE UNIQUE INDEX IF NOT EXISTS ancla_eventos_una_vez ON ancla_eventos (portal_id, visita, tipo);
