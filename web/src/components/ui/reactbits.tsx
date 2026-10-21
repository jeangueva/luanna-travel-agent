'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

/**
 * Custom Geometric Technical SVG Primitives
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
 * ReactBits Primitive 1: BlurWordReveal
 * Staggered optical word reveal using IntersectionObserver and GPU transforms.
 * Respects prefers-reduced-motion automatically.
 */
export function BlurWordReveal({
  text,
  as: Tag = 'h1',
  className = '',
  highlightWords = [],
  highlightClassName = 'text-ancla-signal',
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

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    <Tag
      ref={containerRef as React.RefObject<never>}
      className={className}
    >
      {words.map((word, index) => {
        const cleanWord = word.replace(/[.,;:]/g, '').toLowerCase()
        const isHighlighted = normalizedHighlights.has(cleanWord)
        return (
          <span
            key={`${word}-${index}`}
            style={{
              transitionDelay: visible ? `${Math.min(index * 32, 360)}ms` : '0ms',
            }}
            className={`inline-block transition-[transform,opacity] duration-500 ease-out-strong ${
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0'
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
 * ReactBits + HorizonX Primitive 2: SpotlightTray (Double-Bezel / Doppelrand Hardware Enclosure)
 * Tracks cursor position directly via CSS custom properties without triggering React re-renders.
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
  const coreRef = useRef<HTMLDivElement>(null)

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = coreRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    el.style.setProperty('--spot-x', `${x}px`)
    el.style.setProperty('--spot-y', `${y}px`)
    el.style.setProperty('--spot-opacity', '1')
  }

  const handlePointerLeave = () => {
    const el = coreRef.current
    if (!el) return
    el.style.setProperty('--spot-opacity', '0')
  }

  const outerClass = variant === 'dark' ? 'doppelrand-dark' : 'doppelrand-light'
  const innerClass =
    variant === 'dark'
      ? 'doppelrand-dark-core spotlight-card spotlight-card-dark text-[#FDFCFA]'
      : 'doppelrand-light-core spotlight-card text-ancla-ink'

  return (
    <Tag className={`${outerClass} ${className}`} {...rest}>
      <div
        ref={coreRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`${innerClass} relative z-[1] ${coreClassName}`}
      >
        <div className="relative z-[2]">{children}</div>
      </div>
    </Tag>
  )
}

/**
 * ReactBits Primitive 3: TabularNumber
 * Smoothly interpolates numeric changes using ease-out quartic curve and tabular numerals.
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

    const duration = 260
    let startTime: number | null = null
    let rafId = 0

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Quartic ease-out
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
 * ReactBits + Emil Kowalski Primitive 4: SegmentedControl
 * Accessible WAI-ARIA tablist with ArrowLeft/ArrowRight support and GPU-translated active indicator.
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
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return
    }
    e.preventDefault()
    let nextIndex = activeIndex
    if (e.key === 'ArrowRight') nextIndex = (activeIndex + 1) % options.length
    if (e.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + options.length) % options.length
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
      ? 'bg-[#1e1e1b] border border-white/10 text-[#d8d5ce]'
      : 'bg-[#ebe7de] border border-[#161614]/10 text-ancla-inkSecondary'

  const pillStyle =
    tone === 'dark'
      ? 'bg-[#fdfcfa] text-[#11110f]'
      : 'bg-[#161614] text-[#fdfcfa]'

  const padClass = size === 'sm' ? 'py-1.5 px-3 text-xs' : 'py-2 px-4 text-[13px]'

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
      {/* Hardware-accelerated sliding active pill */}
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
            className={`relative z-10 flex items-center justify-center gap-2 rounded-full font-sans font-medium tracking-[-0.01em] transition-colors duration-150 ${padClass} ${
              isSelected
                ? tone === 'dark'
                  ? 'text-[#11110f]'
                  : 'text-[#fdfcfa]'
                : tone === 'dark'
                  ? 'text-[#a6a29a] hover:text-white'
                  : 'text-ancla-inkSecondary hover:text-ancla-ink'
            }`}
          >
            <span>{opt.label}</span>
            {opt.badge ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  isSelected
                    ? tone === 'dark'
                      ? 'bg-[#11110f]/10 text-[#11110f]'
                      : 'bg-white/15 text-white'
                    : tone === 'dark'
                      ? 'bg-white/10 text-[#d8d5ce]'
                      : 'bg-black/5 text-ancla-inkSecondary'
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
 * HorizonX Primitive 5: IslandButton (Button-in-Button Architecture)
 * Primary interactive pill button with nested circular trailing icon that translates diagonally on hover.
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
      outer: 'bg-ancla-obsidian text-[#fdfcfa] hover:bg-[#23231f]',
      circle: 'bg-white/12 text-[#fdfcfa]',
    },
    signal: {
      outer: 'bg-ancla-signal text-[#fdfcfa] hover:bg-[#9f3819]',
      circle: 'bg-black/15 text-[#fdfcfa]',
    },
    paper: {
      outer:
        'bg-[#fdfcfa] text-ancla-ink border border-ancla-lineStrong hover:border-ancla-ink',
      circle: 'bg-ancla-tray text-ancla-ink',
    },
  }[variant]

  const content = (
    <>
      <span className="pl-2 font-sans text-[14px] font-medium tracking-[-0.01em]">
        {children}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${variantStyles.circle}`}
      >
        <IconArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </>
  )

  const sharedClasses = `group press-scale inline-flex items-center gap-3 rounded-full p-1.5 pr-2 transition-colors duration-200 ${variantStyles.outer} ${className}`

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
