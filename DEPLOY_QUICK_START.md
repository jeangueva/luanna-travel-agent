# ⚡ QUICK DEPLOY - 30 MINUTOS A PRODUCCIÓN

## TL;DR - 6 Comandos

```bash
# 1. Crea GitHub repo en https://github.com/new
# 2. Copia tu repo URL

# 3. Ejecuta el script de deploy
./deploy.sh

# 4. Responde las preguntas (Railway URL, variables, etc)
# 5. Agregá variables en Railway Dashboard
# 6. Listo! Tu Luanna está en producción 🚀
```

---

## Alternativa: Paso a Paso (10 min)

### 1. GitHub (2 min)

```bash
cd /Users/jeangueva/Documents/Projects/luanna-travel-agent

# Si no estás en un repo
git init

# Commit
git add .
git commit -m "Deploy Luanna

Co-Authored-By: Claude <noreply@anthropic.com>"

# Crea repo en https://github.com/new
# Nombre: luanna-travel-agent
# Copia la URL (https://github.com/YOUR_USERNAME/luanna-travel-agent.git)

# Conecta y push
git remote add origin YOUR_URL
git branch -M main
git push -u origin main
```

### 2. Railway (2 min)

1. Ve a https://railway.app
2. Click "Start New Project"
3. Sign up con GitHub
4. "New Project" → "Deploy from GitHub repo"
5. Selecciona `luanna-travel-agent`
6. Click "Deploy"

**Railway automáticamente:**
- Construye la imagen Docker
- Despliega el contenedor
- Te da una URL como: `https://luanna-travel-agent.up.railway.app`

### 3. Variables (3 min)

En Railway Dashboard:

```
Variables → Add:

ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
META_ACCESS_TOKEN=YOUR_TOKEN
META_PHONE_NUMBER_ID=YOUR_PHONE_ID
META_BUSINESS_ACCOUNT_ID=YOUR_ACCOUNT_ID
META_WEBHOOK_VERIFY_TOKEN=luanna_webhook_token
META_APP_SECRET=YOUR_SECRET
TRAVELPAYOUTS_TOKEN=YOUR_TOKEN
TRAVELPAYOUTS_MARKER=luanna
ENVIRONMENT=production

Luego:
Deploy → Re-deploy (para aplicar variables)
```

### 4. Redis (2 min)

En Railway Dashboard:

```
Marketplace → Redis → Add
Selecciona plan gratis
Add Plugin
```

Railway inyecta automáticamente `REDIS_URL`

### 5. Meta Webhook (2 min)

En https://developers.facebook.com/apps:

```
Tu app → WhatsApp → Configuration

Callback URL:
https://luanna-travel-agent.up.railway.app/webhook

Verify Token:
luanna_webhook_token

Subscribe to:
☑️ messages
☑️ message_status

Click: Verify and Save
```

### 6. Test (1 min)

```bash
# En terminal
curl https://luanna-travel-agent.up.railway.app/health

# Esperado:
# {"status":"ok","service":"Luanna Travel Agent (Vora MoA)"}
```

En Meta Dashboard:
- Send test message
- Verifica que Luanna responda
- Check Railway logs

---

## Checklist de Deploy

```
✅ Git repo en GitHub
✅ Push a main branch
✅ Railway project creado
✅ Dockerfile buildea (ver logs)
✅ Health endpoint responde
✅ Todas las variables agregadas
✅ Redis agregado
✅ Meta webhook configurado
✅ Test message recibido
✅ Respuesta en logs
```

---

## Costos Estimados

### Free Tier (hasta ~1000 msgs/día)
```
Railway compute:  $5 free/month
Redis:            Included
PostgreSQL:       Optional (free)
TOTAL:            FREE ✅
```

### Moderate (~5000 msgs/día)
```
Railway:    $10/month
Redis:      Included
TOTAL:      ~$10/month
```

### Production (~50k msgs/día)
```
Railway:    $50/month
Redis:      $5/month
PostgreSQL: $15/month
TOTAL:      ~$70/month

GANANCIA (comisiones Travelpayouts): ~$200-500/month
PROFIT:     ~$130-430/month
```

---

## Troubleshooting

### "Health check failed"
```bash
# Chequea Railway logs:
# Project → Deployments → [tu deploy] → Logs

# Problemas típicos:
# 1. App aún está buildando (espera 2-3 min)
# 2. ANTHROPIC_API_KEY falta o es inválida
# 3. Puerto incorrecto (debería ser 8000)

# Solución:
# Verifica variables en Railway
# Re-deploy si cambió algo
```

### "Meta webhook not verifying"
```
Problemas:
- Callback URL incorrecta
- Verify Token no coincide
- App aún no está en línea

Soluciones:
1. Copia exactamente la URL de Railway
2. Verifica EXACT token en env vars
3. Espera a que health check pase
```

### "Latency > 60s"
```
Chequea LangSmith:
1. Qué nodo es lento?
2. Cuál es el cuello de botella?

Típicamente:
- Claude Sonnet = 40-50s (esperado)
- Travelpayouts = 3-5s
- Redis = <100ms

Soluciones:
- Caché de resultados más agresivo
- Upgrade a Mercury-2 dLLM (v2.0)
- Más recursos en Railway
```

---

## URLs Importantes

| Servicio | URL |
|----------|-----|
| Railway Dashboard | https://railway.app |
| Meta Developers | https://developers.facebook.com/apps |
| Claude Console | https://console.anthropic.com |
| LangSmith | https://smith.langchain.com |
| Travelpayouts | https://support.travelpayouts.com |
| GitHub | https://github.com |

---

## Después del Deploy

### Inmediatamente
```
☑️ Test webhook con mensaje real
☑️ Monitorea logs en Railway
☑️ Verifica health endpoint
```

### Primer día
```
☑️ Chequea LangSmith para latencia
☑️ Busca errores recurrentes
☑️ Verifica cost en Railway
```

### Primera semana
```
☑️ Activa Headroom proxy (60% token savings)
☑️ Integra Toonify (65% data savings)
☑️ Planifica v2.0
```

---

## Support

Preguntas? Revisa:
- `DEPLOY.md` - Guía completa con troubleshooting
- `STARTUP.md` - Testing local
- `README.md` - Documentación general
- Railway Docs: https://docs.railway.app

---

**AHORA MISMO:**

1. Abre GitHub → crea repo
2. Copia URL
3. Ejecuta: `./deploy.sh`
4. Responde las preguntas
5. Tu Luanna estará en producción en 30 minutos ✈️

**¡VAMOS!**
