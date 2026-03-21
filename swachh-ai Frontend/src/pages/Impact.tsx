import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Header } from '@/components/layout/Header'
import { useAppDispatch } from '@/hooks'
import { setSelectedWard } from '@/store'
import { DELHI_WARDS, cn } from '@/utils/helpers'
import { WardReportButton } from '@/components/WardReport'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel border border-[#0e2a4a] rounded-lg px-3 py-2 text-xs font-body">
      <p className="text-cyber-muted mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedValue({ value, unit, className }: { value: number; unit: string; className: string }) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (Math.abs(value - prev.current) < 0.01) return
    const start = prev.current, end = value, dur = 900, t0 = Date.now()
    const frame = () => {
      const p     = Math.min((Date.now() - t0) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(start + (end - start) * eased)
      if (p < 1) requestAnimationFrame(frame)
      else { setDisplay(end); prev.current = end }
    }
    requestAnimationFrame(frame)
  }, [value])

  const formatted = display >= 1000 ? `${(display / 1000).toFixed(1)}K` : display.toFixed(display < 10 ? 1 : 0)

  return (
    <div className="flex items-end gap-1.5 mb-1">
      <span className={cn('font-display font-black text-4xl leading-none', className)}>{formatted}</span>
      <span className="text-cyber-muted text-sm font-body mb-1">{unit}</span>
    </div>
  )
}

// ── Impact metric card ────────────────────────────────────────────────────────
function ImpactCard({
  value, unit, label, description,
  textColor, borderColor, bgColor, glow, icon, delay = 0,
}: {
  value: number; unit: string; label: string; description: string
  textColor: string; borderColor: string; bgColor: string; glow: string
  icon: React.ReactNode; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -3 }}
      className="cyber-card p-5 relative overflow-hidden"
      style={{ boxShadow: `0 0 0 1px rgba(255,255,255,0.05), ${glow}` }}
    >
      <div className={cn('absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center border', bgColor, borderColor)}>
        <span className={textColor}>{icon}</span>
      </div>
      <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-2">{label}</p>
      <AnimatedValue value={value} unit={unit} className={textColor} />
      <p className="text-cyber-muted/70 text-xs font-body leading-relaxed">{description}</p>
    </motion.div>
  )
}

// ── Monthly trend data ────────────────────────────────────────────────────────
const MONTHLY_SCAFFOLD = [
  { month: 'Jan', co2_kg: 3200,  landfill_kg: 12800 },
  { month: 'Feb', co2_kg: 3800,  landfill_kg: 15200 },
  { month: 'Mar', co2_kg: 4200,  landfill_kg: 16800 },
  { month: 'Apr', co2_kg: 3900,  landfill_kg: 15600 },
  { month: 'May', co2_kg: 4600,  landfill_kg: 18400 },
  { month: 'Jun', co2_kg: 4100,  landfill_kg: 16400 },
  { month: 'Jul', co2_kg: 5200,  landfill_kg: 20800 },
  { month: 'Aug', co2_kg: 4800,  landfill_kg: 19200 },
  { month: 'Sep', co2_kg: 5600,  landfill_kg: 22400 },
  { month: 'Oct', co2_kg: 4400,  landfill_kg: 17600 },
  { month: 'Nov', co2_kg: 3820,  landfill_kg: 15280 },
  { month: 'Dec', co2_kg: 4850,  landfill_kg: 19400 },
]

