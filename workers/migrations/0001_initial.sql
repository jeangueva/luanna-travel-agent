-- Identidad del usuario (phone = auth implícito vía WhatsApp)
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historial conversacional (contexto para Luanna)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_user_time ON messages(user_id, created_at DESC);

-- Preferencias estructuradas del usuario
CREATE TABLE IF NOT EXISTS preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  budget_min INTEGER,
  budget_max INTEGER,
  budget_currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Watchlist: destinos que el usuario quiere monitorear para ofertas
CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  destination_iata TEXT,
  origin_iata TEXT,
  max_price INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency_days INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON watchlist(active, last_checked_at);

-- Búsquedas históricas (señales para personalización)
CREATE TABLE IF NOT EXISTS searches (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin TEXT,
  destination TEXT NOT NULL,
  travel_date TEXT,
  search_type TEXT NOT NULL CHECK (search_type IN ('flight','hotel','package')),
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_searches_user_time ON searches(user_id, created_at DESC);
