import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import {
  CATEGORIAS,
  ETIQUETAS_VALIDAS,
  type Categoria,
  type EventoExtraido,
} from "./types.js";

const EventoSchema = z.object({
  nombre_oficial: z
    .string()
    .describe("Nombre exacto del evento tal como aparece en la fuente"),
  categoria: z.enum(CATEGORIAS),
  etiquetas: z
    .array(z.enum(ETIQUETAS_VALIDAS))
    .describe(
      "Tipo de prueba, una o varias. Solo las que la fuente respalda (ej: ['maraton'], ['ironman_70_3'], ['olimpico']). Vacío si no encaja ninguna.",
    ),
  fecha_inicio: z
    .string()
    .describe("Fecha de la competencia en formato YYYY-MM-DD"),
  ciudad_sede: z.string().nullable(),
  pais: z.string().nullable(),
  lugar_partida: z
    .string()
    .nullable()
    .describe(
      "Lugar exacto de la línea de partida o zona de transición, tal como lo nombra la fuente (ej: 'Playa Agua Dulce, Chorrillos'). Null si la fuente no lo dice.",
    ),
  latitud_partida: z.number().nullable(),
  longitud_partida: z.number().nullable(),
  fuente_url: z
    .string()
    .nullable()
    .describe("La URL del bloque [n] de donde salió este evento"),
  descripcion: z
    .string()
    .nullable()
    .describe("Dos frases sobre el evento, en español, sin adjetivos de venta"),
  badges: z
    .array(z.string())
    .describe(
      "Datos técnicos cortos presentes en la fuente: distancias, uso de wetsuit, desnivel, límite de tiempo. Vacío si la fuente no los da.",
    ),
  costo_min: z
    .number()
    .nullable()
    .describe(
      "Precio de inscripción más bajo que la fuente da explícitamente, en la moneda de la fuente. Null si la fuente no da cifra.",
    ),
  costo_max: z
    .number()
    .nullable()
    .describe(
      "Precio de inscripción más alto que la fuente da explícitamente. Si hay una sola cifra, igual a costo_min. Null si no hay cifra.",
    ),
  moneda: z
    .string()
    .nullable()
    .describe(
      "Código ISO 4217 de la moneda del costo (USD, PEN, MXN, COP, CLP, ARS, BRL, UYU, CRC…). Null si no hay costo o la fuente no aclara la moneda.",
    ),
  inscripcion_url: z
    .string()
    .nullable()
    .describe("URL de inscripción, copiada literal de la fuente. Null si no aparece."),
  confianza: z
    .number()
    .describe("0 a 1: qué tan explícita es la fuente sobre fecha y lugar"),
});

const RespuestaSchema = z.object({
  eventos: z.array(EventoSchema),
});

const SYSTEM = `Extraes eventos deportivos de resultados de búsqueda para un catálogo público.

REGLAS DURAS:
1. Solo extraes eventos que el texto menciona explícitamente con nombre y fecha. Si el texto no trae la fecha, el evento no existe para ti: no lo devuelves.
2. Nunca inventas ni completas datos por conocimiento propio. Si el texto no dice el lugar de partida, devuelves null. Si no dice las coordenadas, devuelves null en latitud y longitud. Un null es una respuesta correcta; un dato inventado no lo es.
3. fecha_inicio siempre en YYYY-MM-DD. Si la fuente da solo mes y año, el evento no califica: descártalo.
4. fuente_url debe ser la URL del bloque [n] del que sacaste ese evento, copiada literal.
5. categoria: 'running' (carrera a pie en calle o pista: maratón, media maratón, 10K, 5K), 'trail_running' (carrera de montaña o sendero, incluye ultras), 'cycling' (solo bicicleta: ruta, MTB, gran fondo), 'triatlon' (natación+ciclismo+carrera, incluye Ironman y 70.3), 'duatlon' (carrera+ciclismo+carrera), 'acuatlon' (natación+carrera), 'acuabike' (natación+ciclismo), 'aguas_abiertas' (solo natación). Si no encaja en ninguna, descarta el evento.
6. confianza refleja qué tan explícita fue la fuente: 0.9+ si dio nombre, fecha exacta y lugar de partida; 0.5 si dio nombre y fecha pero el lugar es ambiguo; menos de 0.4 si dudaste de la fecha.
7. Deduplica: si varios bloques describen el mismo evento, devuelves una sola entrada, la más completa.
8. Ignora ediciones pasadas. Solo eventos con fecha futura respecto a la fecha de hoy que te den.
9. etiquetas: el tipo de prueba, solo de la lista permitida y solo si la fuente lo respalda. Un evento puede llevar varias (una carrera con 42K y 21K lleva 'maraton' y 'media_maraton'). 'ironman_70_3' e 'ironman_full' son marcas registradas: úsalas solo si el nombre del evento dice Ironman o 70.3.
10. Costo: solo si el texto da una cifra de inscripción explícita, en la moneda del texto. Nunca conviertas monedas ni estimes por conocimiento propio. Si no hay cifra, o no queda clara la moneda, devuelves null en los tres campos de costo.

Si el texto no contiene ningún evento que cumpla las reglas, devuelves una lista vacía.`;

export interface OpcionesExtraccion {
  apiKey: string;
  modelo: string;
  hoy: string;
}

export async function extraerEventos(
  contexto: string,
  categoriaEsperada: Categoria,
  opts: OpcionesExtraccion,
): Promise<EventoExtraido[]> {
  const client = new Anthropic({ apiKey: opts.apiKey });

  const response = await client.messages.parse({
    model: opts.modelo,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(RespuestaSchema) },
    messages: [
      {
        role: "user",
        content: `Hoy es ${opts.hoy}. Búsqueda orientada a la categoría "${categoriaEsperada}", pero clasifica cada evento por lo que realmente es, no por la categoría buscada.

RESULTADOS DE BÚSQUEDA:
${contexto}`,
      },
    ],
  });

  // parsed_output es null si el modelo no produjo JSON válido contra el
  // esquema. Una corrida sin eventos y una corrida fallida no son lo mismo:
  // la segunda tiene que llegar a la bitácora como error.
  if (!response.parsed_output) {
    throw new Error(
      `El modelo no devolvió JSON válido (stop_reason=${response.stop_reason})`,
    );
  }

  return response.parsed_output.eventos as EventoExtraido[];
}
