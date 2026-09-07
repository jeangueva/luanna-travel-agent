-- El seed de benchmarks (ingest/scripts/seed-benchmarks.ts) puede correr sin
-- MAPBOX_TOKEN usando Nominatim (OpenStreetMap, sin API key). Registrar esa
-- procedencia como 'mapbox' sería mentir en la única columna cuyo trabajo es
-- decirle al revisor de dónde salió la coordenada.
ALTER TABLE eventos_deportivos
  DROP CONSTRAINT IF EXISTS eventos_deportivos_geo_fuente_check;
ALTER TABLE eventos_deportivos
  ADD CONSTRAINT eventos_deportivos_geo_fuente_check
  CHECK (geo_fuente IN ('llm', 'mapbox', 'nominatim', 'manual'));
