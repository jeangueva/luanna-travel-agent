# Luanna Travel Agent - Plan Completo

## 1. Visión General

**Nombre:** Luanna Travel Agent  
**Objetivo:** Chatbot WhatsApp con IA que recomienda vuelos, hoteles y paquetes baratos según los destinos favoritos de los usuarios.  
**Usuarios:** Viajeros frecuentes y ocasionales  
**Problema que resuelve:** Dificultad para encontrar ofertas buenas y tiempo invertido en comparar opciones  
**Timeline MVP:** 2 semanas  

---

## 2. Tech Stack Detallado

### 2.1 Backend
**Node.js + Express.js**
- Rápido de prototipar y desplegar
- Ecosistema maduro para integración con APIs
- Excelente soporte para async/await
- Bajo overhead de recursos (importante para bajo costo)

**Alternativa considerada:** Python + Flask (más lento de desarrollar, más recursos en hosting)

### 2.2 Base de Datos
**PostgreSQL**
- Relacional, ideal para estructura de usuarios y destinos
- Hosting gratuito: Render (500MB gratis)
- Segura y confiable para datos de usuarios

**Schema inicial:**
```
users:
  - id (UUID)
  - whatsapp_id (número WhatsApp)
  - created_at
  - preferences (JSON: presupuesto, fechas preferidas, etc.)

favorite_destinations:
  - id
  - user_id (FK)
  - destination (código IATA: MAD, BCN, etc.)
  - added_at

search_history:
  - id
  - user_id (FK)
  - origin, destination, dates
  - results_shown
  - created_at
```

### 2.3 Integración WhatsApp
**Twilio WhatsApp Sandbox (fase 1)**
- Gratuito para testing
- 100 mensajes/mes gratis
- Fácil de implementar
- Perfecto para validar idea

**Meta Cloud API (fase 2)**
- Cuando escales a usuarios reales
- ~$0.01 por mensaje
- Más barato que Twilio a escala

**Flujo:**
```
Usuario → WhatsApp → Twilio Webhook → Express Backend → Lógica
```

### 2.4 IA / Procesamiento de Lenguaje
**Claude API (Anthropic)**
- Mejor modelo para conversaciones naturales
- Excelente manejo de contexto multiturno
- Costo: $0.80/MTok input, $2.40/MTok output (muy accesible)
- Soporte para instrucciones de sistema para control de respuestas

**Alternativa considerada:** OpenAI GPT-4 (más caro, no mejor para este caso)

### 2.5 APIs Externas de Viajes
**Travelpayouts**
- **Links API:** Genera URLs de afiliado para vuelos/hoteles
- **Data API:** Obtiene precios y disponibilidad
- Gratuito con registro de afiliado
- Comisiones por conversiones

### 2.6 Hosting
**Render**
- Backend: Servicio web gratis (con limitaciones, suficiente para MVP)
- BD: PostgreSQL 500MB gratis
- Despliegue automático desde Git
- Uptime razonable

**Alternativa:** Railway (similar, ligeramente más caro pero mejor UX)

### 2.7 Stack Completo Resumido
```
Frontend:     WhatsApp (usuario)
              ↓
Messaging:    Twilio WhatsApp Sandbox
              ↓
Backend:      Node.js + Express
              ↓
IA:           Claude API
              ↓
APIs:         Travelpayouts (Links + Data)
              ↓
Database:     PostgreSQL (Render)
              ↓
Hosting:      Render
```

---

## 3. Arquitectura del Sistema

### 3.1 Flujo General

```
┌─────────────┐
│   Usuario   │
│  WhatsApp   │
└──────┬──────┘
       │ (mensaje)
       ↓
┌──────────────────┐
│     Twilio       │
│  Webhook Recv    │
└──────┬───────────┘
       │
       ↓
┌──────────────────────────┐
│   Express Backend        │
│  - Procesar mensaje      │
│  - Validar usuario       │
│  - Contexto (historial)  │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│   Claude API             │
│  - Entender intención    │
│  - Generar respuesta     │
│  - Instrucciones custom  │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│  Travelpayouts API       │
│  - Buscar vuelos/hoteles │
│  - Obtener precios       │
│  - Generar links         │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│   PostgreSQL             │
│  - Guardar usuario       │
│  - Destinos favoritos    │
│  - Historial búsquedas   │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│  Formatear respuesta     │
│  + Links de afiliado     │
└──────┬───────────────────┘
       │
       ↓
┌─────────────────────────┐
│  Enviar respuesta WhatsApp
│  (Twilio)
└─────────────────────────┘
```

### 3.2 Flujos de Interacción

**Flujo 1: Búsqueda Activa**
```
Usuario: "Quiero ir a Barcelona en junio"
↓
Bot: "¿De dónde viajas? ¿Cuántas noches?"
↓
Usuario: "De Madrid, 5 noches"
↓
Bot: "Buscando vuelos y hoteles... [resultados]"
```

**Flujo 2: Recomendación Proactiva**
```
Sistema (scheduled): "Hay ofertas para Barcelona (tu destino favorito)"
↓
Bot: Envía 3-5 opciones mejores del día
↓
Usuario: Click en enlace → Travelpayouts → Comisión
```

---

