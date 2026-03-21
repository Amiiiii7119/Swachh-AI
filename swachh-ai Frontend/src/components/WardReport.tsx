import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const WARDS = [
  { id: 'ward-001', name: 'Karol Bagh'      },
  { id: 'ward-002', name: 'Dwarka'          },
  { id: 'ward-003', name: 'Saket'           },
  { id: 'ward-004', name: 'Rohini'          },
  { id: 'ward-005', name: 'Connaught Place' },
]

interface ReportData {
  ward_name:           string
  total_waste_kg:      number
  co2_saved_kg:        number
  landfill_reduced_kg: number
  recycling_rate_pct:  number
  biodeg_rate_pct:     number
  energy_saved_kwh:    number
  water_saved_liters:  number
  trees_equivalent:    number
  segregation_score:   number
  efficiency_score:    number
  participation_score: number
  score:               number
  bin_count:           number
  avg_fill:            number
  updated_at:          string
}

async function generatePDF(data: ReportData, wardId: string) {
  const jsPDF = (await import('jspdf')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 18, CW = W - M * 2
  const now = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Helper: safe text — avoids character spacing issues ─────
  const safeText = (text: string, x: number, y: number, options?: any) => {
    // Use courier which renders evenly, or helvetica with explicit charSpace=0
    doc.text(text, x, y, { charSpace: 0, ...options })
  }

  // ── Header bar ───────────────────────────────────────────────
  doc.setFillColor(10, 22, 40)
  doc.rect(0, 0, W, 48, 'F')

  doc.setTextColor(0, 212, 212)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  safeText('SWACHH AI', M, 18)

  doc.setTextColor(180, 200, 220)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  safeText('Municipal Corporation of Delhi  |  Waste Intelligence System', M, 26)

  doc.setTextColor(0, 212, 212)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  safeText(`${data.ward_name.toUpperCase()} WARD  —  PERFORMANCE REPORT`, M, 36)

  doc.setTextColor(120, 150, 180)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  safeText(`Generated: ${now}   |   Ward ID: ${wardId}   |   India Innovates 2026`, M, 43)

  // ── Grade badge ──────────────────────────────────────────────
  const score  = data.score || 0
  const grade  = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D'
  const gColor = score >= 90 ? [0,212,212] : score >= 75 ? [16,185,129] : score >= 55 ? [245,158,11] : [244,63,94]
  doc.setDrawColor(gColor[0], gColor[1], gColor[2])
  doc.setFillColor(12, 28, 48)
  doc.roundedRect(W - M - 26, 10, 26, 26, 3, 3, 'FD')
  doc.setTextColor(gColor[0], gColor[1], gColor[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  safeText(grade, W - M - 13, 24, { align: 'center' })
  doc.setFontSize(7)
  safeText(`${score.toFixed(1)}/100`, W - M - 13, 31, { align: 'center' })

  let y = 56

  // ── Section helper ────────────────────────────────────────────
  const section = (title: string) => {
    doc.setFillColor(14, 42, 74)
    doc.rect(M, y, CW, 7.5, 'F')
    doc.setTextColor(0, 212, 212)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    safeText(title, M + 3, y + 5.2)
    y += 11
  }

  // ── kv helper ─────────────────────────────────────────────────
  const kv = (label: string, value: string, x: number, yy: number, vColor: number[] = [0,212,212]) => {
    doc.setTextColor(130, 155, 180)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    safeText(label.toUpperCase(), x, yy)
    doc.setTextColor(vColor[0], vColor[1], vColor[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    safeText(value, x, yy + 5.5)
  }

  const c1 = M, c2 = M + CW*0.25, c3 = M + CW*0.5, c4 = M + CW*0.75

  // ── KEY METRICS ───────────────────────────────────────────────
  section('KEY METRICS')
  kv('Total Waste',        `${(data.total_waste_kg||0).toFixed(1)} kg`,       c1, y)
  kv('CO2 Saved',          `${(data.co2_saved_kg||0).toFixed(1)} kg`,         c2, y, [16,185,129])
  kv('Landfill Diverted',  `${(data.landfill_reduced_kg||0).toFixed(1)} kg`,  c3, y)
  kv('Energy Recovered',   `${(data.energy_saved_kwh||0).toFixed(1)} kWh`,    c4, y, [245,158,11])
  y += 16

  kv('Water Conserved',    `${(data.water_saved_liters||0).toFixed(0)} L`,    c1, y)
  kv('Trees Equivalent',   `${(data.trees_equivalent||0).toFixed(1)} trees`,  c2, y, [16,185,129])
  kv('Recycling Rate',     `${(data.recycling_rate_pct||0).toFixed(1)}%`,     c3, y)
  kv('Biodeg Rate',        `${(data.biodeg_rate_pct||0).toFixed(1)}%`,        c4, y, [16,185,129])
  y += 18

  // ── PERFORMANCE SCORES ────────────────────────────────────────
  section('PERFORMANCE SCORES')

  const bar = (label: string, value: number, color: number[]) => {
    doc.setTextColor(150, 175, 200)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    safeText(label, M, y)
    // background
    doc.setFillColor(20, 42, 68)
    doc.roundedRect(M + 52, y - 3.5, CW - 64, 4.5, 1, 1, 'F')
    // fill
    const fillW = Math.max(0, (CW - 64) * Math.min(value, 100) / 100)
    if (fillW > 0) {
      doc.setFillColor(color[0], color[1], color[2])
      doc.roundedRect(M + 52, y - 3.5, fillW, 4.5, 1, 1, 'F')
    }
    // value text
    doc.setTextColor(color[0], color[1], color[2])
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    safeText(`${(value||0).toFixed(1)}`, W - M - 2, y, { align: 'right' })
    y += 9
  }

  bar('Segregation Rate',      data.segregation_score   || 0, [0,212,212])
  bar('Collection Efficiency', data.efficiency_score    || 0, [139,92,246])
  bar('Citizen Participation', data.participation_score || 0, [16,185,129])
  bar('Overall Score',         data.score               || 0, [245,158,11])
  y += 4

  // ── BIN INFRASTRUCTURE ────────────────────────────────────────
  section('BIN INFRASTRUCTURE')
  kv('Smart Bins',    String(data.bin_count || 5),                    c1, y)
  kv('Avg Fill',      `${(data.avg_fill||0).toFixed(1)}%`,            c2, y, [245,158,11])
  kv('Ward ID',       wardId,                                         c3, y, [150,175,200])
  kv('Data Source',   'Pathway IoT Stream',                           c4, y, [16,185,129])
  y += 18

  // ── RECOMMENDATIONS ───────────────────────────────────────────
  section('RECOMMENDATIONS')

  // Build recommendation strings — simple ASCII, no special chars
  const recs: string[] = [
    data.segregation_score < 70
      ? 'Increase segregation awareness campaign across this ward'
      : 'Maintain segregation performance with monthly citizen drives',
    data.avg_fill > 70
      ? 'Increase collection frequency — bins are filling faster than scheduled'
      : 'Collection schedule is optimal — consider reducing vehicle trips',
    data.recycling_rate_pct < 30
      ? 'Install dedicated recycling drop-off points near local markets'
      : 'Recycling rate is healthy — expand programme to neighbouring wards',
    'Deploy Swachh AI across all 272 Delhi wards for city-scale circular economy',
  ]

  // Use helvetica normal — no special bullet chars
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  recs.forEach((rec) => {
    // Draw a simple filled circle bullet manually
    doc.setFillColor(0, 212, 212)
    doc.circle(M + 1.5, y - 1, 1, 'F')

    doc.setTextColor(185, 205, 225)
    safeText(rec, M + 5, y)
    y += 8
  })

  y += 4

  // ── IMPACT PROJECTION ─────────────────────────────────────────
  if (y < 230) {
    section('CITY-SCALE PROJECTION (272 DELHI WARDS)')
    const scale = 272 / 5
    const projWaste = (data.total_waste_kg || 0) * scale * 30
    const projCO2   = (data.co2_saved_kg || 0) * scale * 30

    kv('Projected Waste/Month', `${(projWaste/1000000).toFixed(1)}M kg`, c1, y, [0,212,212])
    kv('CO2 Prevented/Month',   `${(projCO2/1000000).toFixed(1)}M kg`,   c2, y, [16,185,129])
    kv('Jobs Created',          '1,200+',                                 c3, y, [245,158,11])
    kv('Annual Savings',        'Rs 47 Crore',                            c4, y, [244,63,94])
    y += 16
  }

  // ── Footer ────────────────────────────────────────────────────
  doc.setFillColor(10, 22, 40)
  doc.rect(0, 272, W, 25, 'F')

  doc.setTextColor(0, 212, 212)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  safeText('SWACHH AI  |  India Innovates 2026', M, 281)

  doc.setTextColor(90, 120, 155)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  safeText('Domain 1: Urban Solutions  |  AI-Driven Circular Waste Intelligence System', M, 287)
  safeText('Powered by: Pathway 0.29.0  |  FastAPI  |  React  |  YOLO AI Vision', M, 292)

  doc.save(`SwachhAI_${data.ward_name.replace(/\s+/g, '_')}_Report.pdf`)
}

export function WardReportButton({ className }: { className?: string }) {
  const [loading, setLoading]       = useState(false)
  const [selectedWard, setSelectedWard] = useState('ward-001')

  const handleDownload = useCallback(async () => {
    setLoading(true)
    try {
      const [impRes, lbRes] = await Promise.all([
        fetch(`${API}/api/impact/${selectedWard}`,  { cache: 'no-store' }),
        fetch(`${API}/api/leaderboard`,              { cache: 'no-store' }),
      ])

      const impData = impRes.ok ? await impRes.json() : {}
      const lbData  = lbRes.ok  ? await lbRes.json()  : {}
      const wards   = lbData.wards || lbData.top_wards || []
      const ward    = wards.find((w: any) => w.ward_id === selectedWard) || {}
      const wardName = WARDS.find(w => w.id === selectedWard)?.name || 'Unknown'

      const reportData: ReportData = {
        ward_name:           wardName,
        total_waste_kg:      ward.total_waste_kg      || 0,
        co2_saved_kg:        impData.co2_saved_kg     || 0,
        landfill_reduced_kg: impData.landfill_reduced_kg || 0,
        recycling_rate_pct:  impData.recycling_rate_pct  || 0,
        biodeg_rate_pct:     impData.biodeg_rate_pct     || 0,
        energy_saved_kwh:    impData.energy_saved_kwh    || 0,
        water_saved_liters:  impData.water_saved_liters  || 0,
        trees_equivalent:    impData.trees_equivalent    || 0,
        segregation_score:   ward.segregation_score      || 0,
        efficiency_score:    ward.efficiency_score       || 0,
        participation_score: ward.participation_score    || 0,
        score:               ward.score                  || 0,
        bin_count:           ward.bin_count              || 5,
        avg_fill:            ward.avg_fill               || 0,
        updated_at:          new Date().toISOString(),
      }

      await generatePDF(reportData, selectedWard)
      toast.success(`${wardName} report downloaded!`, { icon: '📄' })
    } catch (err: any) {
      toast.error('Report generation failed — check console')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedWard])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <select
        value={selectedWard}
        onChange={e => setSelectedWard(e.target.value)}
        className="bg-[#0a1628] border border-[#0e2a4a] text-cyber-text text-xs font-body rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyber-teal/40"
      >
        {WARDS.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleDownload}
        disabled={loading}
        className={cn(
          'flex items-center gap-2 px-4 py-1.5 rounded-lg border text-xs font-body font-semibold transition-all',
          loading
            ? 'bg-white/5 border-white/10 text-cyber-muted cursor-not-allowed'
            : 'bg-cyber-teal/10 border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal/20',
        )}
      >
        {loading ? (
          <>
            <div className="w-3 h-3 border border-cyber-teal/30 border-t-cyber-teal rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <><span>📄</span> Download Ward Report</>
        )}
      </motion.button>
    </div>
  )
}
