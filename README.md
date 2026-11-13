# Luanna Audit — Plataforma de Arbitraje Post-Reserva y Rescate de Tasas Aéreas en LATAM

**Auditor Inteligente de Viajes Post-Compra (B2C Gratis con Comisión Afiliada Directa + B2B SaaS)**

Luanna opera donde ninguna OTA tradicional compite: **después de que el viajero o la empresa ya compró su hotel o boleto de avión.**

---

## Los 2 Motores de Monetización Directa

### 1. Re-Pricer Mayorista de Hoteles Post-Reserva (`Stay22` + `Travelpayouts / Hotellook` + `Claude`)
- Más del 60% de las habitaciones reservadas con cancelación gratuita en Booking.com o Expedia bajan de precio antes del check-in.
- El usuario pega su voucher en la web o reenvía su confirmación a `auditoria@luanna.app`.
- El motor extrae con Claude (`POST /api/auditar`) las fechas, coordenadas, hotel y monto pagado, detecta la tarifa más baja o la alternativa 4★/5★ a `<250m` y entrega el **enlace directo de re-reserva afiliado** (`web/src/lib/afiliados.ts`).
- **Para el viajero es 100% gratis** (se ahorra $120–$220 USD). **Tú cobras el 100% de la comisión de afiliado** de la nueva reserva en Stay22 y Travelpayouts sin procesar pagos ni asumir riesgo de contracargos.

### 2. Rescate Automático de Tasas Aeroportuarias (*No-Show Taxes*) y Demoras Aéreas
- En Perú (`Indecopi / DGAC`), Colombia (`SIC / RAC 3`), México (`Profeco / LAC`) y Chile (`Sernac / JAC`), cuando un pasajero pierde un vuelo "No Reembolsable", la aerolínea está **obligada por ley a devolver el 100% de las tasas aeroportuarias e impuestos de embarque no devengados** (`TUUA`, `TUA`, `Aerocivil`), que representan entre el **35% y el 55% del valor del boleto**.
- Luanna desglosa los códigos de impuestos del boleto aéreo, calcula el importe exigible y **autogenera en un clic el requerimiento legal formal** junto con el acceso directo a la ventanilla oficial de reembolso de la aerolínea para que el dinero regrese directo a la tarjeta original del pasajero (cero *stoppers* legales ni cartas poder).

---

## Estructura de la Aplicación Web (`web/`)

| Ruta / Archivo | Descripción |
| :--- | :--- |
| `/` (`web/src/components/AnclaLanding.tsx`) | Portada pública con escáner forense en vivo, radiografía interactiva de hoteles y vuelos, matriz competitiva (vs. Pruvo y AirHelp) y simulador de ingresos B2C + B2B. |
| `/plataforma` (`web/src/components/plataforma/ConsolaAncla.tsx`) | Bóveda operativa de auditoría post-reserva: escáner con Claude, cola de vigilancia de hoteles con enlaces Stay22/Travelpayouts y generador de expedientes legales aéreos. |
| `/integraciones` (`web/app/integraciones/page.tsx`) | Guía de conexión por regla de reenvío de correo (`auditoria@luanna.app`), API REST (`POST /api/auditar`) y widget embebible. |
| `POST /api/auditar` (`web/app/api/auditar/route.ts`) | Endpoint que procesa confirmaciones de hotel y boletos aéreos usando Claude Haiku (`ANTHROPIC_API_KEY`) con fallback determinista instantáneo. |
| `web/src/lib/auditor-engine.ts` | Motor de cálculo de arbitraje hotelero, enlaces afiliados (`Stay22` + `Travelpayouts`), desglose de tasas aeroportuarias y generador de escritos legales. |
| `/eventos` (`web/app/eventos/`) | Módulo SEO programático de logística para eventos deportivos en LATAM. |

---

## Desarrollo y Pruebas

```bash
cd web
npm install
npm test          # Ejecuta las 39 pruebas unitarias
npm run typecheck # Verificación estricta de TypeScript
npm run dev       # Levanta el servidor local
```