## 4. Funcionalidades MVP (2 Semanas)

### 4.1 Funcionalidades Fase 1 (Semana 1)
- [ ] Setup inicial (Node, Express, Twilio, PostgreSQL)
- [ ] Recibir mensajes WhatsApp y responder
- [ ] Autenticación de usuario (vinculación WhatsApp ↔ DB)
- [ ] Almacenar destinos favoritos
- [ ] Integración básica con Claude API

### 4.2 Funcionalidades Fase 2 (Semana 2)
- [ ] Búsqueda de vuelos en Travelpayouts
- [ ] Búsqueda de hoteles en Travelpayouts
- [ ] Formateo inteligente de resultados (máx 5 opciones)
- [ ] Generación de links de afiliado
- [ ] Guardar historial de búsquedas
- [ ] Testing y refinamiento

### 4.3 NO Incluidas en MVP
- Recomendaciones proactivas automáticas (puede ser fase 2)
- Autenticación segura compleja (MVP simple)
- Sistema de pagos integrado
- Multi-idioma (solo español/inglés)
- Interfaz web de administración

---

## 5. Estructura de Carpetas

```
luanna-travel-agent/
├── src/
│   ├── config/
│   │   ├── database.js      (conexión PostgreSQL)
│   │   ├── twilio.js        (setup Twilio)
│   │   └── env.js           (variables de entorno)
│   ├── controllers/
│   │   ├── messageController.js     (procesar mensajes)
│   │   ├── userController.js        (gestión de usuarios)
│   │   └── searchController.js      (búsquedas de viajes)
│   ├── services/
│   │   ├── claudeService.js         (integración Claude)
│   │   ├── travelpayoutsService.js  (integración API)
│   │   └── messageService.js        (lógica de respuestas)
│   ├── models/
│   │   ├── User.js
│   │   ├── Destination.js
│   │   └── SearchHistory.js
│   ├── utils/
│   │   ├── formatters.js    (formatear respuestas)
│   │   ├── validators.js    (validar entrada)
│   │   └── logger.js        (logs)
│   └── app.js               (Express setup)
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── PROJECT_PLAN.md          (este archivo)
```

---

## 6. Variables de Entorno Necesarias

```
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# PostgreSQL
DATABASE_URL=postgresql://user:pass@host:5432/luanna

# Claude API
CLAUDE_API_KEY=

# Travelpayouts
TRAVELPAYOUTS_TOKEN=
TRAVELPAYOUTS_AFFILIATE_ID=

# Aplicación
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

---

## 7. Dependencias NPM Principales

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.10.0",
    "twilio": "^4.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.0",
    "uuid": "^9.0.0",
    "joi": "^17.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## 8. Lo Que Falta o Necesita Investigación

### 8.1 Investigar
- [ ] Documentación exacta de Travelpayouts Links API (afiliado specifics)
- [ ] Límites de rate limiting en Travelpayouts
- [ ] Latencia típica de respuesta de Claude API
- [ ] Disponibilidad de cobertura de destinos en Travelpayouts
- [ ] Costo real estimado del primer mes

### 8.2 Decisiones Pendientes
- ¿Cuántas opciones mostrar por búsqueda? (recomiendo 3-5)
- ¿Incluir filtros de presupuesto en MVP? (no, phase 2)
- ¿Qué información mostrar de cada opción? (precio, duración, enlaces)
- ¿Prompts específicos en español o inglés?

### 8.3 Riesgos Identificados
| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Travelpayouts limitado en ciertos destinos | Alto | Validar cobertura pronto |
| Límites de API gratuita | Medio | Monitorear, preparar plan B |
| Costo Claude API mayor a esperado | Medio | Implementar caché, rate limit |
| Complejidad NLU en español | Medio | Templates + Claude para casos edge |

---

## 9. Hitos Estimados (2 Semanas)

**Día 1-2:** Setup inicial y scaffolding  
**Día 3:** Recepción WhatsApp + Base de datos  
**Día 4:** Integración Claude API  
**Día 5:** Integración Travelpayouts (búsqueda básica)  
**Día 6:** Lógica de respuestas inteligentes  
**Día 7:** Testing y refinamiento búsqueda  
**Día 8-10:** Ajustes, edge cases, documentación  
**Día 11-14:** Beta testing, optimización, preparación para usuarios  

---

## 10. Próximos Pasos Inmediatos

1. **Obtener credenciales:**
   - [ ] Cuenta Twilio + WhatsApp Sandbox
   - [ ] API Key Claude
   - [ ] Token Travelpayouts + Affiliate ID
   - [ ] Render account

2. **Setup técnico:**
   - [ ] Crear repo Git
   - [ ] Inicializar Node.js project
   - [ ] Configurar PostgreSQL en Render
   - [ ] Deploy primera versión "Hello World"

3. **Validación:**
   - [ ] Probar Twilio webhook
   - [ ] Probar Claude API en español
   - [ ] Validar datos Travelpayouts para 5-10 destinos

---

## Notas

- Este plan es flexible; ajustar según lo que aprendas en desarrollo
- Priorizar funcionalidad sobre perfección en MVP
- Documentar decisiones técnicas mientras avanzas
- Considerar feedback de primeros usuarios para fase 2

