"use client";

import { useState, type ReactNode } from "react";

/**
 * Desktop: 60/40, recorrido y alojamiento a la vez, ambos centrados en la
 * partida. Móvil: un solo panel a la vez — dos mapas de 300px apilados no son
 * dos mapas, son ninguno.
 */
export default function LienzoLogistico({
  mapa,
  alojamiento,
  leyenda,
}: {
  mapa: ReactNode;
  alojamiento: ReactNode;
  leyenda: ReactNode;
}) {
  const [panel, setPanel] = useState<"recorrido" | "alojamiento">("recorrido");

  return (
    <section aria-label="Recorrido y alojamiento" className="border-y border-black/10">
      <div className="flex items-center justify-between gap-4 px-4 py-2 md:px-6">
        <div className="hidden md:block">{leyenda}</div>
        <div
          role="tablist"
          aria-label="Vista del mapa"
          className="flex w-full gap-1 rounded-full bg-black/5 p-1 md:hidden"
        >
          {(["recorrido", "alojamiento"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={panel === v}
              onClick={() => setPanel(v)}
              className={`flex-1 rounded-full px-4 py-1.5 text-sm capitalize transition ${
                panel === v ? "bg-white shadow-sm font-medium" : "text-luanna-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid h-[70vh] min-h-[420px] grid-cols-1 md:grid-cols-[3fr_2fr]">
        <div className={`h-full ${panel === "recorrido" ? "block" : "hidden"} md:block`}>
          {mapa}
        </div>
        <div
          className={`h-full border-black/10 md:border-l ${
            panel === "alojamiento" ? "block" : "hidden"
          } md:block`}
        >
          {alojamiento}
        </div>
      </div>

      <div className="px-4 py-2 md:hidden">{leyenda}</div>
    </section>
  );
}
