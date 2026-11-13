'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

/**
 * Compact Line Symbols (Hopper + Refero + Agentic Design System)
 * Consistent 1.75px stroke weight, zero generic icon packs, zero emojis.
 */
export function IconArrowUpRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.5 11.5L11.5 4.5" />
      <path d="M5.5 4.5H11.5V10.5" />
    </svg>
  )
}

export function IconSearch({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  )
}

export function IconCrosshair({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="4.5" />
      <path d="M8 1.5V3.5M8 12.5V14.5M1.5 8H3.5M12.5 8H14.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8.5L6.25 11.75L13 4.5" />
    </svg>
  )
}

export function IconCopy({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" />
      <path d="M10.5 5.5V3.5C10.5 2.95 10.05 2.5 9.5 2.5H3.5C2.95 2.5 2.5 2.95 2.5 3.5V9.5C2.5 10.05 2.95 10.5 3.5 10.5H5.5" />
    </svg>
  )
}

export function IconTerminal({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <rect x="1.75" y="2.5" width="12.5" height="11" rx="1.5" />
      <path d="M4.75 6.25L7 8.25L4.75 10.25" />
      <path d="M8.5 10.25H11.25" />
    </svg>
  )
}

export function IconShield({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 2L13 4V7.8C13 11 10.85 13.35 8 14.2C5.15 13.35 3 11 3 7.8V4L8 2Z" />
      <path d="M6 8.2L7.4 9.6L10.3 6.5" />
    </svg>
  )
}

export function IconRoute({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
      className={className}
    >
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <path d="M5.75 4H10.25C11.35 4 12 4.65 12 5.75V6.25C12 7.35 11.35 8 10.25 8H5.75C4.65 8 4 8.65 4 9.75V10.25C4 11.35 4.65 12 5.75 12H10.25" />
    </svg>
  )
}

/**
 * ScrollShaders Primitive (`scrollshaders.com/components`):
 * GPU-accelerated WebGL / Canvas 2D Atmospheric Fluted Light & Liquid Refraction overlay
 * that responds to scroll position and pointer coordinates inside the 32px Hopper Hero Frame.
 */
