"use client"

import { useEffect, useRef, useState } from "react"
import createGlobe from "cobe"

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

export function GlobeInteractive({
  markers = [],
  className = "",
  speed = 0.003,
  backgroundMode = false,
}: GlobeInteractiveProps) {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null)
  const phiRef = useRef(0)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

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
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          width,
          height: width,
          phi: 5.0, // Initial focus near Chile longitude (-70 deg -> ~5.0 rad)
          theta: -0.4, // Initial vertical tilt looking at South America (-0.4 rad)
          dark: 0,
          diffuse: 1.5,
          mapSamples: 16000,
          mapBrightness: 8,
          baseColor: [0.15, 0.3, 0.6], // Dark blue continents for contrast
          markerColor: [0.05, 0.19, 0.53], // Dark blue markers (#0e3187)
          glowColor: [0.3, 0.5, 0.8], // Blue glow
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
  }, [mounted, canvasElement, markers, speed, backgroundMode])

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
      <canvas
        ref={setCanvasElement}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: backgroundMode ? "default" : "grab",
          opacity: mounted ? (backgroundMode ? 0.85 : 1) : 0,
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
            background: backgroundMode ? (m.users > 0 ? "rgba(14, 49, 135, 0.95)" : "rgba(15, 23, 42, 0.85)") : "#0e3187", // High contrast dark slate for inactive ones
            color: "#fff",
            borderRadius: backgroundMode ? 5 : 6,
            cursor: backgroundMode ? "default" : "pointer",
            boxShadow: backgroundMode ? "0 2px 5px rgba(0,0,0,0.15)" : "0 4px 10px rgba(14,49,135,0.25)",
            border: backgroundMode ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.15)",
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
                color: "#0e3187",
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
