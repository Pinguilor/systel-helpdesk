'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LoopLoaderProps {
  fullScreen?: boolean;
  text?: string;
}

export const LoopLoader: React.FC<LoopLoaderProps> = ({ fullScreen = false, text = 'Cargando...' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in duration-500">
      <div className="relative w-32 h-16 flex items-center justify-center">
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
          <defs>
            <linearGradient id="glow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e3a8a">
                  <animate attributeName="stopColor" values="#1e3a8a;#06b6d4;#1e3a8a" dur="3s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" stopColor="#06b6d4">
                  <animate attributeName="stopColor" values="#06b6d4;#1e3a8a;#06b6d4" dur="3s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#1e3a8a">
                  <animate attributeName="stopColor" values="#1e3a8a;#06b6d4;#1e3a8a" dur="3s" repeatCount="indefinite" />
              </stop>
            </linearGradient>

            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <style>
            {`
              .loop-base {
                stroke: rgba(226, 232, 240, 0.4); /* slate-200 */
              }
              .loop-flow-primary {
                stroke: url(#glow-gradient);
                stroke-dasharray: 60 40;
                animation: loop-flow 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                filter: url(#neon-glow);
              }
              .loop-flow-secondary {
                stroke: #06b6d4;
                stroke-dasharray: 20 80;
                opacity: 0.8;
                animation: loop-flow 1.5s linear infinite;
                filter: url(#neon-glow);
              }
              @keyframes loop-flow {
                0% {
                  stroke-dashoffset: 100;
                }
                100% {
                  stroke-dashoffset: 0;
                }
              }
            `}
          </style>

          {/* Base Track */}
          <path
            className="loop-base"
            d="M 25 45 C 13.954 45 5 36.046 5 25 C 5 13.954 13.954 5 25 5 C 34.2 5 42 11 46 19 L 54 31 C 58 39 65.8 45 75 45 C 86.046 45 95 36.046 95 25 C 95 13.954 86.046 5 75 5 C 65.8 5 58 11 54 19 L 46 31 C 42 39 34.2 45 25 45 Z"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
          />

          {/* Flowing Layer 1 */}
          <path
            className="loop-flow-primary"
            d="M 25 45 C 13.954 45 5 36.046 5 25 C 5 13.954 13.954 5 25 5 C 34.2 5 42 11 46 19 L 54 31 C 58 39 65.8 45 75 45 C 86.046 45 95 36.046 95 25 C 95 13.954 86.046 5 75 5 C 65.8 5 58 11 54 19 L 46 31 C 42 39 34.2 45 25 45 Z"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
          />

          {/* Flowing Layer 2 (Faster Accent Accent) */}
          <path
            className="loop-flow-secondary"
            d="M 25 45 C 13.954 45 5 36.046 5 25 C 5 13.954 13.954 5 25 5 C 34.2 5 42 11 46 19 L 54 31 C 58 39 65.8 45 75 45 C 86.046 45 95 36.046 95 25 C 95 13.954 86.046 5 75 5 C 65.8 5 58 11 54 19 L 46 31 C 42 39 34.2 45 25 45 Z"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            opacity="0.8"
          />
        </svg>
      </div>
      
      {text && (
        <span className={`text-xs font-semibold animate-pulse tracking-[0.3em] uppercase mt-4 ${fullScreen ? 'text-zinc-300 drop-shadow-md' : 'bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500'}`}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    const loader = (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-zinc-950 border-transparent transition-all">
        {content}
      </div>
    );
    
    // To prevent hydration mismatch, only portal after mounting
    // If not mounted yet (SSR/Initial load), render it in standard DOM flow
    if (mounted && typeof document !== 'undefined') {
      return createPortal(loader, document.body);
    }
    
    return loader;
  }

  return (
    <div className="flex items-center justify-center w-full min-h-[300px] h-full p-8 bg-transparent">
      {content}
    </div>
  );
};

export default LoopLoader;
