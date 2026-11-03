# Sistema de diseño de Luanna

Una sola fuente de verdad, dos lugares donde vive:

```
design/tokens.json ──npm run tokens──▶ src/tokens.css ──▶ landing, plataforma, portal
        ▲   │
        │   └──npm run figma -- push──▶ design/figma-push.js ──(MCP use_figma)──▶ Figma «Luanna DS»
        │
        └──npm run figma -- apply──◀ design/figma-pull.result.json ◀──(MCP use_figma)── design/figma-pull.js
```

- **Figma:** https://www.figma.com/design/sRQcaDOH5ogqHfqQNtRD50 (ids en `figma.json`)
  - Colección `Luanna DS`: colores, espacios, radios, tamaños de texto y tamaño táctil. Cada variable trae su sintaxis de código `var(--…)`.
  - Colección `Portal` con modos `Claro` y `Oscuro`: los fondos que puede elegir cada marca (`--m-*`, de `src/lib/marca.ts`).
  - Estilos de texto `Luanna/*`, ligados a las variables de tamaño.
  - Componentes: `Botón` (Oscuro/Claro), `Campo` y `Bloque portal`, todos ligados a variables.

## Contratos (fallan en `npm test`)
- `test/tokens.test.ts`: cada par de contraste cumple WCAG AA; ningún texto baja de 13 px; los controles miden 44 px o más; `tokens.css` está al día.
- `test/marca.test.ts`: cualquier color que elija un negocio queda legible en fondo claro y oscuro, y su botón también.

## Cambiar algo
- **Desde código:** edita `tokens.json` → `npm run tokens` → `npm test` → `npm run figma -- push` y córrelo con el MCP de Figma. Devuelve qué variables se crearon o actualizaron.
- **Desde Figma:** cambia la variable → `npm run figma -- pull`, córrelo con el MCP, guarda el resultado en `design/figma-pull.result.json` → `npm run figma -- apply design/figma-pull.result.json` → `npm run tokens && npm test`. Si el cambio rompe el contraste, el test lo rechaza.

Los nombres son el contrato: token `color.ink` ↔ variable `color/ink` ↔ CSS `--color-ink`.
