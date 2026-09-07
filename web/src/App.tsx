import Hero from '@/components/Hero'

function App() {
  return (
    <div className="min-h-svh">
      <a
        href="#contenido"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-luanna-dark px-4 py-2 font-sans text-sm font-semibold text-white transition-transform focus:translate-y-0"
      >
        Ir al contenido
      </a>
      <Hero />
    </div>
  )
}

export default App
