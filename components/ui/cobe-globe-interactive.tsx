"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import createGlobe from "cobe"
import { isHalloween } from "@/lib/theme"

export interface InteractiveMarker {
  id: string
  location: [number, number]
  name: string
  users: number // Number of active tickets
}

interface GlobeInteractiveProps {
  markers?: InteractiveMarker[]
  className?: string
  speed?: number
  backgroundMode?: boolean
}

const DEFAULT_GLOBE = {
  dark: 0,
  baseColor: [0.15, 0.3, 0.6], // Dark blue continents for contrast
  markerColor: [0.05, 0.19, 0.53], // Dark blue markers (#0e3187)
  glowColor: [0.3, 0.5, 0.8], // Blue glow
}

// Tema Halloween: globo naranja incandescente, nodos violeta y "telaraña de datos" de arcos
const HALLOWEEN_GLOBE = {
  dark: 1,
  baseColor: [1, 0.42, 0.12],
  markerColor: [0.62, 0.36, 0.95],
  glowColor: [0.45, 0.12, 0.1],
  arcColor: [1, 0.72, 0.5],
  arcWidth: 0.35,
  arcHeight: 0.12,
}

// Malla tipo telaraña: cada nodo se une a sus 2 vecinos más cercanos
function buildWebArcs(markers: InteractiveMarker[]) {
  const seen = new Set<string>()
  const arcs: { from: [number, number]; to: [number, number]; fromUsers: number; toUsers: number }[] = []
  const dist = (a: InteractiveMarker, b: InteractiveMarker) => {
    const dLon = Math.abs(a.location[1] - b.location[1])
    return Math.hypot(a.location[0] - b.location[0], Math.min(dLon, 360 - dLon))
  }
  markers.forEach((m) => {
    [...markers]
      .filter((o) => o.id !== m.id)
      .sort((a, b) => dist(m, a) - dist(m, b))
      .slice(0, 2)
      .forEach((o) => {
        const key = [m.id, o.id].sort().join("|")
        if (seen.has(key)) return
        seen.add(key)
        arcs.push({ from: m.location, to: o.location, fromUsers: m.users, toUsers: o.users })
      })
  })
  return arcs
}

// Proyecta un nodo (lat/lon) a coordenadas 2D del disco; z > 0 = cara visible
function projectNode(location: [number, number], phi: number, theta: number, r: number, sphereRadius: number) {
  const lat = (location[0] * Math.PI) / 180
  const lon = (location[1] * Math.PI) / 180
  const x3d = Math.cos(lat) * Math.sin(lon + phi)
  const y3d = Math.sin(lat) * Math.cos(theta) - Math.cos(lat) * Math.cos(lon + phi) * Math.sin(theta)
  const z3d = Math.sin(lat) * Math.sin(theta) + Math.cos(lat) * Math.cos(lon + phi) * Math.cos(theta)
  return { x: r + sphereRadius * x3d, y: r - sphereRadius * y3d, z: z3d }
}