export function AtmosphericHorizonShader({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let rafId = 0
    let pointerX = 0.5
    let pointerY = 0.38
    let scrollOffset = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(320, Math.floor(rect.width * dpr))
      canvas.height = Math.max(200, Math.floor(rect.height * dpr))
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      pointerX = (e.clientX - rect.left) / rect.width
      pointerY = (e.clientY - rect.top) / rect.height
    }

    const onScroll = () => {
      scrollOffset = window.scrollY * 0.0015
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    const renderFrame = (timeMs: number) => {
      const t = timeMs * 0.00055 + scrollOffset
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      // Subtle atmospheric daylight refraction (very low opacity so photography stays natural)
      const cx = w * (0.5 + (pointerX - 0.5) * 0.12 + Math.sin(t) * 0.04)
      const cy = h * (0.38 + (pointerY - 0.38) * 0.1 + Math.cos(t * 0.7) * 0.04)
      const grad1 = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, w * 0.55)
      grad1.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
      grad1.addColorStop(0.5, 'rgba(24, 120, 236, 0.08)')
      grad1.addColorStop(1, 'rgba(10, 20, 35, 0)')
      ctx.fillStyle = grad1
      ctx.fillRect(0, 0, w, h)

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame)
      }
    }

    renderFrame(0)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full mix-blend-screen ${className}`}
    />
  )
}

/**
 * Scrolltide Primitive (`scrolltide.co`):
 * Top viewport scroll progress telemetry bar in Hopper Blue (#1878ec).
 */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const doc = document.documentElement
      const total = doc.scrollHeight - doc.clientHeight
      if (total <= 0) {
        setProgress(0)
        return
      }
      setProgress(Math.min(1, Math.max(0, window.scrollY / total)))
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 right-0 left-0 z-50 h-[3px] bg-transparent"
    >
      <div
        style={{
          transform: `scaleX(${progress})`,
          transformOrigin: '0% 50%',
        }}
        className="h-full w-full bg-[#1878ec] transition-transform duration-75 ease-out"
      />
    </div>
  )
}

/**
 * BlurWordReveal: Staggered word reveal using IntersectionObserver and GPU transforms.
 */
export function BlurWordReveal({
  text,
  as: Tag = 'h1',
  className = '',
  highlightWords = [],
  highlightClassName = 'text-[#1878ec]',
}: {
  text: string
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  className?: string
  highlightWords?: string[]
  highlightClassName?: string
}) {
  const containerRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const words = text.split(' ')
  const normalizedHighlights = new Set(highlightWords.map((w) => w.toLowerCase()))

  return (
    <Tag ref={containerRef as React.RefObject<never>} className={className}>
      {words.map((word, index) => {
        const cleanWord = word.replace(/[.,;:]/g, '').toLowerCase()
        const isHighlighted = normalizedHighlights.has(cleanWord)
        return (
          <span
            key={`${word}-${index}`}
            style={{
              transitionDelay: visible ? `${Math.min(index * 28, 320)}ms` : '0ms',
            }}
            className={`inline-block transition-[transform,opacity] duration-500 ease-out-strong ${
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            } ${isHighlighted ? highlightClassName : ''}`}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </span>
        )
      })}
    </Tag>
  )
}

/**
 * SpotlightTray: Hopper + Agentic Design System Surface Enclosure
 * Flat, border-led surfaces (16px radius on #f6f6f6 Cloud, 32px radius on #ffffff White, 1px solid #d9d9d9, zero box-shadow).
 */
export function SpotlightTray({
  children,
  variant = 'light',
  className = '',
  coreClassName = '',
  as: Tag = 'div',
  ...rest
}: {
  children: React.ReactNode
  variant?: 'light' | 'dark'
  className?: string
  coreClassName?: string
  as?: 'div' | 'section' | 'article' | 'aside'
} & React.HTMLAttributes<HTMLElement>) {
  const surfaceClass =
    variant === 'dark'
      ? 'rounded-[32px] border border-[#d9d9d9] bg-white text-[#111111]'
      : 'rounded-[16px] border border-[#d9d9d9] bg-[#f6f6f6] text-[#111111]'

  return (
    <Tag className={`${surfaceClass} ${className}`} {...rest}>
      <div className={coreClassName}>{children}</div>
    </Tag>
  )
}

/**
 * TabularNumber: Smooth numeric interpolation with tabular numerals.
 */
export function TabularNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousRef = useRef(value)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(value)
      previousRef.current = value
      return
    }

    const startValue = previousRef.current
    const delta = value - startValue
    if (Math.abs(delta) < 0.01) {
      setDisplayValue(value)
      return
    }

    const duration = 240
    let startTime: number | null = null
    let rafId = 0

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplayValue(startValue + delta * eased)

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step)
      } else {
        previousRef.current = value
      }
    }

    rafId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(rafId)
  }, [value])

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

/**
 * SegmentedControl: Accessible WAI-ARIA tablist styled with Hopper pills (9999px radius, 1px #d9d9d9 border, #1878ec active state).
 */
export interface SegmentOption<T extends string> {
  id: T
  label: string
  badge?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'light',
  size = 'md',
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
  tone?: 'light' | 'dark'
  size?: 'sm' | 'md'
}) {
  const baseId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    ) {
      return
    }
    e.preventDefault()
    let nextIndex = activeIndex
    if (e.key === 'ArrowRight') nextIndex = (activeIndex + 1) % options.length
    if (e.key === 'ArrowLeft')
      nextIndex = (activeIndex - 1 + options.length) % options.length
    if (e.key === 'Home') nextIndex = 0
    if (e.key === 'End') nextIndex = options.length - 1

    const nextOption = options[nextIndex]
    if (nextOption) {
      onChange(nextOption.id)
      buttonRefs.current[nextIndex]?.focus()
    }
  }

  const containerStyle =
    tone === 'dark'
      ? 'bg-white/15 border border-white/40 text-white'
      : 'bg-[#f6f6f6] border border-[#d9d9d9] text-[#606060]'

  const pillStyle =
    tone === 'dark'
      ? 'bg-white text-[#111111]'
      : 'bg-[#1878ec] text-white'

  const padClass =
    size === 'sm'
      ? 'py-2 px-3 text-[14px] leading-[20px] font-semibold'
      : 'py-2 px-4 text-[16px] leading-[24px] font-semibold'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
      className={`relative inline-grid rounded-full p-1 select-none ${containerStyle}`}
    >
      <span
        aria-hidden="true"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        className={`pointer-events-none absolute top-1 bottom-1 left-1 rounded-full transition-transform duration-200 ease-out-strong ${pillStyle}`}
      />

      {options.map((opt, idx) => {
        const isSelected = opt.id === value
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonRefs.current[idx] = el
            }}
            id={`${baseId}-tab-${opt.id}`}
            role="tab"
            type="button"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 flex items-center justify-center gap-2 rounded-full font-sans transition-colors duration-150 ${padClass} ${
              isSelected
                ? tone === 'dark'
                  ? 'text-[#111111]'
                  : 'text-white'
                : tone === 'dark'
                  ? 'text-white/85 hover:text-white'
                  : 'text-[#606060] hover:text-[#111111]'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  isSelected
                    ? tone === 'dark'
                      ? 'bg-[#1878ec] text-white'
                      : 'bg-white/25 text-white'
                    : tone === 'dark'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#ededed] text-[#606060]'
                }`}
              >
                {opt.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * IslandButton: Hopper 1000px Pill Button with circular trailing icon (`cta.gallery` pattern).
 */
export function IslandButton({
  children,
  onClick,
  href,
  variant = 'obsidian',
  type = 'button',
  className = '',
  ariaLabel,
}: {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  variant?: 'obsidian' | 'signal' | 'paper'
  type?: 'button' | 'submit'
  className?: string
  ariaLabel?: string
}) {
  const variantStyles = {
    obsidian: {
      outer: 'bg-[#1878ec] text-white hover:bg-[#1466ca]',
      circle: 'bg-white/20 text-white',
    },
    signal: {
      outer: 'bg-[#111111] text-white hover:bg-[#2a2a2a]',
      circle: 'bg-white/15 text-white',
    },
    paper: {
      outer:
        'bg-white text-[#111111] border border-[#d9d9d9] hover:border-[#111111]',
      circle: 'bg-[#f6f6f6] text-[#1878ec]',
    },
  }[variant]

  const content = (
    <>
      <span className="pl-3 font-sans text-[16px] leading-[24px] font-semibold">
        {children}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${variantStyles.circle}`}
      >
        <IconArrowUpRight className="h-4 w-4" />
      </span>
    </>
  )

  const sharedClasses = `group press-scale inline-flex items-center gap-2 rounded-full py-2 pr-2 pl-2 transition-colors duration-200 ${variantStyles.outer} ${className}`

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} className={sharedClasses}>
        {content}
      </a>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={sharedClasses}
    >
      {content}
    </button>
  )
}
