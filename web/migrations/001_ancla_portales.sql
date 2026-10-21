-- Ejecutar sobre la base PostgreSQL indicada por DATABASE_URL.
-- Espacio de trabajo de un único administrador; no almacena pacientes.
CREATE TABLE IF NOT EXISTS ancla_portales (
  id uuid PRIMARY KEY,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
