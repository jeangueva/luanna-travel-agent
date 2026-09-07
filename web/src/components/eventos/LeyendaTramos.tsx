import { COLOR_TRAMO, type Tramo } from "@/lib/eventos-types";

export default function LeyendaTramos({ tramos }: { tramos: Tramo[] }) {
  const conRuta = tramos.filter((t) => t.gpx_url);
  if (conRuta.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {conRuta.map((t) => (
        <li key={t.tipo} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="inline-block h-1 w-6 rounded-full"
            style={{ backgroundColor: COLOR_TRAMO[t.tipo] }}
          />
          {t.nombre}
        </li>
      ))}
    </ul>
  );
}
