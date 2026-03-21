import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { cn } from '@/utils/helpers'
import { useAppDispatch } from '@/hooks'
import { setClassificationResult } from '@/store'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

type InputMode = 'upload' | 'webcam'

interface Detection {
  class:                 string
  category:              string
  raw_category:          string
  confidence:            number
  display_name:          string
  bin_color:             string
  bin_color_hex:         string
  bin_code:              string
  disposal_instructions: string
  fact:                  string
  mcd_rule:              string
  hazardous:             boolean
  recyclable:            boolean
  action:                string
  bbox:                  number[]
  source:                string
}

interface Recommendation {
  item_rank:     number
  class:         string
  display_name:  string
  category:      string
  confidence:    number
  priority:      string
  icon:          string
  color:         string
  title:         string
  bin_code:      string
  bin_color:     string
  bin_color_hex: string
  action:        string
  disposal:      string
  fact:          string
  mcd_rule:      string
  hazardous:     boolean
  recyclable:    boolean
  source:        string
}

interface Summary {
  total_items:      number
  hazardous_count:  number
  recyclable_count: number
  categories_found: string[]
  bins_needed:      string[]
  co2_impact:       string
  urgent_action:    string
  segregation_tip:  string
}

interface ClassifyResult {
  waste_type:            string
  confidence:            number
  recyclable:            boolean
  hazardous:             boolean
  disposal_instructions: string
  sub_category:          string
  detections:            Detection[]
  recommendations:       Recommendation[]
  summary:               Summary
  bin_color:             string
  bin_color_hex:         string
  bin_code:              string
  fact:                  string
  mcd_rule:              string
  action:                string
  object_count:          number
  model_type:            string
}

