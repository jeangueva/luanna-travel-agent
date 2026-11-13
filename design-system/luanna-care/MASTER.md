# Luanna — sistema de diseño "Care"

**Para quién:** alguien que tuvo un mal rato con un vuelo o un hotel. Llega con estrés y poca paciencia.
**Promesa:** entender su reserva y dejarle escrito el mensaje para la aerolínea o el hotel. Nada más.
**Tono:** de tú, frases cortas, palabras de todos los días. Sin urgencia, sin cifras de ahorro, sin jerga ("proveedor", "auditoría", "agente").

Los tokens viven en `web/src/care.css` (`--care-*`). Los componentes no escriben colores, tamaños ni espacios sueltos.

## Tipografía
Dos familias, seis tamaños. Nada por debajo de 14px.
- **Lora 500**: marca, `h1` y `h2`. Un solo titular grande por página.
- **DM Sans 400/500/600**: todo lo demás, incluidos `h3` y títulos de panel.

| Token | Tamaño | Uso |
|---|---|---|
| `--care-text-sm` | 14px | ayudas, notas, pie |
| `--care-text-md` | 16px | botones, campos, navegación, texto de tarjetas |
| `--care-text-lg` | 18px (17px en móvil) | cuerpo |
| `--care-text-xl` | 22px | títulos de tarjeta y de panel |
| `--care-text-2xl` | 26–34px | títulos de sección y de pantalla |
| `--care-text-hero` | 34–56px | titular de portada |

Interlineado 1.6 en texto y 1.2 en títulos. Sin mayúsculas sostenidas, sin interletraje ancho, sin cursivas decorativas.

## Espaciado
Escala de 4: `4 8 12 16 24 32 48 64 96` (`--care-1` … `--care-24`).
- Dentro de un control: 12–16. Entre controles: 12–16. Entre grupos de un formulario: 32.
- Dentro de una tarjeta: 24–32. Entre secciones: 64 (48 en móvil).
- Anchos: página 1080px, lectura y formularios 680px.

## Color
Lienzo marfil `--care-bg`, superficies blancas, texto verde bosque, una sola acción verde `--care-primary`. `--care-soft` y `--care-warm` solo como fondo de avisos y bloques. Rojo solo para errores. Sin degradados, sin sombras, sin vidrio.
Contraste: texto y texto de apoyo ≥ 4.5:1; bordes de campos ≥ 3:1.

## Forma e iconos
- Radio 10px en controles, 16px en tarjetas. Bordes de 1px.
- Alto mínimo de cualquier control: 48px (44px en navegación).
- Iconos Lucide de línea, trazo 1.75. 18–20px junto a texto, 24px dentro de `care-icon-box`. Siempre acompañan a un texto; los decorativos llevan `aria-hidden`.
- Vocabulario fijo: avión = vuelo, edificio = hotel, flecha derecha = continuar, flecha diagonal = sale del sitio, check = sí/hecho, equis = no/quitar, escudo = tú decides.

## Movimiento
Solo transiciones de color y borde de 160ms. Se desactivan con `prefers-reduced-motion`. Sin animaciones de entrada ni efectos de fondo.

## Navegación
- **Sitio:** Cómo funciona · Ayuda · Empezar. "Para empresas" y legales solo en el pie.
- **Espacio de revisión** (`/plataforma`, `/demo`): Nueva · Mis consultas · Ayuda, arriba; en móvil, una fila de tres pestañas con texto. Sin barra lateral ni ventana de bienvenida.
- La vista y el caso van en la URL (`?vista=`, `?caso=`, `?tipo=`): atrás y adelante funcionan.

## Contenido de cada pantalla
- **Portada:** pregunta + dos opciones (vuelo / hotel) → cómo funciona (3 pasos) → qué hacemos y qué no → preguntas → cierre.
- **Nueva consulta:** 1. vuelo u hotel · 2. qué pasó (opcional) · 3. pegar o subir la confirmación.
- **Resultado:** paso 1 confirmar datos · paso 2 mensaje editable para copiar · (hotel) buscar otros alojamientos, plegado.

## No hacer
- Mostrar montos de ahorro o devolución como si fueran seguros: no están verificados.
- Presentar el ejemplo como un análisis real. Los datos inventados solo aparecen en `/demo` y van avisados.
- Testimonios, métricas o logos sin respaldo.
- Etiquetas en mayúsculas sobre los títulos, ilustraciones decorativas, tarjetas inclinadas.

## Antes de entregar
Teclado y foco visible · etiquetas y errores junto al campo · lo escrito se conserva si algo falla · sin scroll horizontal a 375 / 768 / 1280 · estados vacío, cargando, error y resultado · aviso si no se pudo copiar.
