# 🚀 Luanna - Deployment Guide

## Opción Recomendada: Railway (Más fácil + Gratis)

Railway es la mejor opción porque:
- ✅ Gratis para empezar (sin tarjeta de crédito)
- ✅ Deploy automático desde GitHub (1 click)
- ✅ Redis incluido en free tier
- ✅ PostgreSQL opcional
- ✅ Logs en tiempo real
- ✅ Custom domains
- ✅ 5 minutos para estar en producción

---

## Paso 1: Preparar Código para Deploy

### 1.1 Crear repositorio GitHub

```bash
cd /Users/jeangueva/Documents/Projects/luanna-travel-agent

# Inicializar git (si no está ya)
git init
git add .
git commit -m "Initial Luanna deployment

- 17-node LangGraph architecture
- Meta Cloud API integration
- Travelpayouts flights/hotels
- Redis HITL confirmation
- LangSmith observability
- Token optimization ready

Co-Authored-By: Claude <noreply@anthropic.com>"

# Crear repo en GitHub
# 1. Ve a https://github.com/new
# 2. Nombre: luanna-travel-agent
# 3. Descripción: Vora MoA WhatsApp chatbot for travel planning
# 4. Public or Private (tu preferencia)
# 5. Create repository

# Conectar y push
git remote add origin https://github.com/YOUR_USERNAME/luanna-travel-agent.git
git branch -M main
git push -u origin main
```

### 1.2 Crear .env.production

```bash
cat > .env.production << 'EOF'
# Server
PORT=8000
ENVIRONMENT=production

# WhatsApp Provider
WHATSAPP_PROVIDER=meta

# Meta Cloud API (REQUIERE VALORES REALES)
META_ACCESS_TOKEN=YOUR_TOKEN
META_PHONE_NUMBER_ID=YOUR_PHONE_ID
META_BUSINESS_ACCOUNT_ID=YOUR_ACCOUNT_ID
META_WEBHOOK_VERIFY_TOKEN=luanna_webhook_token
META_APP_SECRET=YOUR_APP_SECRET

# Claude API (REQUIERE VALOR REAL)
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY

# Travelpayouts (REQUIERE VALORES REALES)
TRAVELPAYOUTS_TOKEN=YOUR_TOKEN
TRAVELPAYOUTS_MARKER=luanna

# Database (Railway proporciona)
DATABASE_URL=postgresql://user:password@host:5432/luanna

# Redis (Railway proporciona)
REDIS_URL=redis://user:password@host:port

# LangSmith (Opcional)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=sk-YOUR_KEY
LANGCHAIN_PROJECT=luanna
EOF
```

### 1.3 Crear Dockerfile optimizado

```bash
cat > Dockerfile << 'EOF'
FROM python:3.14-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run
CMD ["uvicorn", "agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
```

### 1.4 Crear railway.json (opcional pero recomendado)

```bash
cat > railway.json << 'EOF'
{
  "build": {
    "builder": "dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn agent.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
EOF
```

### 1.5 Push a GitHub

```bash
git add .
git commit -m "Add production deployment files

- Dockerfile optimized
- railway.json config
- .env.production template
- Production-ready setup

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

## Paso 2: Deploy en Railway

### 2.1 Crear cuenta Railway

1. Ve a https://railway.app
2. Click "Start New Project"
3. Sign up con GitHub (autoriza)
4. Crea workspace (ej: "luanna")

### 2.2 Crear nuevo proyecto

1. En Dashboard: "New Project"
2. Selecciona "Deploy from GitHub repo"
3. Autoriza Railway acceso a GitHub
4. Selecciona: `your-username/luanna-travel-agent`
5. Click "Deploy"

Railway automáticamente:
- ✅ Clona el repo
- ✅ Lee Dockerfile
- ✅ Construye imagen
- ✅ Despliega container
- ✅ Asigna URL pública

**Tu URL será:** `https://luanna-travel-agent.up.railway.app` (o custom domain)

### 2.3 Agregar variables de entorno

En Railway Dashboard:
1. Click proyecto → Variables
2. Agregra todas las de `.env.production`:

