-- Tabla principal de la Bóveda de Auditoría Post-Reserva (Hoteles Re-Pricer y Tasas Aéreas).
-- Guarda cada voucher o boleto escaneado por texto, PDF/imagen o reenviado a auditoria@luanna.app.

CREATE TABLE IF NOT EXISTS boveda_auditorias (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('hotel', 'vuelo')),
  email TEXT,
  codigo_referencia TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  titulo_resumen TEXT NOT NULL,
  ciudad_o_ruta TEXT NOT NULL,
  precio_pagado_usd INTEGER NOT NULL CHECK (precio_pagado_usd >= 0),
  monto_recuperable_usd INTEGER NOT NULL CHECK (monto_recuperable_usd >= 0),
  comision_estimada_usd INTEGER NOT NULL DEFAULT 0 CHECK (comision_estimada_usd >= 0),
  limite_cancelacion DATE,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'alerta_enviada', 're_reservado', 'reembolso_solicitado', 'expirado')),
  caso_json JSONB NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_revision_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boveda_auditorias_email
  ON boveda_auditorias (LOWER(email), creado_en DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boveda_auditorias_monitoreo_hoteles
  ON boveda_auditorias (tipo, estado, limite_cancelacion)
  WHERE tipo = 'hotel' AND estado IN ('activo', 'alerta_enviada');
