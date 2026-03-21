import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { cn } from '@/utils/helpers'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const MEDALS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-cyber-muted text-[10px] font-body uppercase tracking-wider">{label}</span>
        <span className="text-white text-xs font-body font-semibold">{(value || 0).toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value || 0, 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

function WardCard({ entry, expanded, onClick }: { entry: any; expanded: boolean; onClick: () => void }) {
  const rank       = entry.rank || 1
  const isTop3     = rank <= 3
  const medal      = MEDALS[rank] || '#4a6080'
  const wardName   = entry.ward_name || entry.name || entry.ward_id || 'Unknown'
  const score      = parseFloat(entry.score || entry.total_score || 0)
  const seg        = parseFloat(entry.segregation_score   || entry.segregation_rate         || 0)
  const eff        = parseFloat(entry.efficiency_score    || entry.collection_efficiency    || 0)
  const par        = parseFloat(entry.participation_score || entry.participation_rate       || 0)
  const wasteKg    = parseFloat(entry.total_waste_kg      || entry.total_waste              || 0)
  const avgFill    = parseFloat(entry.avg_fill            || 0)

  const radarData = [
    { subject: 'Segregation',   value: seg },
    { subject: 'Efficiency',    value: eff },
    { subject: 'Participation', value: par },
  ]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      className={cn('relative cyber-card cursor-pointer overflow-hidden', expanded ? 'ring-1 ring-cyber-teal/40' : '')}
      style={isTop3 ? { borderColor: medal + '40' } : {}}
      whileHover={{ y: -2 }}
    >
      {isTop3 && (
        <div className="absolute inset-x-0 top-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${medal}, transparent)` }}
        />
      )}

      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 text-center">
            <span
              className="font-display font-black text-3xl leading-none block"
              style={{ color: medal, textShadow: isTop3 ? `0 0 16px ${medal}60` : 'none' }}
            >#{rank}</span>
            <span className="text-[9px] font-body tracking-widest" style={{ color: medal }}>
              {rank === 1 ? 'GOLD' : rank === 2 ? 'SILVER' : rank === 3 ? 'BRONZE' : 'RANKED'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-bold text-white text-lg tracking-wide truncate">
                {wardName.toUpperCase()}
              </h3>
              {rank === 1 && <span className="text-amber-400 text-sm flex-shrink-0">★</span>}
            </div>
            <p className="text-cyber-muted text-xs font-body">
              {wasteKg > 0
                ? `${wasteKg.toLocaleString()} kg processed`
                : `avg fill ${avgFill.toFixed(1)}%`}
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <motion.div
              key={score}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-display font-black text-4xl leading-none"
              style={{ color: isTop3 ? medal : '#00d4d4' }}
            >
              {score.toFixed(1)}
            </motion.div>
            <div className="text-cyber-muted text-[10px] font-body tracking-wider">/ 100</div>
          </div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 text-cyber-muted"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </motion.div>
        </div>

        {/* Mini score bars */}
        {(seg > 0 || eff > 0 || par > 0) && (
          <div className="mt-4 flex gap-3">
            {[
              { label: 'Seg', value: seg, color: '#00d4d4' },
              { label: 'Eff', value: eff, color: '#8b5cf6' },
              { label: 'Par', value: par, color: '#10b981' },
            ].map((bar) => (
              <div key={bar.label} className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-cyber-muted text-[9px] font-body uppercase">{bar.label}</span>
                  <span className="text-white text-[9px] font-body">{(bar.value || 0).toFixed(1)}</span>
                </div>
                <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${Math.min(bar.value || 0, 100)}%` }}
                    transition={{ duration: 0.7 }}
                    className="h-full rounded-full"
                    style={{ background: bar.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-5 pt-5 border-t border-white/6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {(seg > 0 || eff > 0) && (
                  <div>
                    <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Performance Radar</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.08)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#4a6080', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
                        <Radar name="Score" dataKey="value" stroke={isTop3 ? medal : '#00d4d4'} fill={isTop3 ? medal : '#00d4d4'} fillOpacity={0.15} strokeWidth={2} />
                        <Tooltip contentStyle={{ background: '#0a1628', border: '1px solid rgba(0,212,212,0.2)', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="space-y-3">
                  <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest">Score Breakdown</p>
                  {seg > 0 && <ScoreBar label="Segregation Rate"      value={seg} color="#00d4d4" />}
                  {eff > 0 && <ScoreBar label="Collection Efficiency" value={eff} color="#8b5cf6" />}
                  {par > 0 && <ScoreBar label="Public Participation"  value={par} color="#10b981" />}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-white/4 rounded-lg p-3 text-center">
                      <p className="text-cyber-teal font-display font-bold text-xl">
                        {wasteKg > 0 ? `${(wasteKg / 1000).toFixed(1)}T` : `${avgFill.toFixed(0)}%`}
                      </p>
                      <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">
                        {wasteKg > 0 ? 'Waste Handled' : 'Avg Fill'}
                      </p>
                    </div>
                    <div className="bg-white/4 rounded-lg p-3 text-center">
                      <p className="text-emerald-400 font-display font-bold text-xl">{score.toFixed(1)}</p>
                      <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">Total Score</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function Leaderboard() {
  const [wards, setWards]           = useState<any[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState('')
  const [loading, setLoading]       = useState(true)
  const prevScores                  = useRef<Record<string, number>>({})

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/leaderboard`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()

      let list: any[] = []

      if (Array.isArray(data.wards) && data.wards.length > 0) {
        list = data.wards
      } else if (Array.isArray(data.top_wards) && data.top_wards.length > 0) {
        const combined = [...(data.top_wards || []), ...(data.bottom_wards || [])]
        const seen = new Set<string>()
        list = combined
          .filter((w) => { const id = w.ward_id || w.id; if (seen.has(id)) return false; seen.add(id); return true })
          .sort((a, b) => parseFloat(b.score || b.total_score || 0) - parseFloat(a.score || a.total_score || 0))
          .map((w, i) => ({ ...w, rank: i + 1, score: parseFloat(w.score || w.total_score || 0) }))
      } else if (Array.isArray(data) && data.length > 0) {
        list = data.map((w, i) => ({ ...w, rank: w.rank || i + 1 }))
      }

      if (list.length > 0) {
        setWards(list)
        setLoading(false)
        // Track score changes
        list.forEach(w => {
          const id = w.ward_id || w.id
          prevScores.current[id] = parseFloat(w.score || 0)
        })
      }

      setLastUpdate(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {}
  }, [])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 3000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  const top3   = wards.slice(0, 3)
  const second = top3[1]
  const first  = top3[0]
  const third  = top3[2]
  const podium = [second, first, third].filter(Boolean)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ward Leaderboard"
        subtitle="Delhi NCT — Segregation & Efficiency Rankings"
        actions={
          lastUpdate ? (
            <div className="flex items-center gap-1.5 text-[10px] font-body text-cyber-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live · {lastUpdate} · 3s
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {loading ? (
            <div className="cyber-card p-10 text-center">
              <div className="w-8 h-8 border-2 border-transparent border-t-cyber-teal rounded-full animate-spin mx-auto mb-3" />
              <p className="text-cyber-muted text-xs font-body">Connecting to live leaderboard...</p>
            </div>
          ) : (
            <>
              {/* Podium */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="cyber-card p-5">
                <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest text-center mb-6">
                  Top Performers — Live Rankings
                </p>
                <div className="flex items-end justify-center gap-4 h-36">
                  {podium.map((w, i) => {
                    if (!w) return null
                    const isFirst = w.rank === 1
                    const color   = MEDALS[w.rank] || '#4a6080'
                    const heights = [64, 96, 48]
                    const score   = parseFloat(w.score || w.total_score || 0)
                    const name    = (w.ward_name || w.name || w.ward_id || '').split(' ')[0]

                    return (
                      <motion.div
                        key={w.ward_id || i}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex flex-col items-center gap-2"
                      >
                        {isFirst && (
                          <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5 }} className="text-amber-400 text-lg">★</motion.div>
                        )}
                        <div
                          className="rounded-full border-2 flex items-center justify-center"
                          style={{ width: isFirst ? 48 : 40, height: isFirst ? 48 : 40, borderColor: color, background: color + '20', boxShadow: isFirst ? `0 0 16px ${color}40` : 'none' }}
                        >
                          <span className="font-display font-bold text-sm" style={{ color }}>{w.rank}</span>
                        </div>
                        <div className="text-center" style={{ width: isFirst ? 96 : 80 }}>
                          <p className="text-white text-xs font-display font-semibold truncate">{name}</p>
                          <motion.p key={score} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display font-bold text-sm" style={{ color }}>
                            {score.toFixed(1)}
                          </motion.p>
                        </div>
                        <div className="rounded-t-lg border" style={{ width: isFirst ? 96 : 80, height: heights[i], background: color + '15', borderColor: color + '30' }} />
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Full rankings */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-white text-lg tracking-wider">Full Rankings</h2>
                  <span className="text-cyber-muted text-xs font-body">Updates every 3s</span>
                </div>
                <div className="space-y-3">
                  <AnimatePresence>
                    {wards.map((entry) => {
                      const id = entry.ward_id || entry.id || String(entry.rank)
                      return (
                        <WardCard
                          key={id}
                          entry={entry}
                          expanded={expandedId === id}
                          onClick={() => setExpandedId(expandedId === id ? null : id)}
                        />
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}