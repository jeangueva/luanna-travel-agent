"use client";

import { useEffect, useState } from "react";
import { aFechaLocal } from "@/lib/fechas";

/**
 * El servidor no sabe en qué día está el visitante, así que renderizar la
 * cuenta regresiva durante el SSR produciría un número que se contradice al
 * hidratar — y, peor, quedaría congelado en el HTML cacheado por el CDN. Por
 * eso el primer render es un placeholder y el número aparece en el cliente.
 */
export default function CuentaRegresiva({ fecha }: { fecha: string }) {
  const [dias, setDias] = useState<number | null>(null);

  useEffect(() => {
    const calcular = () => {
      const ahora = new Date();
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
      setDias(Math.round((aFechaLocal(fecha).getTime() - hoy.getTime()) / 86400000));
    };
    calcular();
    // Un reloj por minuto basta: la unidad visible es el día.
    const id = setInterval(calcular, 60000);
    return () => clearInterval(id);
  }, [fecha]);

  if (dias === null) {
    return <span className="inline-block h-5 w-24 animate-pulse rounded bg-black/10" />;
  }
  if (dias < 0) return <span className="text-luanna-muted">Edición finalizada</span>;
  if (dias === 0) return <span className="font-semibold text-luanna-prompt">Es hoy</span>;
  if (dias === 1) return <span className="font-semibold text-luanna-prompt">Mañana</span>;
  return (
    <span>
      Faltan <strong className="text-luanna-prompt">{dias}</strong> días
    </span>
  );
}
