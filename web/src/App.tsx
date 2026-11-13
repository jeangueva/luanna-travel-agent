import AnclaLanding from '@/components/AnclaLanding'

function App() {
  return (
    <div className="min-h-svh">
      <a
        href="#contenido"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-ancla-obsidian px-4 py-2 font-sans text-xs font-semibold text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido principal
      </a>
      <AnclaLanding />
    </div>
  )
}

export default App