// ── Bounding Box Canvas — letterbox-aware ─────────────────────────────────────
function BoundingBoxCanvas({
  detections, naturalW, naturalH, hoveredIdx, onHover,
}: {
  detections: Detection[]
  naturalW: number
  naturalH: number
  hoveredIdx: number | null
  onHover: (i: number | null) => void
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getImageRect = useCallback(() => {
    const c = containerRef.current
    if (!c || naturalW === 0 || naturalH === 0) return { left: 0, top: 0, width: 0, height: 0 }
    const cw = c.clientWidth, ch = c.clientHeight
    const ir = naturalW / naturalH, br = cw / ch
    let rw: number, rh: number, ox: number, oy: number
    if (ir > br) { rw = cw; rh = cw / ir; ox = 0;          oy = (ch - rh) / 2 }
    else         { rh = ch; rw = ch * ir;  oy = 0;          ox = (cw - rw) / 2 }
    return { left: ox, top: oy, width: rw, height: rh }
  }, [naturalW, naturalH])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const cont   = containerRef.current
    if (!canvas || !cont || naturalW === 0) return
    canvas.width  = cont.clientWidth
    canvas.height = cont.clientHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const { left: ox, top: oy, width: rw, height: rh } = getImageRect()
    if (rw === 0) return

    const sx = rw / naturalW
    const sy = rh / naturalH

    detections.forEach((det, i) => {
      if (!det.bbox || det.bbox.length < 4) return
      const [x1, y1, x2, y2] = det.bbox
      const dx = ox + x1 * sx
      const dy = oy + y1 * sy
      const dw = (x2 - x1) * sx
      const dh = (y2 - y1) * sy
      if (dw <= 2 || dh <= 2) return

      const color = det.bin_color_hex || '#00d4d4'
      const isHov = hoveredIdx === i
      const lowConf = det.confidence < 50

      ctx.shadowBlur  = isHov ? 18 : 0
      ctx.shadowColor = color

      // Box — dashed for low confidence
      ctx.strokeStyle = color
      ctx.lineWidth   = isHov ? 3 : 2
      ctx.globalAlpha = isHov ? 1.0 : lowConf ? 0.5 : 0.8
      if (lowConf) ctx.setLineDash([6, 3])
      else ctx.setLineDash([])
      ctx.strokeRect(dx, dy, dw, dh)
      ctx.setLineDash([])

      // Fill
      ctx.fillStyle   = color + (lowConf ? '10' : '18')
      ctx.globalAlpha = isHov ? 0.2 : 0.08
      ctx.fillRect(dx, dy, dw, dh)
      ctx.globalAlpha = 1.0
      ctx.shadowBlur  = 0

      // Corner ticks
      const t = Math.min(14, dw * 0.18, dh * 0.18)
      ctx.strokeStyle = color
      ctx.lineWidth   = isHov ? 3 : 2.5
      ;[
        [[dx, dy + t],     [dx, dy],      [dx + t, dy]],
        [[dx+dw-t, dy],    [dx+dw, dy],   [dx+dw, dy+t]],
        [[dx, dy+dh-t],    [dx, dy+dh],   [dx+t, dy+dh]],
        [[dx+dw-t, dy+dh], [dx+dw, dy+dh],[dx+dw, dy+dh-t]],
      ].forEach(pts => {
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        ctx.lineTo(pts[1][0], pts[1][1])
        ctx.lineTo(pts[2][0], pts[2][1])
        ctx.stroke()
      })

      // Label pill
      const confStr  = det.confidence < 50 ? ` ${det.confidence.toFixed(0)}%?` : ` ${det.confidence.toFixed(0)}%`
      const label    = `${i + 1} ${det.display_name}${confStr}`
      const fs       = isHov ? 12 : 11
      ctx.font       = `bold ${fs}px 'IBM Plex Mono', monospace`
      const tw = ctx.measureText(label).width
      const ph = 18, pw = tw + 10
      const lx = Math.max(ox, Math.min(dx, ox + rw - pw))
      const ly = dy - ph - 3 < oy ? dy + 3 : dy - ph - 3
      ctx.fillStyle   = color
      ctx.globalAlpha = lowConf ? 0.7 : (isHov ? 0.95 : 0.88)
      ctx.beginPath()
      ctx.roundRect(lx, ly, pw, ph, 4)
      ctx.fill()
      ctx.globalAlpha = 1.0
      ctx.fillStyle = '#000'
      ctx.font      = `bold ${fs}px 'IBM Plex Mono', monospace`
      ctx.fillText(label, lx + 5, ly + ph - 5)
    })
  }, [detections, naturalW, naturalH, hoveredIdx, getImageRect])

  useEffect(() => { draw() }, [draw])
  useEffect(() => {
    const obs = new ResizeObserver(draw)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [draw])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cont = containerRef.current
    if (!cont || naturalW === 0) return
    const rect = cont.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const { left: ox, top: oy, width: rw, height: rh } = getImageRect()
    if (rw === 0) return
    const sx = rw / naturalW, sy = rh / naturalH
    let found: number | null = null
    detections.forEach((det, i) => {
      if (!det.bbox || det.bbox.length < 4) return
      const [x1, y1, x2, y2] = det.bbox
      const dx = ox + x1 * sx, dy = oy + y1 * sy
      const dw = (x2 - x1) * sx, dh = (y2 - y1) * sy
      if (mx >= dx && mx <= dx + dw && my >= dy && my <= dy + dh) found = i
    })
    onHover(found)
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHover(null)}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: hoveredIdx !== null ? 'pointer' : 'crosshair' }}
      />
    </div>
  )
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfBadge({ conf }: { conf: number }) {
  const color = conf >= 70 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : conf >= 45 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  const label = conf >= 70 ? 'High' : conf >= 45 ? 'Medium' : 'Low'
  return (
    <span className={cn('text-[9px] font-body font-bold px-1.5 py-0.5 rounded border', color)}>
      {label} Conf {conf.toFixed(0)}%
    </span>
  )
}