// Cráteres y mares de la luna: viven en lat/lon y rotan junto con los nodos
type MoonSpot = { lat: number; lon: number; ang: number; maria: boolean }
const MOON_SPOTS: MoonSpot[] = (() => {
  let t = 20261031
  const rnd = () => {
    t = (t + 0x6d2b79f5) | 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  const spots: MoonSpot[] = []
  for (let i = 0; i < 9; i++) spots.push({ lat: Math.asin(rnd() * 1.6 - 0.8), lon: rnd() * Math.PI * 2, ang: 0.3 + rnd() * 0.3, maria: true })
  for (let i = 0; i < 56; i++) {
    const big = rnd() < 0.18
    spots.push({ lat: Math.asin(rnd() * 1.9 - 0.95), lon: rnd() * Math.PI * 2, ang: big ? 0.13 + rnd() * 0.07 : 0.035 + rnd() * 0.07, maria: false })
  }
  return spots
})()

function drawMoonCraters(canvas: HTMLCanvasElement, phi: number, theta: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const size = Math.round(canvas.clientWidth * dpr)
  if (!size) return
  if (canvas.width !== size) { canvas.width = size; canvas.height = size }
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const R = size / 2
  for (const s of MOON_SPOTS) {
    const x3d = Math.cos(s.lat) * Math.sin(s.lon + phi)
    const y3d = Math.sin(s.lat) * Math.cos(theta) - Math.cos(s.lat) * Math.cos(s.lon + phi) * Math.sin(theta)
    const z3d = Math.sin(s.lat) * Math.sin(theta) + Math.cos(s.lat) * Math.cos(s.lon + phi) * Math.cos(theta)
    if (z3d < 0.04) continue
    const px = R + R * x3d, py = R - R * y3d
    const rr = R * Math.sin(s.ang)
    const ang = Math.atan2(py - R, px - R)
    const fade = Math.min(1, z3d / 0.3) * Math.pow(z3d, 0.35)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(ang)
    ctx.scale(Math.max(z3d, 0.05), 1)
    ctx.globalAlpha = fade
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr)
    if (s.maria) {
      g.addColorStop(0, "rgba(120,114,100,.20)")
      g.addColorStop(0.6, "rgba(120,114,100,.12)")
      g.addColorStop(1, "rgba(120,114,100,0)")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill()
    } else {
      g.addColorStop(0, "rgba(141,136,120,.12)")
      g.addColorStop(0.7, "rgba(125,120,104,.28)")
      g.addColorStop(0.92, "rgba(95,90,76,.44)")
      g.addColorStop(1, "rgba(95,90,76,0)")
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill()
      // borde iluminado hacia la luz (arriba-izquierda), girado al marco local del cráter
      const sh = rr * 0.09
      const lx = (0.7 * Math.cos(-ang) - 0.7 * Math.sin(-ang)) * sh
      const ly = (0.7 * Math.sin(-ang) + 0.7 * Math.cos(-ang)) * sh
      ctx.beginPath(); ctx.arc(0, 0, rr * 0.96, 0, Math.PI * 2); ctx.clip()
      ctx.strokeStyle = "rgba(255,255,255,.4)"
      ctx.lineWidth = Math.max(1, rr * 0.06)
      ctx.beginPath(); ctx.arc(lx, ly, rr * 0.9, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }
}

export function GlobeInteractive({
  markers = [],
  className = "",
  speed = 0.003,
  backgroundMode = false,
}: GlobeInteractiveProps) {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const moonCratersRef = useRef<HTMLCanvasElement>(null)
  const phiRef = useRef(0)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  // Tema Halloween: la red de datos son líneas SVG sobre la luna (los nodos siguen proyectándose igual)
  const moonArcs = useMemo(
    () => (isHalloween
      ? buildWebArcs(markers).map((a, i) => ({ ...a, key: i, hot: a.fromUsers > 0 || a.toUsers > 0 }))
      : []),
    [markers]
  )

  useEffect(() => {
    setMounted(true)
    console.log("Globe component mounted on client")
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (backgroundMode) return
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasElement) canvasElement.style.cursor = "grabbing"
    isPausedRef.current = true
  }

  const handlePointerUp = () => {
    if (backgroundMode) return
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasElement) canvasElement.style.cursor = "grab"
    isPausedRef.current = false
  }

  useEffect(() => {
    if (backgroundMode) return
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    const upHandler = () => handlePointerUp()
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", upHandler, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", upHandler)
    }
  }, [backgroundMode])

  useEffect(() => {
    console.log("Globe useEffect triggered. mounted:", mounted, "canvasElement:", !!canvasElement, "markers count:", markers.length)
    if (!mounted || !canvasElement) return
    const canvas = canvasElement
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationFrameId: number

    function init() {
      const width = canvas.offsetWidth
      console.log("Globe init() executing. canvas offsetWidth:", width)
      if (width === 0) {
        console.warn("Globe init aborted: offsetWidth is 0")
        return
      }
      if (globe) {
        console.warn("Globe init aborted: globe already exists")
        return // already initialized
      }

      try {
        console.log("Calling createGlobe standard builder...")
        if (!isHalloween) globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          width,
          height: width,
          phi: 5.0, // Initial focus near Chile longitude (-70 deg -> ~5.0 rad)
          theta: -0.4, // Initial vertical tilt looking at South America (-0.4 rad)
          ...(isHalloween ? HALLOWEEN_GLOBE : DEFAULT_GLOBE),
          diffuse: 1.5,
          mapSamples: 16000,
          mapBrightness: 8,
          markerElevation: 0,
          markers: markers.map((m) => ({ location: m.location, size: backgroundMode ? 0.045 : 0.03, id: m.id })),
          arcs: [],
          opacity: 0.85,
        } as any)
        console.log("Globe instance created successfully:", globe)

        // Custom animation loop using requestAnimationFrame and globe.update()
        const animate = () => {
          if (!isPausedRef.current) {
            phiRef.current += speed
          }
          const currentPhi = phiRef.current + phiOffsetRef.current + dragOffset.current.phi + 5.0
          const currentTheta = -0.4 + thetaOffsetRef.current + dragOffset.current.theta

          // Force redraw by calling update on cobe globe instance
          if (globe) {
            globe.update({
              phi: currentPhi,
              theta: currentTheta,
            } as any)
          }


          // Project 3D markers to 2D HTML coordinates
          const r = width / 2
          const sphereRadius = r * 0.83
          
          if (isHalloween) {
            if (moonCratersRef.current) drawMoonCraters(moonCratersRef.current, currentPhi, currentTheta)
            moonArcs.forEach((a) => {
              const el = document.getElementById(`hw-arc-${a.key}`)
              if (!el) return
              const p1 = projectNode(a.from, currentPhi, currentTheta, r, sphereRadius)
              const p2 = projectNode(a.to, currentPhi, currentTheta, r, sphereRadius)
              if (p1.z > 0.05 && p2.z > 0.05) {
                // el arco de círculo máximo se abomba hacia afuera del centro respecto a la cuerda
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
                const cx = r + (mx - r) * 1.18, cy = r + (my - r) * 1.18
                el.setAttribute("d", `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
                el.style.opacity = a.hot ? "0.9" : "0.55"
              } else {
                el.style.opacity = "0"
              }
            })
          }

          markers.forEach((m) => {
            const lat = (m.location[0] * Math.PI) / 180
            const lon = (m.location[1] * Math.PI) / 180

            const x3d = Math.cos(lat) * Math.sin(lon + currentPhi)
            const y3d = Math.sin(lat) * Math.cos(currentTheta) - Math.cos(lat) * Math.cos(lon + currentPhi) * Math.sin(currentTheta)
            const z3d = Math.sin(lat) * Math.sin(currentTheta) + Math.cos(lat) * Math.cos(lon + currentPhi) * Math.cos(currentTheta)

            const isVisible = z3d > 0.05
            const x2d = r + sphereRadius * x3d
            const y2d = r - sphereRadius * y3d

            const el = document.getElementById(`cobe-marker-${m.id}`)
            if (el) {
              if (isVisible) {
                const targetOpacity = backgroundMode 
                  ? (m.users > 0 ? "0.95" : "0.7")
                  : "1";
                el.style.opacity = targetOpacity
                el.style.transform = `translate3d(${x2d}px, ${y2d}px, 0) translate(-50%, -50%)`
                el.style.pointerEvents = backgroundMode ? "none" : "auto"
              } else {
                el.style.opacity = "0"
                el.style.pointerEvents = "none"
              }
            }
          })

          animationFrameId = requestAnimationFrame(animate)
        }

        // Start animation loop
        animationFrameId = requestAnimationFrame(animate)

      } catch (err) {
        console.error("Exception thrown inside createGlobe builder:", err)
      }
    }

    if (canvas.offsetWidth > 0) {
      console.log("Canvas width is already > 0. Initializing directly.")
      init()
    } else {
      console.log("Canvas width is 0. Setting up ResizeObserver.")
      const ro = new ResizeObserver((entries) => {
        const observedWidth = entries[0]?.contentRect.width || 0
        console.log("ResizeObserver fired. Observed width:", observedWidth)
        if (observedWidth > 0) {
          ro.disconnect()
          console.log("Disconnecting ResizeObserver and calling init()")
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      console.log("Globe useEffect cleanup triggered. Destroying instance.")
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (globe) {
        globe.destroy()
        console.log("Globe instance destroyed successfully")
      }
    }
  }, [mounted, canvasElement, markers, moonArcs, speed, backgroundMode])

  if (!mounted) {
    return (
      <div className={`relative aspect-square select-none flex items-center justify-center bg-slate-50/50 rounded-full border border-slate-100 ${className}`}>
        <div className="w-8 h-8 border-4 border-[#0e3187]/20 border-t-[#0e3187] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`relative aspect-square select-none ${className}`}>
      <style>{`
        @keyframes fade-slide-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 0.9; transform: translateY(0); }
        }
      `}</style>
      {isHalloween && <div className="hw-globe-glow" aria-hidden="true" />}
      {isHalloween && <div className="hw-moon" aria-hidden="true" />}
      {isHalloween && <canvas ref={moonCratersRef} className="hw-moon-craters" aria-hidden="true" />}
      {isHalloween && (
        <svg className="hw-moon-web" viewBox={`0 0 ${canvasElement?.offsetWidth || 1000} ${canvasElement?.offsetWidth || 1000}`} aria-hidden="true">
          {moonArcs.map((a) => (
            <path key={a.key} id={`hw-arc-${a.key}`} d="" fill="none" stroke={a.hot ? "var(--hw-moon-arc-hot)" : "var(--hw-moon-arc)"} strokeWidth={a.hot ? 1.6 : 1.1} strokeLinecap="round" style={{ opacity: 0 }} />
          ))}
        </svg>
      )}
      <canvas
        ref={setCanvasElement}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: backgroundMode ? "default" : "grab",
          opacity: isHalloween ? 0 : mounted ? (backgroundMode ? 0.85 : 1) : 0,
          transition: "opacity 0.3s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          id={`cobe-marker-${m.id}`}
          onClick={backgroundMode ? undefined : (e) => {
            e.stopPropagation()
            setExpanded(expanded === m.id ? null : m.id)
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate3d(0, 0, 0) translate(-50%, -50%)",
            marginTop: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: backgroundMode ? "0.2rem 0.4rem" : (expanded === m.id ? "0.35rem 0.55rem" : "0.25rem 0.45rem"),
            background: isHalloween
              ? (m.users > 0 ? "var(--hw-node-hot, #c2410c)" : "var(--hw-node, #6d28d9)")
              : backgroundMode ? (m.users > 0 ? "rgba(14, 49, 135, 0.95)" : "rgba(15, 23, 42, 0.85)") : "#0e3187", // High contrast dark slate for inactive ones
            color: "#fff",
            borderRadius: backgroundMode ? 5 : 6,
            cursor: backgroundMode ? "default" : "pointer",
            boxShadow: isHalloween ? (m.users > 0 ? "0 0 0 1px rgba(255,255,255,.9), 0 2px 8px rgba(255,84,0,.55)" : "0 0 0 1px rgba(255,255,255,.85), 0 2px 8px rgba(123,44,191,.5)") : backgroundMode ? "0 2px 5px rgba(0,0,0,0.15)" : "0 4px 10px rgba(14,49,135,0.25)",
            border: isHalloween ? (m.users > 0 ? "1px solid #ff6d00" : "1px solid #9d4edd") : backgroundMode ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.15)",
            opacity: 0,
            transition: backgroundMode ? "opacity 0.3s, transform 0.1s" : "opacity 0.3s, transform 0.1s, padding 0.2s, background-color 0.2s",
            zIndex: backgroundMode ? 1 : (expanded === m.id ? 10 : 2),
            pointerEvents: backgroundMode ? "none" : "auto",
          }}
          className={backgroundMode ? "" : "hover:bg-[#1846b9]"}
        >
          <span style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: backgroundMode ? "0.6rem" : "0.7rem",
            fontWeight: 800,
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            gap: "0.2rem",
          }}>
            <span>{m.name}</span>
            {m.users > 0 && (
              <span style={{
                background: "#fff",
                color: isHalloween ? "#7c2d12" : "#0e3187",
                fontSize: backgroundMode ? "0.45rem" : "0.55rem",
                fontWeight: 900,
                padding: "0.01rem 0.2rem",
                borderRadius: "3px",
                minWidth: "10px",
                textAlign: "center",
              }}>{m.users}</span>
            )}
          </span>
          {!backgroundMode && expanded === m.id && (
            <span style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "0.55rem",
              fontWeight: 700,
              opacity: 0.9,
              marginTop: "0.15rem",
              animation: "fade-slide-in 0.2s ease-out",
              whiteSpace: "nowrap",
            }}>
              {m.users.toLocaleString()} ticket{m.users !== 1 ? 's' : ''} activo{m.users !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