// ── Score ring — SVG fix: initial value in style, not initial prop ────────────
function ScoreRing({ score }: { score: number }) {
  const R    = 34
  const circ = 2 * Math.PI * R
  const safe = Math.min(Math.max(score, 0), 100)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
      className="cyber-card p-5 flex flex-col items-center justify-center text-center"
    >
      <div className="relative mb-3">
        <svg viewBox="0 0 80 80" className="w-20 h-20">
          {/* Background track */}
          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(0,212,212,0.1)" strokeWidth="8" />
          {/* Animated fill — style sets initial, animate changes it */}
          <motion.circle
            cx="40" cy="40" r={R}
            fill="none"
            stroke="#00d4d4"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            style={{
              transformOrigin: 'center',
              transform:       'rotate(-90deg)',
              strokeDashoffset: circ,   // ← initial value here, NOT in initial={}
            }}
            animate={{
              strokeDashoffset: circ * (1 - safe / 100),
            }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            key={score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-cyber-teal font-display font-black text-xl"
          >
            {safe.toFixed(0)}
          </motion.span>
        </div>
      </div>
      <p className="text-white text-sm font-display font-semibold tracking-wide">Impact Score</p>
      <p className="text-cyber-muted text-[10px] font-body mt-0.5">vs. city average 68.4</p>
      <div className="mt-3">
        <WardReportButton />
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Impact() {
  const dispatch = useAppDispatch()
  const [selectedWardId, setSelectedWardId] = useState('ward-001')
  const [lastUpdate, setLastUpdate]         = useState('')
  const [leaderboardData, setLeaderboardData] = useState<any[]>([])
  const [impact, setImpact] = useState({
    co2_saved_kg: 0, landfill_reduced_kg: 0, trees_equivalent: 0,
    water_saved_liters: 0, energy_saved_kwh: 0,
    recycling_rate_pct: 0, biodeg_rate_pct: 0,
  })

  const fetchData = useCallback(async () => {
    try {
      const [impRes, lbRes] = await Promise.all([
        fetch(`${API}/api/impact/${selectedWardId}`, { cache: 'no-store' }),
        fetch(`${API}/api/leaderboard`,              { cache: 'no-store' }),
      ])

      if (impRes.ok) {
        const d = await impRes.json()
        if (d) {
          setImpact({
            co2_saved_kg:        parseFloat(d.co2_saved_kg        || 0),
            landfill_reduced_kg: parseFloat(d.landfill_reduced_kg || 0),
            trees_equivalent:    parseFloat(d.trees_equivalent    || 0),
            water_saved_liters:  parseFloat(d.water_saved_liters  || 0),
            energy_saved_kwh:    parseFloat(d.energy_saved_kwh    || 0),
            recycling_rate_pct:  parseFloat(d.recycling_rate_pct  || 0),
            biodeg_rate_pct:     parseFloat(d.biodeg_rate_pct     || 0),
          })
        }
      }

      if (lbRes.ok) {
        const d = await lbRes.json()
        const list = d.wards || d.top_wards || d
        if (Array.isArray(list)) setLeaderboardData(list)
      }

      setLastUpdate(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }))
    } catch {}
  }, [selectedWardId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const ward      = leaderboardData.find(w => w.ward_id === selectedWardId)
  const wardScore = parseFloat(ward?.score || ward?.total_score || 0) || 0
  const landfillMax = Math.max(...MONTHLY_SCAFFOLD.map(d => d.landfill_kg))

  const metrics = [
    {
      value: impact.co2_saved_kg, unit: 'kg', label: 'CO₂ Prevented',
      description: 'Greenhouse gas emissions avoided through waste diversion',
      textColor: 'text-cyber-teal', borderColor: 'border-cyber-teal/20',
      bgColor: 'bg-cyber-teal/8', glow: '0 0 24px rgba(0,212,212,0.12)', delay: 0,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    },
    {
      value: impact.landfill_reduced_kg, unit: 'kg', label: 'Landfill Diverted',
      description: 'Waste redirected away from Bhalswa, Ghazipur, Okhla landfill sites',
      textColor: 'text-emerald-400', borderColor: 'border-emerald-500/20',
      bgColor: 'bg-emerald-500/8', glow: '0 0 24px rgba(16,185,129,0.12)', delay: 0.08,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    },
    {
      value: impact.trees_equivalent, unit: 'trees', label: 'Tree Equivalent',
      description: 'CO₂ absorption equivalent to planting this many trees',
      textColor: 'text-amber-400', borderColor: 'border-amber-500/20',
      bgColor: 'bg-amber-500/8', glow: '0 0 24px rgba(245,158,11,0.12)', delay: 0.16,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M17 8C8 10 5.9 16.17 3.82 19H5c.5-.5 1.63-1.63 3-2 1.5 2 4.5 3 7 3 5 0 10-2.5 10-7.5 0-2.5-2.5-4.5-5-5.5" /><path d="M12 22v-3" /></svg>,
    },
    {
      value: impact.water_saved_liters, unit: 'L', label: 'Water Conserved',
      description: 'Water saved through recycling industrial processes',
      textColor: 'text-violet-400', borderColor: 'border-violet-500/20',
      bgColor: 'bg-violet-500/8', glow: '0 0 24px rgba(139,92,246,0.12)', delay: 0.24,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></svg>,
    },
    {
      value: impact.energy_saved_kwh, unit: 'kWh', label: 'Energy Recovered',
      description: 'Equivalent energy from waste-to-resource programs',
      textColor: 'text-rose-400', borderColor: 'border-rose-500/20',
      bgColor: 'bg-rose-500/8', glow: '0 0 24px rgba(244,63,94,0.12)', delay: 0.32,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Environmental Impact"
        subtitle="Live Eco Metrics — Pathway Real-Time Data"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-[10px] font-body text-cyber-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live · {lastUpdate} · 5s
              </div>
            )}
            <select
              value={selectedWardId}
              onChange={e => { setSelectedWardId(e.target.value); dispatch(setSelectedWard(e.target.value)) }}
              className="bg-[#0a1628] border border-[#0e2a4a] text-cyber-text text-xs font-body rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyber-teal/40"
            >
              {DELHI_WARDS.map(w => <option key={w.ward_id} value={w.ward_id}>{w.ward_name}</option>)}
            </select>
            <WardReportButton />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* 5 metric cards + score ring */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(m => <ImpactCard key={m.label} {...m} />)}
          <ScoreRing score={wardScore} />
        </div>

        {/* Recycling + Biodeg rate bars */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Recycling Rate', value: impact.recycling_rate_pct, color: '#00d4d4' },
            { label: 'Biodeg Rate',    value: impact.biodeg_rate_pct,    color: '#10b981' },
          ].map(r => (
            <div key={r.label} className="cyber-card p-4 flex items-center justify-between">
              <span className="text-cyber-muted text-xs font-body uppercase tracking-wider">{r.label}</span>
              <div className="flex items-center gap-3">
                <div className="w-28 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${Math.min(r.value || 0, 100)}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full"
                    style={{ background: r.color }}
                  />
                </div>
                <motion.span
                  key={r.value}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="font-display font-bold text-lg"
                  style={{ color: r.color }}
                >
                  {(r.value || 0).toFixed(1)}%
                </motion.span>
              </div>
            </div>
          ))}
        </div>

        {/* Ward performance breakdown */}
        {ward && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="cyber-card p-5"
          >
            <h2 className="font-display font-semibold text-white text-lg tracking-wider mb-4">
              {ward.ward_name} — Score Breakdown
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Segregation',   value: ward.segregation_score   || 0, color: '#00d4d4' },
                { label: 'Efficiency',    value: ward.efficiency_score    || 0, color: '#8b5cf6' },
                { label: 'Participation', value: ward.participation_score || 0, color: '#10b981' },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-2">
                    <span className="text-cyber-muted text-xs font-body uppercase tracking-wider">{s.label}</span>
                    <span className="font-display font-bold text-sm" style={{ color: s.color }}>
                      {(s.value || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${Math.min(s.value, 100)}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/3 rounded-lg p-3 text-center">
                <p className="text-cyber-teal font-display font-bold text-xl">
                  {((ward.total_waste_kg || 0) / 1000).toFixed(1)}T
                </p>
                <p className="text-cyber-muted text-[10px] font-body">Waste Handled</p>
              </div>
              <div className="bg-white/3 rounded-lg p-3 text-center">
                <p className="text-amber-400 font-display font-bold text-xl">
                  {(ward.avg_fill || 0).toFixed(1)}%
                </p>
                <p className="text-cyber-muted text-[10px] font-body">Avg Bin Fill</p>
              </div>
              <div className="bg-white/3 rounded-lg p-3 text-center">
                <p className="text-emerald-400 font-display font-bold text-xl">
                  #{ward.rank || '-'}
                </p>
                <p className="text-cyber-muted text-[10px] font-body">City Rank</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
            className="cyber-card p-5"
          >
            <h2 className="font-display font-semibold text-white text-lg tracking-wider mb-1">CO₂ Reduction Trend</h2>
            <p className="text-cyber-muted text-xs font-body mb-4">Monthly CO₂ prevented (kg)</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={MONTHLY_SCAFFOLD} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCO2i" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00d4d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#4a6080', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6080', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="co2_kg" name="CO₂ (kg)"
                  stroke="#00d4d4" strokeWidth={2.5} fill="url(#gCO2i)"
                  dot={{ fill: '#00d4d4', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#00ffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="cyber-card p-5"
          >
            <h2 className="font-display font-semibold text-white text-lg tracking-wider mb-1">Landfill Diversion</h2>
            <p className="text-cyber-muted text-xs font-body mb-4">Monthly waste diverted from Delhi landfills (kg)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_SCAFFOLD} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#4a6080', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4a6080', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="landfill_kg" name="Landfill (kg)" radius={[4, 4, 0, 0]}>
                  {MONTHLY_SCAFFOLD.map((entry, i) => (
                    <Cell key={i} fill={entry.landfill_kg >= landfillMax * 0.8 ? '#10b981' : '#4a6080'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

      </div>
    </div>
  )
}