// ── Wrong judgement notice ────────────────────────────────────────────────────
function AccuracyNote({ rec, onFeedback }: {
  rec: Recommendation
  onFeedback: (rank: number, correct: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/6">
      <span className="text-cyber-muted text-[10px] font-body">Is this correct?</span>
      <button
        onClick={() => onFeedback(rec.item_rank, true)}
        className="text-[10px] font-body px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all"
      >
        ✓ Yes
      </button>
      <button
        onClick={() => onFeedback(rec.item_rank, false)}
        className="text-[10px] font-body px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 transition-all"
      >
        ✗ Wrong
      </button>
    </div>
  )
}

// ── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({
  rec, index, isHighlighted, onMouseEnter, onMouseLeave, onFeedback, feedback,
}: {
  rec: Recommendation
  index: number
  isHighlighted: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFeedback: (rank: number, correct: boolean) => void
  feedback: Record<number, boolean>
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const fb = feedback[rec.item_rank]
  useEffect(() => { if (isHighlighted) setExpanded(true) }, [isHighlighted])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="rounded-xl border overflow-hidden transition-all duration-200"
      style={{
        borderColor: isHighlighted ? rec.bin_color_hex : rec.bin_color_hex + '40',
        background:  isHighlighted ? rec.bin_color_hex + '14' : rec.bin_color_hex + '08',
        boxShadow:   isHighlighted ? `0 0 16px ${rec.bin_color_hex}30` : 'none',
      }}
    >
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 p-4 text-left">
        {/* Rank */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
          style={{ background: rec.bin_color_hex + '25', color: rec.bin_color_hex, border: `1.5px solid ${rec.bin_color_hex}60` }}>
          {rec.item_rank}
        </div>
        <span className="text-xl flex-shrink-0">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-white text-sm">{rec.display_name}</span>
            {rec.hazardous && <span className="text-[9px] font-body font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">HAZARDOUS</span>}
            {rec.recyclable && <span className="text-[9px] font-body font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">RECYCLABLE</span>}
            <ConfBadge conf={rec.confidence} />
            {rec.source === 'coco' && <span className="text-[9px] font-body px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">COCO</span>}
            {fb === true  && <span className="text-[9px] font-body px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">✓ Confirmed</span>}
            {fb === false && <span className="text-[9px] font-body px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">✗ Flagged</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-cyber-muted text-xs font-body">{rec.category}</span>
            <span className="text-cyber-muted text-[10px]">·</span>
            <span className="text-cyber-muted text-xs font-body">{rec.confidence.toFixed(1)}% confidence</span>
          </div>
        </div>
        <div className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-body font-bold uppercase tracking-wider hidden sm:block"
          style={{ background: rec.bin_color_hex + '20', color: rec.bin_color_hex, border: `1px solid ${rec.bin_color_hex}40` }}>
          {rec.bin_code}
        </div>
        <motion.svg animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-cyber-muted flex-shrink-0">
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-3 border-t border-white/6 space-y-3">

              {/* Low confidence warning */}
              {rec.confidence < 50 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/25">
                  <span className="flex-shrink-0 text-amber-400">⚠️</span>
                  <p className="text-amber-300 text-xs font-body">
                    Low confidence ({rec.confidence.toFixed(0)}%) — model is uncertain. Verify visually before disposing.
                    This may be misidentified.
                  </p>
                </div>
              )}

              {/* Action */}
              <div className="p-3 rounded-lg" style={{ background: rec.bin_color_hex + '12', border: `1px solid ${rec.bin_color_hex}30` }}>
                <p className="text-[10px] font-body uppercase tracking-wider mb-0.5" style={{ color: rec.bin_color_hex }}>🎯 Immediate Action</p>
                <p className="text-white text-sm font-body font-semibold">{rec.action}</p>
              </div>

              {/* Disposal */}
              <div className="p-3 rounded-lg bg-white/4 border border-white/8">
                <p className="text-cyber-teal text-[10px] font-body uppercase tracking-wider mb-1">📋 Disposal Instructions</p>
                <p className="text-cyber-text text-xs font-body leading-relaxed">{rec.disposal}</p>
              </div>

              {/* Fact + MCD */}
              <div className="grid grid-cols-2 gap-2">
                {rec.fact && (
                  <div className="p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                    <p className="text-emerald-400 text-[10px] font-body uppercase tracking-wider mb-1">💡 Did You Know</p>
                    <p className="text-cyber-text text-xs font-body leading-relaxed">{rec.fact}</p>
                  </div>
                )}
                {rec.mcd_rule && (
                  <div className="p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                    <p className="text-amber-400 text-[10px] font-body uppercase tracking-wider mb-1">⚖️ MCD Rule</p>
                    <p className="text-cyber-text text-xs font-body leading-relaxed">{rec.mcd_rule}</p>
                  </div>
                )}
              </div>

              {/* Feedback */}
              {fb === undefined && <AccuracyNote rec={rec} onFeedback={onFeedback} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────
function SummaryBanner({ summary, count }: { summary: Summary; count: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-cyber-teal/30 bg-cyber-teal/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-cyber-teal animate-pulse" />
        <p className="text-cyber-teal text-xs font-body uppercase tracking-widest font-semibold">
          {count} Item{count !== 1 ? 's' : ''} Detected
        </p>
      </div>
      {summary.urgent_action && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 mb-3">
          <span className="flex-shrink-0">⚠️</span>
          <p className="text-rose-300 text-xs font-body font-semibold">{summary.urgent_action}</p>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Total',     value: String(summary.total_items),       color: 'text-white'     },
          { label: 'Hazardous', value: String(summary.hazardous_count),   color: 'text-rose-400'  },
          { label: 'Recyclable',value: String(summary.recyclable_count),  color: 'text-blue-400'  },
          { label: 'Bins',      value: String(summary.bins_needed.length),color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/4 rounded-lg p-2 text-center">
            <p className={cn('font-display font-bold text-xl', s.color)}>{s.value}</p>
            <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
      {summary.segregation_tip && <p className="text-cyber-text text-xs font-body">🗂️ {summary.segregation_tip}</p>}
      {summary.co2_impact       && <p className="text-emerald-400 text-xs font-body mt-1">🌿 {summary.co2_impact}</p>}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Classifier() {
  const dispatch = useAppDispatch()
  const [mode, setMode]             = useState<InputMode>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<ClassifyResult | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [natW, setNatW]             = useState(0)
  const [natH, setNatH]             = useState(0)
  const [feedback, setFeedback]     = useState<Record<number, boolean>>({})
  const [confThreshold, setConfThreshold] = useState(0.15)

  const videoRef     = useRef<HTMLVideoElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const imgRef       = useRef<HTMLImageElement>(null)
  const [camActive, setCamActive] = useState(false)
  const [camError,  setCamError]  = useState('')
  const [scanning,  setScanning]  = useState(false)

  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }
  }, [])

  const onImageLoad = useCallback(() => {
    if (imgRef.current) { setNatW(imgRef.current.naturalWidth); setNatH(imgRef.current.naturalHeight) }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setCamActive(false); setScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setCamActive(true); setResult(null); setPreview(null); setNatW(0); setNatH(0)
    } catch { setCamError('Camera access denied.') }
  }, [])

  const doClassify = useCallback(async (formData: FormData, previewUrl?: string) => {
    setLoading(true); setResult(null); setHoveredIdx(null); setNatW(0); setNatH(0); setFeedback({})
    if (previewUrl) setPreview(previewUrl)
    try {
      const res = await fetch(`${API}/api/classify-waste`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('API error')
      const data: ClassifyResult = await res.json()
      if (data.confidence <= 1) data.confidence = data.confidence * 100
      setResult(data)
      dispatch(setClassificationResult(data as any))
      toast.success(`${data.object_count || 1} item(s) classified!`, { icon: '🔍' })
    } catch {
      toast.error('Classification failed — check API connection')
    } finally { setLoading(false) }
  }, [dispatch])

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    const fd = new FormData(); fd.append('file', file)
    await doClassify(fd)
  }, [doClassify])

  const captureAndClassify = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    setScanning(true)
    const v = videoRef.current; const c = canvasRef.current
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480
    c.getContext('2d')!.drawImage(v, 0, 0)
    const dataUrl = c.toDataURL('image/jpeg', 0.9)
    setPreview(dataUrl)
    c.toBlob(async (blob) => {
      if (!blob) { setScanning(false); return }
      const fd = new FormData(); fd.append('file', blob, 'capture.jpg')
      await doClassify(fd, dataUrl)
      setScanning(false)
    }, 'image/jpeg', 0.9)
  }, [doClassify])

  const handleFeedback = useCallback(async (rank: number, correct: boolean) => {
    setFeedback(prev => ({ ...prev, [rank]: correct }))
    if (!correct) {
      toast('Thanks for the feedback — helps improve accuracy!', { icon: '📝', duration: 3000 })
    } else {
      toast.success('Great! Classification confirmed.')
    }
  }, [])

  const handleConfChange = useCallback(async (val: number) => {
    setConfThreshold(val)
    try {
      await fetch(`${API}/api/classifier/confidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: val }),
      })
    } catch {}
  }, [])

  const switchMode = (m: InputMode) => {
    if (m !== mode) { if (mode === 'webcam') stopCamera(); setMode(m); setResult(null); setPreview(null); setNatW(0); setNatH(0) }
  }

  const hasDetections = result && result.detections && result.detections.length > 0

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Waste Classifier" subtitle="Multi-model ensemble — detects & boxes every waste item" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Mode toggle + confidence slider */}
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { id: 'upload' as InputMode, label: 'Upload Image', icon: '📁' },
              { id: 'webcam' as InputMode, label: 'Live Webcam',  icon: '📷' },
            ].map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl border font-display font-semibold text-sm tracking-wide transition-all',
                  mode === m.id
                    ? 'bg-cyber-teal/15 border-cyber-teal/50 text-cyber-teal'
                    : 'bg-white/3 border-white/10 text-cyber-muted hover:border-white/20 hover:text-white',
                )}>
                <span>{m.icon}</span>{m.label}
                {m.id === 'webcam' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyber-teal/20 text-cyber-teal font-body">LIVE</span>}
              </button>
            ))}
            <div className="flex-1" />
            {/* Confidence slider */}
            <div className="flex items-center gap-2">
              <span className="text-cyber-muted text-xs font-body">Sensitivity:</span>
              <input type="range" min={0.10} max={0.50} step={0.05} value={confThreshold}
                onChange={e => handleConfChange(parseFloat(e.target.value))}
                className="w-24 accent-cyber-teal" />
              <span className="text-cyber-teal text-xs font-body w-8">{(confThreshold * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* ── UPLOAD ──────────────────────────────────────────────────── */}
          {mode === 'upload' && (
            <div className="cyber-card p-6">
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                onClick={preview ? undefined : () => fileInputRef.current?.click()}
                className={cn(
                  'relative border-2 border-dashed rounded-xl overflow-hidden transition-all duration-300',
                  preview ? '' : 'cursor-pointer',
                  isDragging ? 'border-cyber-teal bg-cyber-teal/8' : 'border-[#0e2a4a] hover:border-cyber-teal/40',
                )}
                style={{ minHeight: 220 }}
              >
                {preview ? (
                  <div className="relative">
                    <img
                      ref={imgRef}
                      src={preview}
                      alt="Preview"
                      onLoad={onImageLoad}
                      className="w-full max-h-80 object-contain block"
                      style={{ background: '#000a1a' }}
                    />
                    {hasDetections && natW > 0 && (
                      <BoundingBoxCanvas
                        detections={result!.detections}
                        naturalW={natW}
                        naturalH={natH}
                        hoveredIdx={hoveredIdx}
                        onHover={setHoveredIdx}
                      />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 flex justify-between items-end">
                      <span className="text-white text-xs font-body">
                        {loading ? 'Analyzing...' : result ? `${result.object_count} item(s) detected — hover boxes to highlight` : 'Image loaded'}
                      </span>
                      <button onClick={e => { e.stopPropagation(); setPreview(null); setResult(null); setNatW(0); setNatH(0) }}
                        className="text-cyber-muted hover:text-rose-400 text-xs font-body transition-colors">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 px-6">
                    <div className="w-14 h-14 rounded-xl bg-cyber-teal/8 border border-cyber-teal/20 flex items-center justify-center mb-4 text-3xl">📸</div>
                    <p className="text-cyber-text text-sm font-ui font-medium mb-1">
                      {isDragging ? 'Drop image here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-cyber-muted text-xs font-body">3 AI models detect every waste item with bounding boxes</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* ── WEBCAM ──────────────────────────────────────────────────── */}
          {mode === 'webcam' && (
            <div className="cyber-card p-6">
              {camError && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs font-body">{camError}</div>}
              <div className="relative bg-black/40 rounded-xl overflow-hidden border border-white/8 mb-4" style={{ minHeight: 260 }}>
                <video ref={videoRef} autoPlay playsInline muted className={cn('w-full max-h-64 object-cover', !camActive && 'hidden')} />
                <canvas ref={canvasRef} className="hidden" />
                {!camActive && !preview && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="text-5xl opacity-30">📷</div>
                    <p className="text-cyber-muted text-sm font-body">Camera not started</p>
                  </div>
                )}
                {preview && !camActive && hasDetections && natW > 0 && (
                  <div className="relative">
                    <img ref={imgRef} src={preview} alt="Captured" onLoad={onImageLoad} className="w-full max-h-64 object-contain" style={{ background: '#000a1a' }} />
                    <BoundingBoxCanvas detections={result!.detections} naturalW={natW} naturalH={natH} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <div className="relative w-14 h-14">
                      <div className="absolute inset-0 border-2 border-cyber-teal/20 rounded-full" />
                      <div className="absolute inset-0 border-2 border-transparent border-t-cyber-teal rounded-full animate-spin" />
                    </div>
                    <p className="text-cyber-teal font-display font-semibold text-sm tracking-wider">ANALYZING...</p>
                  </div>
                )}
                {camActive && !scanning && (
                  <>
                    <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-cyber-teal/60" />
                    <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-cyber-teal/60" />
                    <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-cyber-teal/60" />
                    <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-cyber-teal/60" />
                  </>
                )}
              </div>
              <div className="flex gap-3">
                {!camActive ? (
                  <button onClick={startCamera} className="flex-1 py-3 rounded-xl bg-cyber-teal text-cyber-bg font-display font-bold text-sm tracking-widest uppercase hover:bg-cyan-300 transition-all">
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button onClick={captureAndClassify} disabled={scanning}
                      className={cn('flex-1 py-3 rounded-xl font-display font-bold text-sm tracking-widest uppercase transition-all',
                        scanning ? 'bg-white/10 text-cyber-muted cursor-not-allowed' : 'bg-cyber-teal text-cyber-bg hover:bg-cyan-300'
                      )}>
                      {scanning ? 'Classifying...' : '📸 Capture & Classify'}
                    </button>
                    <button onClick={stopCamera} className="px-5 py-3 rounded-xl border border-rose-500/30 text-rose-400 bg-rose-500/8 font-display font-bold text-sm uppercase transition-all">
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="cyber-card p-8 flex flex-col items-center gap-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 border-2 border-cyber-teal/20 rounded-full" />
                  <div className="absolute inset-0 border-2 border-transparent border-t-cyber-teal rounded-full animate-spin" />
                  <div className="absolute inset-3 border-2 border-transparent border-t-cyan-300/50 rounded-full animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
                </div>
                <div className="text-center">
                  <p className="text-cyber-teal font-display font-semibold tracking-wider">ANALYZING WITH 3 AI MODELS</p>
                  <p className="text-cyber-muted text-xs font-body mt-1">Running ensemble detection — boxing all waste items...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {result && !loading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

                {result.summary && <SummaryBanner summary={result.summary} count={result.object_count || 1} />}

                {/* Model info */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-cyber-muted text-[10px] font-body uppercase tracking-widest">Models used:</span>
                  {[
                    { label: 'Model 1 — 4 classes',  color: '#00d4d4' },
                    { label: 'Model 2 — 42 classes',  color: '#10b981' },
                    { label: 'COCO — 80 classes',     color: '#8b5cf6' },
                  ].map(m => (
                    <span key={m.label} className="text-[10px] font-body px-2 py-0.5 rounded border"
                      style={{ color: m.color, borderColor: m.color + '40', background: m.color + '12' }}>
                      {m.label}
                    </span>
                  ))}
                  <span className="text-cyber-muted text-[10px] font-body ml-auto">
                    Dashed box = low confidence
                  </span>
                </div>

                {/* Per-item cards */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyber-teal inline-block" />
                      Per-item classification — hover card or image box to highlight
                    </p>
                    {result.recommendations.map((rec, i) => (
                      <ItemCard
                        key={`${rec.class}-${i}`}
                        rec={rec}
                        index={i}
                        isHighlighted={hoveredIdx === i}
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        onFeedback={handleFeedback}
                        feedback={feedback}
                      />
                    ))}
                  </div>
                )}

                {/* Classify another */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setResult(null); setPreview(null); setNatW(0); setNatH(0); setFeedback({}) }}
                    className="px-4 py-2 rounded-lg border border-white/15 text-cyber-muted hover:text-white hover:border-white/30 text-xs font-body transition-all">
                    Classify Another Image
                  </button>
                  {mode === 'webcam' && camActive && (
                    <button onClick={captureAndClassify}
                      className="px-4 py-2 rounded-lg bg-cyber-teal/15 border border-cyber-teal/30 text-cyber-teal text-xs font-body hover:bg-cyber-teal/25 transition-all">
                      📸 Capture Again
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle stats */}
          {!result && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="grid grid-cols-3 gap-4">
              {[
                { label: '3 AI Models',     value: 'Ensemble', desc: '4 + 42 + 80 classes'     },
                { label: 'Bounding Boxes',  value: 'Live',     desc: 'Every item highlighted'   },
                { label: 'MCD Rules',       value: '12+',      desc: 'Disposal categories'      },
              ].map(item => (
                <div key={item.label} className="cyber-card p-4 text-center">
                  <p className="text-cyber-teal font-display font-bold text-2xl">{item.value}</p>
                  <p className="text-white text-xs font-ui font-medium mt-0.5">{item.label}</p>
                  <p className="text-cyber-muted text-[10px] font-body mt-0.5">{item.desc}</p>
                </div>
              ))}
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}