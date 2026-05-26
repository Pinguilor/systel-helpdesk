'use client'

import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

export interface GlobeRestaurant {
  sigla: string
  activeTickets: number
}

const CHILE_COORDS: [number, number][] = [
  [-33.45, -70.67], [-33.40, -70.56], [-33.51, -70.61],
  [-33.38, -70.65], [-33.57, -70.75], [-33.52, -70.58],
  [-33.49, -70.72], [-33.36, -70.68], [-33.42, -70.76],
  [-33.35, -70.73], [-33.06, -71.62], [-33.02, -71.55],
  [-36.82, -73.05], [-36.60, -72.10], [-35.43, -71.67],
  [-34.17, -70.74], [-38.74, -72.59], [-20.21, -70.15],
  [-23.65, -70.40], [-29.90, -71.25], [-41.47, -72.94],
  [-18.48, -70.33], [-22.46, -68.93], [-37.47, -72.35],
  [-53.16, -70.91],
]

function safeId(s: string) { return s.replace(/[^a-zA-Z0-9]/g, '-') }

export function GlobeBackground({ restaurants = [], className = '' }: { restaurants?: GlobeRestaurant[], className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<{ id: string; location: [number, number] }[]>([])

  // Actualización silenciosa sin causar re-render del efecto WebGL
  dataRef.current = restaurants.slice(0, CHILE_COORDS.length).map((r, i) => ({
    id: `gb-${safeId(r.sigla)}`,
    location: CHILE_COORDS[i],
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let phi = 0
    let globe: ReturnType<typeof createGlobe> | null = null
    let destroyed = false

    const init = () => {
      if (!canvas || destroyed) return
      const size = canvas.offsetWidth || 580

      globe = createGlobe(canvas, {
        devicePixelRatio: window.devicePixelRatio || 1,
        width: size,
        height: size,
        phi: 5.0,
        theta: -0.3,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 12000,
        mapBrightness: 5,
        baseColor: [0.15, 0.3, 0.6],
        markerColor: [0.05, 0.18, 0.53],
        glowColor: [0.3, 0.5, 0.8],
        markers: CHILE_COORDS.map(loc => ({ location: loc, size: 0.04 })),
        opacity: 0.55,
        onRender: (state: any) => {
          if (destroyed) return

          phi += 0.002
          state.phi = phi + 5.0
          state.theta = -0.3

          const r = size / 2
          const p = state.phi
          const t = state.theta

          dataRef.current.forEach(m => {
            const el = document.getElementById(m.id)
            if (!el) return

            const lat = m.location[0] * (Math.PI / 180)
            const lon = m.location[1] * (Math.PI / 180)
            const x3 = Math.cos(lat) * Math.sin(lon - p)
            const y3 = Math.sin(lat) * Math.cos(t) - Math.cos(lat) * Math.cos(lon - p) * Math.sin(t)
            const z3 = Math.sin(lat) * Math.sin(t) + Math.cos(lat) * Math.cos(lon - p) * Math.cos(t)

            if (z3 > 0.05) {
              el.style.transform = `translate(${r + r * x3}px, ${r - r * y3}px) translate(-50%, -150%)`
              el.style.opacity = '1'
            } else {
              el.style.opacity = '0'
            }
          })
        }
      } as any)
    }

    // setTimeout garantiza que el canvas tiene layout real antes de que cobe lo inicialice
    const timer = setTimeout(init, 150)

    return () => {
      destroyed = true
      clearTimeout(timer)
      globe?.destroy()
    }
  }, [])

  return (
    <div className={`relative w-[580px] h-[580px] ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {restaurants.slice(0, CHILE_COORDS.length).map((r) => {
        const id = `gb-${safeId(r.sigla)}`
        return (
          <div
            key={id}
            id={id}
            className="absolute top-0 left-0 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-md pointer-events-none z-50"
            style={{
              background: r.activeTickets > 0 ? 'rgba(14,49,135,0.9)' : 'rgba(100,116,139,0.5)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          >
            {r.sigla}
          </div>
        )
      })}
    </div>
  )
}
