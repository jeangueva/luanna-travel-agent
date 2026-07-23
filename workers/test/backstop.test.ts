import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectStaleReprint } from "../src/index";

const withTools = (...names: string[]) => ({
  steps: [{ toolCalls: names.map((toolName) => ({ toolName })) }],
});

describe("detectStaleReprint", () => {
  // Real production transcript (2026-07-22): the bot's most recent reply
  // before the user's correction ("aquí está el link… ¿te arme paquete con
  // hotel?") doesn't say "vuelo" — only the turn BEFORE that does, via
  // "paquete vuelo+hotel". Neither message alone would trip FLIGHT_INTENT_RE
  // reliably; recentAssistantContext joins the last two for exactly this
  // shape (WhatsApp's teaser-then-short-follow-up pattern).
  const realPrevTeaser =
    "🥇 Lo más barato LIM → BUE: *$314* (~S/1067) | JA | 22 oct, directo. " +
    "Abre el primer link, Jean — directo y baratito en octubre 🔥 ¿Te busco hotel en Buenos Aires o paquete vuelo+hotel? 🏨";
  const realPrevFollowUp =
    "Listo Jean, aquí está el link para que veas los precios en vivo 👇 " +
    "Abre y compara — ahí te salen todas las opciones reales para esas fechas 🔍 ¿Quieres que te arme paquete con hotel? 🏨";

  test("follow-up price correction (no 'vuelo' in this turn, no price, no honest failure admission) → joined last-2-assistant-turns context still forces search_flights (reported live: bot hallucinated a bracket-placeholder link after 'el mas barato no es ese, hay uno de Sky a 276')", () => {
    assert.equal(
      detectStaleReprint(
        "El mas barato no es ese, entre al link y es uno de Sky a 276",
        {
          text: "Uy Jean, tienes razón 😬\n\nAquí tienes los links actualizados — ábrelos y mira los precios reales:\n\n**Lima → Buenos Aires (octubre):** [link vencimiento — busca de nuevo]\n\nSky suele ser lo más barato a Buenos Aires en temporada baja 🛫",
          ...withTools(),
        },
        `${realPrevTeaser} ${realPrevFollowUp}`,
      ),
      "search_flights",
    );
  });

  test("with only the SINGLE most recent message (no 'vuelo', just 'hotel'/'paquete') the correction is missed — this is why the fix joins the last TWO turns, not just one", () => {
    assert.equal(
      detectStaleReprint(
        "El mas barato no es ese, entre al link y es uno de Sky a 276",
        {
          text: "Uy Jean, tienes razón 😬 Aquí tienes los links actualizados — [link vencimiento — busca de nuevo]",
          ...withTools(),
        },
        realPrevFollowUp,
      ),
      "search_hotels", // "hotel"/"paquete" alone still misfires onto the wrong tool
    );
  });

  test("without ANY prior context, the same correction is missed entirely (documents why history threading was needed at all)", () => {
    assert.equal(
      detectStaleReprint(
        "El mas barato no es ese, entre al link y es uno de Sky a 276",
        {
          text: "Uy Jean, tienes razón 😬 Aquí tienes los links actualizados — [link vencimiento — busca de nuevo]",
          ...withTools(),
        },
      ),
      null,
    );
  });

  test("prior flight context (via 'vuelo' in the recent-context window) + reply falsely claims links → still forces search_flights even on a generic-sounding current turn", () => {
    assert.equal(
      detectStaleReprint(
        "gracias, eso es todo",
        {
          text: "¡De nada Jean! Aquí tienes los links por si cambias de opinión",
          ...withTools(),
        },
        "🥇 Lo más barato LIM → BUE: *$314* | JA | 22 oct, vuelo directo. ¿Te busco hotel?",
      ),
      "search_flights",
    );
    // Note: this intentionally still fires — "los links" + prior flight
    // context is exactly the false-promise shape the fix targets. A truly
    // unrelated close-out without any link mention in the reply would
    // correctly return null; see next test.
  });

  test("genuinely unrelated closing message, no link mention → no retry despite prior flight context", () => {
    assert.equal(
      detectStaleReprint(
        "gracias, eso es todo",
        { text: "¡De nada Jean! Que tengas buen viaje ✈️", ...withTools() },
        "🥇 Lo más barato LIM → BUE: *$314* | JA | 22 oct, directo.",
      ),
      null,
    );
  });

  test("itinerary opt-in + 'armando tu itinerario' ack + no start_itinerary call → force start_itinerary (reproduced live, zero trips row created)", () => {
    assert.equal(
      detectStaleReprint(
        "Sí, ármame el itinerario completo para Cusco, 4 días, me gusta la aventura y la comida local",
        {
          text: "Perfecto Jean! 🏔️ Armando tu itinerario completo para Cusco, 4 días con aventura + comida local...\n\nDame unos segundos mientras lo genero ⏳✨",
          ...withTools(),
        },
      ),
      "start_itinerary",
    );
  });

  test("start_itinerary ran → no retry", () => {
    assert.equal(
      detectStaleReprint("sí, arma mi itinerario para Lima", {
        text: "Perfecto! Armando tu itinerario, dame unos segundos ⏳",
        ...withTools("start_itinerary"),
      }),
      null,
    );
  });

  test("itinerary opt-in + UNPREDICTABLE hallucination phrasing (no 'generating' language at all) → still forces start_itinerary", () => {
    // Reproduced live: the exact same underlying bug (tool never called)
    // produced completely different reply wording on a second attempt —
    // "te dejé abajo el documento" instead of "armando... dame unos
    // segundos". A regex matching the MODEL's reply text can't keep up with
    // every hallucination variant; the fix checks only the user's opt-in.
    assert.equal(
      detectStaleReprint(
        "Sí, ármame el itinerario completo para Cusco, 4 días",
        {
          text: "Listo Jean, te dejé abajo el documento completo con tu itinerario de Cusco 📄✨ Toca para abrirlo.",
          ...withTools(),
        },
      ),
      "start_itinerary",
    );
  });

  test("itinerario mentioned casually, no building claim → no retry", () => {
    // e.g. suggest_itinerary's quick in-chat suggestion, unrelated to the
    // full-document tool — must not misfire on ordinary itinerario chatter.
    assert.equal(
      detectStaleReprint("dame ideas de itinerario para Cusco", {
        text: "Día 1: Plaza de Armas y San Blas. Día 2: Valle Sagrado. ¿Quieres que te arme el itinerario completo como documento?",
        ...withTools(),
      }),
      null,
    );
  });

  test("flight ask + prices + no search → force search_flights", () => {
    assert.equal(
      detectStaleReprint("busca vuelos de Lima a Cusco", {
        text: "El más barato: $264 Viva Air 21 ene",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + no-availability claim + no search → force search_flights", () => {
    assert.equal(
      detectStaleReprint("vuelos a San Andrés en enero", {
        text: "No hay precios en cache para enero 😅",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + PAST-TENSE accented 'No encontré' + no search → force search_flights (DeepSeek regression)", () => {
    // \w is ASCII-only in JS regex — "encontr\w+" silently never matched
    // "encontré". Found live: DeepSeek wrote "No encontré vuelos de LATAM
    // para Lima → Madrid" and promised a link it never wrote, and this
    // exact phrasing sailed through undetected because of the accent gap.
    assert.equal(
      detectStaleReprint("vuelos solo de LATAM de Lima a Madrid", {
        text: "No encontré vuelos de LATAM para Lima → Madrid el 15 de septiembre 😅 Pero igual te dejé el link directo.",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + irregular stem-changed 'No encuentro' + no search → force search_flights", () => {
    // "encontrar" is irregular: present tense diphthongizes to "encuentro",
    // a different stem than "encontr-" (infinitive/preterite/encontramos).
    assert.equal(
      detectStaleReprint("vuelos a Asunción", {
        text: "No encuentro vuelos LIM → Asunción en los próximos 6 meses, Jean 😅",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("false success claim: 'aquí tienes los links' with ZERO real link and no honest failure admission → force search_stays (Cancún airbnb bug)", () => {
    // Neither PRICE_TOKEN_RE nor NO_AVAIL_RE fires here — the model never
    // says a price and never admits failure, it just confidently promises
    // links that don't exist. Reproduced live: search_stays never ran.
    assert.equal(
      detectStaleReprint("busca un airbnb en Cancún del 20 al 25 de agosto", {
        text: "🏠 Ver en Airbnb:\n\n🔎 Ver en Booking:\n\nJean, aquí tienes los links para buscar alojamiento en Cancún del 20-25 de agosto 🌴",
        ...withTools(),
      }),
      "search_stays",
    );
  });

  test("false success claim with 'enlaces' (link synonym) + hotel intent → force search_hotels", () => {
    assert.equal(
      detectStaleReprint("hoteles en Madrid", {
        text: "Jean, te dejo los enlaces principales para que veas los hoteles disponibles.",
        ...withTools(),
      }),
      "search_hotels",
    );
  });

  test("search_flights ran → no retry", () => {
    assert.equal(
      detectStaleReprint("busca vuelos a Cusco", {
        text: "El más barato: $59",
        ...withTools("search_flights"),
      }),
      null,
    );
  });

  test("stall claim with NO price/no-avail/link-word ('voy a por ello, dame un instante') + tool never ran → force search_flights (reproduced live, no follow-up ever arrived)", () => {
    assert.equal(
      detectStaleReprint("busca vuelos de Lima a Buenos Aires en octubre", {
        text: "Voy a por ello — dame un instante mientras lo traigo 🔎",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("legit flight teaser's own 'dame unos segundos' line + search_flights DID run → no retry (the stall-claim signal must not misfire on real results)", () => {
    assert.equal(
      detectStaleReprint("busca vuelos a Cusco", {
        text: "🥇 Lo más barato: $59\nDame unos segundos para el resto de opciones… ⏳",
        ...withTools("search_flights"),
      }),
      null,
    );
  });

  test("clarifying question (no prices, no claim) → no retry", () => {
    assert.equal(
      detectStaleReprint("busca vuelos baratos", {
        text: "¿Desde qué ciudad sales y a dónde quieres ir? ✈️",
        ...withTools(),
      }),
      null,
    );
  });

  test("hotel ask + prices + no search → force search_hotels", () => {
    assert.equal(
      detectStaleReprint("hoteles en Cusco del 9 al 12", {
        text: "Ronda entre $60-150 la noche 🏨",
        ...withTools(),
      }),
      "search_hotels",
    );
  });

  test("airbnb wording routes to search_stays", () => {
    assert.equal(
      detectStaleReprint("busca un airbnb en Cusco", {
        text: "Hay depas desde $40 la noche",
        ...withTools(),
      }),
      "search_stays",
    );
  });

  test("hotel ask satisfied by search_stays → no retry", () => {
    assert.equal(
      detectStaleReprint("alojamiento en Cusco", {
        text: "Encontré opciones desde $50",
        ...withTools("search_stays"),
      }),
      null,
    );
  });

  test("combined ask: flights ran, hotels didn't → force search_hotels", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Cusco", {
        text: "Vuelo $59 y hoteles desde $60",
        ...withTools("search_flights"),
      }),
      "search_hotels",
    );
  });

  test("combined ask + reply promises links + get_package_link never ran → force get_package_link (Bogotá bug)", () => {
    assert.equal(
      detectStaleReprint("necesito vuelo y hotel para Bogotá del 10 al 14 de octubre", {
        text: "Para confirmar precios reales necesitas abrir los links — ahí eliges vuelo + hotel juntos ✅",
        ...withTools(),
      }),
      "get_package_link",
    );
  });

  test("explicit 'paquete' word + link mention + tool never ran → force get_package_link", () => {
    assert.equal(
      detectStaleReprint("arma un paquete a Cancún", {
        text: "Aquí tienes los links del paquete completo",
        ...withTools(),
      }),
      "get_package_link",
    );
  });

  test("get_package_link ran → no retry even if reply mentions links", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Bogotá", {
        text: "Aquí los links: ...",
        ...withTools("get_package_link"),
      }),
      null,
    );
  });

  test("reply already has a real /r/ link → no retry (nothing to force)", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Bogotá", {
        text: "Aquí el link: https://luanna.app/r/AbC123",
        ...withTools(),
      }),
      null,
    );
  });

  test("only flight intent (no lodging, no 'paquete') + link mention → package branch stands down, general flight branch still forces search_flights", () => {
    // The package-specific branch requires combined intent, so it doesn't
    // fire here — but this exact shape (false link promise, single-intent
    // ask, tool never ran) is the general false-link-promise case the fix
    // is meant to catch, so the flight branch below correctly forces it.
    assert.equal(
      detectStaleReprint("vuelos a Bogotá", {
        text: "Te paso el link en un momento",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("non-travel message with prices → no retry", () => {
    assert.equal(
      detectStaleReprint("cuánto es 100 dólares en soles", {
        text: "$100 son S/375 aprox",
        ...withTools(),
      }),
      null,
    );
  });
});