```
META_ACCESS_TOKEN=YOUR_TOKEN
META_PHONE_NUMBER_ID=YOUR_ID
META_BUSINESS_ACCOUNT_ID=YOUR_ID
META_WEBHOOK_VERIFY_TOKEN=luanna_webhook_token
META_APP_SECRET=YOUR_SECRET
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
TRAVELPAYOUTS_TOKEN=YOUR_TOKEN
TRAVELPAYOUTS_MARKER=luanna
ENVIRONMENT=production
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=sk-YOUR_KEY
```

3. Click "Deploy" (si cambió alguna var)

### 2.4 Agregar Redis (para HITL)

1. En proyecto → Marketplace
2. Busca "Redis"
3. Click "Add"
4. Selecciona plan (gratis disponible)
5. Click "Add Plugin"

Railway automáticamente:
- ✅ Crea instancia Redis
- ✅ Inyecta `REDIS_URL` en env vars
- ✅ Conecta tu app

### 2.5 Agregar PostgreSQL (Optional, para producción)

1. En proyecto → Marketplace
2. Busca "PostgreSQL"
3. Click "Add"
4. Selecciona plan (gratis con límites)
5. Click "Add Plugin"

Railway:
- ✅ Crea BD PostgreSQL
- ✅ Inyecta `DATABASE_URL`
- ✅ Conecta automáticamente

---

## Paso 3: Verificar Deploy

### 3.1 Chequear status

```bash
# En Railway Dashboard
# Project → Deployments
# Verifica que BUILD STATUS = "Success" ✅
# Runtime status = "Healthy" ✅
```

### 3.2 Test health endpoint

```bash
curl https://luanna-travel-agent.up.railway.app/health

# Esperado:
# {"status":"ok","service":"Luanna Travel Agent (Vora MoA)"}
```

### 3.3 Ver logs en tiempo real

En Railway Dashboard:
- Project → Deployments → [tu deploy] → Logs
- Verifica que no haya errores

---

## Paso 4: Conectar Meta Cloud API Webhook

### 4.1 Configurar webhook en Meta

1. Ve a https://developers.facebook.com/apps
2. Selecciona tu app
3. WhatsApp → Configuration
4. Callback URL: `https://luanna-travel-agent.up.railway.app/webhook`
5. Verify Token: `luanna_webhook_token` (la que pusiste en Railway)
6. Subscribe to: `messages`, `message_status`
7. Click "Verify and Save"

Meta:
- ✅ Hace GET a `/webhook?hub.verify_token=...&hub.challenge=...`
- ✅ Tu app responde con challenge
- ✅ Webhook verificado ✅

### 4.2 Test webhook desde Meta

En Meta Dashboard:
1. WhatsApp → Configuration
2. Click "Send a test message"
3. Envía: "Hola, quiero ir a Barcelona"
4. Verifica que Luanna responde en los logs

---

## Paso 5: Monitorear en Producción

### 5.1 Logs en Railway

```
Dashboard → Project → Deployments → Logs
```

Búsqueda de errores:
```
ERROR, Exception, Traceback
```

### 5.2 LangSmith Dashboard

https://smith.langchain.com/
- Ver todos los 17 nodos en grafo
- Latencia per-nodo
- Token usage
- Cost analysis
- Error tracking

### 5.3 Métricas Railway

```
Dashboard → Project → Metrics
```
- CPU usage
- Memory usage
- Network I/O
- Request count

---

## Alternativas de Deploy

### Opción 2: Render.com

```bash
# Similar a Railway
# Ve a https://render.com
# New → Web Service
# Connect GitHub repo
# Build command: automatic (detecta Dockerfile)
# Start command: uvicorn agent.main:app --host 0.0.0.0 --port $PORT
# Add env vars
# Create service
```

### Opción 3: Vercel (Serverless)

⚠️ No recomendado para Luanna porque:
- Timeout límite de 10 segundos (Luanna necesita 60s)
- No soporta conexiones de larga duración
- Mejor para APIs rápidas

### Opción 4: AWS/GCP/Azure

✅ Posible pero más complejo:
- Requiere Docker registry (ECR, Artifact Registry, etc)
- Configuración manual de networking
- Costos superiores

Recomendación: **Empieza con Railway, escala a AWS si necesitas**

---

## Troubleshooting Deploy

### Error: "Build failed"

