# Legacy — código Python de referencia

Este directorio contiene la implementación previa de Luanna en Python (LangGraph + FastAPI).

A partir de 2026-04-23 el desarrollo activo se movió a `/workers/` (Cloudflare Workers + TypeScript + Vercel AI SDK + OpenRouter).

**Queda aquí solo como referencia** para portar:

- System prompt y tono de Luanna
- Lógica de extracción de preferencias (`preferences.py`)
- Grafo de conversación (`graph.py`, `nodes/`)
- Integración con Travelpayouts (`tools.py`)
- Providers de WhatsApp (`providers/meta.py`, `providers/whapi.py`)

**Borrar este directorio completo** cuando el Worker llegue a paridad de features.
