'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Compass, Pause, Play } from 'lucide-react'

const VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <a href="/" className="glass-brand" aria-label="Luanna Ancla, inicio">
    <Compass aria-hidden="true" size={30} strokeWidth={1.25} />
    {!compact && <span>luanna<span className="brand-sub">ancla</span></span>}
  </a>
}

export function GlassShell({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [source, setSource] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const preference = () => {
      let paused = false
      try { paused = localStorage.getItem('luanna-video-paused') === 'true' } catch { /* Storage is optional. */ }
      if (media.matches || paused) { video.current?.pause(); return }
      setSource(true)
    }
    preference()
    media.addEventListener('change', preference)
    return () => media.removeEventListener('change', preference)
  }, [])
  useEffect(() => {
    if (source) void video.current?.play().catch(() => setPlaying(false))
  }, [source])
  async function toggle() {
    if (playing) {
      video.current?.pause()
      try { localStorage.setItem('luanna-video-paused', 'true') } catch { /* Optional. */ }
    } else {
      try { localStorage.setItem('luanna-video-paused', 'false') } catch { /* Optional. */ }
      if (!source) setSource(true)
      else await video.current?.play().catch(() => setFailed(true))
    }
  }
  return <div className={`luanna-glass ${workspace ? 'glass-workspace' : ''}`}>
    <div className="glass-backdrop" aria-hidden="true">
      <video ref={video} src={source ? VIDEO : undefined} muted loop playsInline preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false) }} />
    </div>
    <div className="glass-content">{children}</div>
    <button type="button" className="ambient-control liquid-glass" onClick={toggle} disabled={failed}
      aria-label={playing ? 'Pausar video de fondo' : 'Reproducir video de fondo'} title={failed ? 'Fondo estático: video no disponible' : undefined}>
      {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      <span>{failed ? 'Fondo estático' : playing ? 'Pausar fondo' : 'Activar fondo'}</span>
    </button>
  </div>
}
