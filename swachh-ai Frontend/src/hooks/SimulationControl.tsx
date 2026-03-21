/**
 * src/components/SimulationControl.tsx
 * Digital twin simulation mode selector.
 * Add to Dashboard or MapView page for judge demo.
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const MODES = [
  { mode: 'normal',   label: 'Normal',   icon: '✅', color: '#10b981', desc: 'Standard operations'        },
  { mode: 'festival', label: 'Festival', icon: '🎉', color: '#f59e0b', desc: '+80% waste (Diwali/Holi)'   },
  { mode: 'rain',     label: 'Monsoon',  icon: '🌧️', color: '#3b82f6', desc: '+30% fill, 30% delay'       },
  { mode: 'strike',   label: 'Strike',   icon: '🚧', color: '#f43f5e', desc: '70% fleet grounded'         },
  { mode: 'crisis',   label: 'Crisis',   icon: '🔴', color: '#f43f5e', desc: '+150% fill, emergency mode' },
  { mode: 'weekend',  label: 'Weekend',  icon: '📅', color: '#8b5cf6', desc: '+40% residential surge'     },
]

export function SimulationControl() {
  const [currentMode, setCurrentMode] = useState('normal')
  const [loading, setLoading]         = useState(false)
  const [open, setOpen]               = useState(false)

  const switchMode = useCallback(async (mode: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/simulation/mode`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (data.success || data.mode) {
        setCurrentMode(mode)
        const m = MODES.find(x => x.mode === mode)!
        toast.success(`${m.icon} ${m.label} mode active — ${m.desc}`, {
          style: { background: '#0a1628', color: '#c8d6e5', border: `1px solid ${m.color}40` },
        })
      }
    } catch {
      toast.error('Failed to switch simulation mode')
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }, [])

  const active = MODES.find(m => m.mode === currentMode) || MODES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-body font-semibold transition-all',
          currentMode !== 'normal'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-white/15 bg-white/5 text-cyber-muted hover:border-cyber-teal/30 hover:text-cyber-teal',
        )}
      >
        <span>{active.icon}</span>
        <span>Twin: {active.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cn('w-3 h-3 transition-transform', open && 'rotate-180')}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 cyber-card p-2 z-50 border border-[#0e2a4a]"
          >
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest px-2 py-1.5">
              Digital Twin Simulation
            </p>
            <div className="space-y-1">
              {MODES.map(m => (
                <button
                  key={m.mode}
                  onClick={() => switchMode(m.mode)}
                  disabled={loading}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all',
                    currentMode === m.mode
                      ? 'bg-white/8 border border-white/15'
                      : 'hover:bg-white/5 border border-transparent',
                  )}
                >
                  <span className="text-lg flex-shrink-0">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-body font-semibold" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-cyber-muted text-[10px] font-body truncate">{m.desc}</p>
                  </div>
                  {currentMode === m.mode && (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
