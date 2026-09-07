export interface Env {
  // Secretos
  DATABASE_URL: string;
  BRAVE_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  MAPBOX_TOKEN?: string;
  ADMIN_API_KEY: string;
  REVALIDATE_URL?: string;
  REVALIDATE_SECRET?: string;
  // Vars
  INGEST_CATEGORIAS?: string;
  INGEST_PAISES?: string;
  INGEST_ANOS?: string;
  LLM_MODEL?: string;
  MAX_QUERIES_POR_CORRIDA?: string;
  // Bindings
  GPX: R2Bucket;
}
