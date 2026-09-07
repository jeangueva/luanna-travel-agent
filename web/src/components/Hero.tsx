'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

const VIDEO_URL =
  'https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4'

function NavButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-none bg-transparent font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-luanna-text transition-opacity duration-200 hover:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-luanna-text"
    >
      {children}
    </button>
  )
}

export default function Hero() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const [selectedFile, setSelectedFile] = useState('')

  const focusPlanner = () => {
    promptRef.current?.focus()
  }

  return (
    <section
      id="contenido"
      aria-labelledby="hero-title"
      className="relative min-h-svh w-full overflow-hidden bg-[#d9d1c5]"
    >
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />

      <div
        className="absolute inset-x-0 top-0 h-[687px] pointer-events-none z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      <div className="relative z-[2] max-w-[1360px] mx-auto">
        <nav
          aria-label="Navegación principal"
          className="relative flex items-center justify-between px-20 pb-4 pt-6 max-md:px-6 max-md:pt-5"
        >
          <span
            aria-label="Luanna"
            className="select-none font-display text-[40px] leading-none text-black max-md:text-[32px]"
          >
            luanna
          </span>

          <div className="absolute left-1/2 -translate-x-1/2 flex gap-8 max-md:hidden">
            <NavButton onClick={focusPlanner}>Cómo funciona</NavButton>
            <NavButton onClick={focusPlanner}>Qué incluye</NavButton>
            <NavButton onClick={focusPlanner}>Preguntas</NavButton>
          </div>

          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={focusPlanner}
              className="border-none bg-transparent font-sans text-[15px] font-semibold uppercase tracking-[0.04em] text-[#292929] transition-opacity duration-200 hover:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-luanna-text max-md:hidden"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={focusPlanner}
              className="rounded-full border-none bg-luanna-dark px-5 py-3.5 font-sans text-[15px] font-medium uppercase tracking-[0.04em] text-[#fafafa] transition-all duration-200 hover:bg-[#333] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-luanna-dark"
            >
              Habla con Luanna
            </button>
          </div>
        </nav>

        <div className="flex flex-col items-center px-6 pb-24 pt-16 text-center max-md:pt-12">
          <p className="mb-5 font-sans text-[13px] font-semibold uppercase tracking-[0.16em] text-luanna-prompt">
            Tu agente de viajes por WhatsApp
          </p>
          <h1
            id="hero-title"
            className="mb-5 max-w-[900px] text-balance font-sans text-[clamp(40px,6vw,68px)] font-medium leading-[1.05] tracking-[-0.04em] text-luanna-text"
          >
            Tu próximo viaje empieza con un mensaje
          </h1>
          <p className="mb-10 max-w-[590px] text-pretty font-sans text-xl font-medium leading-relaxed text-luanna-muted max-md:text-lg">
            Cuéntale a Luanna adónde quieres ir. Recibe un itinerario personalizado
            con vuelos y hoteles reales en menos de 60 segundos.
          </p>

          <div
            ref={promptRef}
            tabIndex={-1}
            aria-label="Planificador de viaje"
            className="relative min-h-[208px] w-[701px] overflow-hidden rounded-[44px] border-[3px] border-white bg-white/[0.06] shadow-[0_0_4px_0_rgba(62,42,26,0.18)] backdrop-blur-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white max-md:w-[calc(100vw-48px)] max-sm:min-h-[240px]"
          >
            <p className="absolute left-[29px] top-[57px] w-[609px] -translate-y-1/2 break-words text-left font-sans text-xl font-medium leading-relaxed text-luanna-prompt max-md:w-[calc(100%-58px)] max-md:text-[17px] max-sm:top-[72px]">
              Hola, Luanna. Quiero viajar 7 días a Japón en octubre. Me encantan la
              comida local, los cafés escondidos y las caminatas con vistas. Prefiero
              evitar las multitudes.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0]?.name ?? '')
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={
                selectedFile
                  ? `Cambiar archivo de inspiración: ${selectedFile}`
                  : 'Subir inspiración'
              }
              title={selectedFile || 'Subir inspiración'}
              className="absolute left-[21px] top-[137px] flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-transparent backdrop-blur-[14px] transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-sm:top-auto max-sm:bottom-[23px]"
            >
              <Upload className="w-[18px] h-[18px] text-luanna-text flex-shrink-0" />
            </button>

            <button
              type="button"
              className="absolute bottom-[21px] right-[21px] flex h-14 w-[176px] items-center justify-center rounded-[44px] border-none bg-black font-sans text-base font-medium uppercase tracking-[0.02em] text-[#fafafa] shadow-[0_0_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 hover:bg-[#333] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-sm:w-[166px]"
            >
              Enviar a Luanna
            </button>
          </div>

          <div
            aria-label="Beneficios de Luanna"
            className="mt-6 flex items-center gap-3 font-sans text-[13px] font-semibold text-luanna-text/70 max-sm:flex-wrap max-sm:justify-center"
          >
            <span>Vuelos reales</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-luanna-prompt/70" />
            <span>Hoteles optimizados</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-luanna-prompt/70" />
            <span>Confirmas antes de reservar</span>
          </div>
        </div>
      </div>
    </section>
  )
}