```bash
# Chequea logs en Railway
# Problemas típicos:
# 1. requirements.txt con versiones incompatibles
# 2. Falta archivo importante
# 3. Dockerfile syntax error

# Solución: 
# git push con cambios
# Railway re-builds automáticamente
```

### Error: "App keeps crashing"

```bash
# Ver logs:
# Railway → Deployments → Logs
# Busca: "ERROR", "Exception"

# Problemas típicos:
# 1. ANTHROPIC_API_KEY inválida
# 2. DATABASE_URL incorrecto
# 3. Redis no disponible

# Solución:
# Chequea env vars en Railway
# git push fixes si es código
```

### Error: "Webhook not verifying"

```bash
# Problemas:
# 1. REDIRECT_URL en Meta ≠ actual URL en Railway
# 2. META_WEBHOOK_VERIFY_TOKEN no coincide
# 3. Typo en callback URL

# Solución:
# Railway → Project → Generate Domain (te da URL exacta)
# Copia esa URL a Meta
# Verifica token en env vars
```

### Latency > 60 segundos en producción

```bash
# Chequea:
# 1. LangSmith - qué nodo es lento?
# 2. Railway metrics - CPU/Memory suficiente?
# 3. Travelpayouts API - timeout?

# Soluciones:
# - Upgrade Railway plan (más CPU)
# - Migrar a Mercury-2 dLLM (v2.0)
# - Caché de resultados más agresivo
```

---

## Monitoring & Maintenance

### Diario

- [ ] Chequea Railway logs para errores
- [ ] Verifica health endpoint `GET /health`
- [ ] Revisa latency en LangSmith

### Semanal

- [ ] Analiza costo en Railway
- [ ] Revisa errores recurrentes
- [ ] Chequea usage de tokens en Claude

### Mensual

- [ ] Upgrade de Railway si necesita más recursos
- [ ] Analiza métricas de usuario
- [ ] Plan optimizaciones para v2.0

---

## Próximos Pasos (Post-Deploy)

### Inmediato
1. ✅ Verificar webhook funciona
2. ✅ Test con usuarios reales
3. ✅ Monitorear logs

### Corto plazo (1-2 semanas)
1. ☐ Activar Headroom proxy (60% token savings)
2. ☐ Integrar Toonify (65% data savings)
3. ☐ Analytics de usuario

### Mediano plazo (1 mes)
1. ☐ Supabase embeddings (vlogs reales)
2. ☐ Google Places API (restaurantes)
3. ☐ Dashboard admin

### Largo plazo (3+ meses)
1. ☐ Mercury-2 dLLM (<30s latency)
2. ☐ Multi-city itineraries
3. ☐ Proactive recommendations

---

## Cost Analysis

### Railway Free Tier (Suficiente para MVP)
```
Compute:    $5/month free (1000 hrs)
Storage:    $10 free
Redis:      Incluido
Total:      FREE (hasta cierto uso)
```

### Con tráfico moderado (1000 msgs/day)
```
Compute:    $0.25/day = $7.50/month
Storage:    Incluido
Redis:      Incluido
Total:      ~$10/month
```

### Expandido (10k msgs/day)
```
Compute:    $25/month
PostgreSQL: $12/month
Redis:      $5/month
Total:      ~$50/month

Ingresos (comisión Travelpayouts): ~$100+/month
GANANCIA: ~$50/month
```

---

## Summary

| Paso | Tiempo | Dificultad |
|------|--------|-----------|
| 1. Preparar código | 5 min | ✅ Fácil |
| 2. Deploy Railway | 5 min | ✅ Fácil |
| 3. Configurar vars | 5 min | ✅ Fácil |
| 4. Agregar Redis | 2 min | ✅ Fácil |
| 5. Meta webhook | 5 min | ⚠️ Medio |
| **TOTAL** | **~22 min** | ✅ Fácil |

**Tu Luanna estará en producción en menos de 30 minutos** 🚀

---

## Links Útiles

- Railway: https://railway.app
- Meta Developers: https://developers.facebook.com
- LangSmith: https://smith.langchain.com
- Anthropic Console: https://console.anthropic.com
- Travelpayouts: https://support.travelpayouts.com

---

**LISTO PARA DESPEGAR** ✈️
