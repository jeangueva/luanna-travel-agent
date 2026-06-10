// One-off: generate placeholder WhatsApp stickers (512x512 webp, transparent
// outside a rounded brand card). Re-run after editing to refresh assets.
// Output: workers/public/stickers/*.webp
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "stickers");
mkdirSync(outDir, { recursive: true });

// Brand palette
const TEAL = "#10b6a8";
const NAVY = "#0f2742";
const GOLD = "#f5a623";
const RED = "#ef4444";
const WHITE = "#ffffff";

// Airplane silhouette (Material "flight" icon, 24x24 path). Reads clearly as
// a plane, not a cursor. Drawn vector — no emoji-font dependency.
// tx/ty position the top-left; scale sizes it (24 units * scale = px).
const plane = (fill, tx, ty, scale = 6, rotate = 0) =>
  `<g transform="translate(${tx},${ty}) scale(${scale}) rotate(${rotate} 12 12)">
     <path fill="${fill}" d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/>
   </g>`;

const card = (bg) =>
  `<rect x="26" y="26" width="460" height="460" rx="80" ry="80" fill="${bg}"/>`;

const text = (s, y, size, fill = WHITE, weight = 800) =>
  `<text x="256" y="${y}" font-family="Arial, Helvetica, sans-serif"
     font-size="${size}" font-weight="${weight}" fill="${fill}"
     text-anchor="middle" dominant-baseline="middle">${s}</text>`;

const stickers = {
  // First-contact greeting
  welcome: `${card(TEAL)}${plane(WHITE, 184, 70, 6.5, -20)}${text("¡HOLA!", 340, 78)}${text("Soy Luanna", 402, 40, WHITE, 600)}`,
  // Cheap flight / good deal found
  deal: `${card(GOLD)}${text("OFERTA", 230, 86, NAVY)}${text("¡Vuelo barato!", 300, 42, NAVY, 600)}${plane(NAVY, 196, 350, 5.5, -20)}`,
  // Price alert created / triggered
  alert: `${card(NAVY)}
     <circle cx="256" cy="210" r="70" fill="${TEAL}"/>
     <path d="M222 210 l24 24 l46 -52" stroke="${WHITE}" stroke-width="16"
       fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     ${text("ALERTA LISTA", 340, 52)}${text("te aviso si baja", 392, 34, WHITE, 600)}`,
  // Closing / thanks
  thanks: `${card(RED)}
     <path transform="translate(196,150) scale(1.0)" fill="${WHITE}"
       d="M60 110 C10 70 10 30 40 24 C58 20 60 40 60 40 C60 40 62 20 80 24 C110 30 110 70 60 110 Z"/>
     ${text("¡GRACIAS!", 340, 72)}${text("buen viaje", 396, 36, WHITE, 600)}`,
};

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${inner}</svg>`;

for (const [name, inner] of Object.entries(stickers)) {
  const buf = Buffer.from(svg(inner));
  const out = join(outDir, `${name}.webp`);
  await sharp(buf)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(out);
  console.log("wrote", out);
}
console.log("done");
