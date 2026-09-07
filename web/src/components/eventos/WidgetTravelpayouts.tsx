"use client";

import { useEffect, useRef } from "react";

/**
 * Los widgets de Travelpayouts son scripts que se inyectan a sí mismos en el
 * nodo padre. React no monta un <script> escrito en el JSX, así que hay que
 * crearlo a mano y limpiarlo al desmontar — si no, navegar entre eventos
 * apila widgets del evento anterior.
 */
export default function WidgetTravelpayouts({
  src,
  titulo,
}: {
  src: string;
  titulo: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || !src) return;

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.charset = "utf-8";
    nodo.appendChild(script);

    return () => {
      nodo.replaceChildren();
    };
  }, [src]);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{titulo}</h3>
      <div ref={contenedor} className="min-h-[60px]" />
    </div>
  );
}
