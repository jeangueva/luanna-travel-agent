-- Cuentas por negocio con enlace mágico por correo.
CREATE TABLE IF NOT EXISTS ancla_cuentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  creada timestamptz NOT NULL DEFAULT now()
);

-- Enlaces de un solo uso. Solo se guarda el hash del token.
CREATE TABLE IF NOT EXISTS ancla_enlaces (
  token_hash text PRIMARY KEY,
  email text NOT NULL,
  expira timestamptz NOT NULL,
  usado timestamptz,
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ancla_enlaces_email ON ancla_enlaces (email, creado);

-- Cada sede pertenece a una cuenta. Las sedes antiguas (NULL) solo las ve el administrador.
ALTER TABLE ancla_portales ADD COLUMN IF NOT EXISTS cuenta_id uuid REFERENCES ancla_cuentas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ancla_portales_cuenta ON ancla_portales (cuenta_id, updated_at DESC);
