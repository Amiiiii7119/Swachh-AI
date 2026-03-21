import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Header } from '@/components/layout/Header'
import { cn } from '@/utils/helpers'
import { useAppDispatch } from '@/hooks'
import { reportBin } from '@/store'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const VAN_ICON = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;background:rgba(245,158,11,0.18);border:2px solid #f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px rgba(245,158,11,0.5);">🚛</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
})

const DEPOT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:rgba(0,212,212,0.2);border:2px solid #00d4d4;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 12px rgba(0,212,212,0.4);">🏭</div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
})

function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, 14, { duration: 1.2 }) }, [center, map])
  return null
}

function MapResizer() {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 150) }, [map])
  return null
}

const DEPOT: [number, number] = [28.6200, 77.2000]
const DELHI_CENTER: [number, number] = [28.6519, 77.2090]

function getVanPosition(d: any): [number, number] {
  const p = Math.min((d.progress_pct || 0) / 100, 1)
  return [DEPOT[0] + (d.lat - DEPOT[0]) * p, DEPOT[1] + (d.lng - DEPOT[1]) * p]
}

const FILTERS = [
  { key: 'all',      label: 'All Bins'        },
  { key: 'critical', label: 'Critical (>75%)' },
  { key: 'medium',   label: 'Medium (40–75%)' },
  { key: 'low',      label: 'Low (<40%)'      },
]

export default function MapView() {
  const dispatch = useAppDispatch()
  const [bins, setBins]                   = useState<any[]>([])
  const [dispatches, setDispatches]       = useState<any[]>([])
  const [dispatchMode, setDispatchMode]   = useState<'manual' | 'auto'>('manual')
  const [filter, setFilter]               = useState('all')
  const [flyTo, setFlyTo]                 = useState<[number, number] | null>(null)
  const [selectedBin, setSelectedBin]     = useState<any | null>(null)
  const [lastUpdate, setLastUpdate]       = useState('')
  const [togglingMode, setTogglingMode]   = useState(false)

  // Route optimization state
  const [routePoints, setRoutePoints]     = useState<[number, number][]>([])
  const [routeInfo, setRouteInfo]         = useState<{ distance: number; bins: number; time: number } | null>(null)
  const [optimizing, setOptimizing]       = useState(false)
  const [showRoute, setShowRoute]         = useState(false)
  const [routeAnimStep, setRouteAnimStep] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [binsRes, dispRes] = await Promise.all([
        fetch(`${API}/api/bins`,     { cache: 'no-store' }),
        fetch(`${API}/api/dispatch`, { cache: 'no-store' }),
      ])
      if (binsRes.ok) {
        const d = await binsRes.json()
        const list = d.bins || d
        if (Array.isArray(list) && list.length > 0) setBins(list)
      }
      if (dispRes.ok) {
        const d = await dispRes.json()
        setDispatches(d.active || [])
        if (d.mode) setDispatchMode(d.mode)
      }
      setLastUpdate(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {}
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 3000)
    return () => clearInterval(id)
  }, [fetchData])

  // Animate route drawing step by step
  useEffect(() => {
    if (!showRoute || routePoints.length === 0) { setRouteAnimStep(0); return }
    setRouteAnimStep(0)
    const interval = setInterval(() => {
      setRouteAnimStep(prev => {
        if (prev >= routePoints.length - 1) { clearInterval(interval); return prev }
        return prev + 1
      })
    }, 150)
    return () => clearInterval(interval)
  }, [showRoute, routePoints])

  const handleOptimizeRoute = useCallback(async () => {
    const critBins = bins.filter(b => (b.fill_level || 0) >= 60).sort((a, b) => b.fill_level - a.fill_level).slice(0, 8)
    if (critBins.length < 2) { toast.error('Need at least 2 bins to optimize a route'); return }

    setOptimizing(true)
    setShowRoute(false)

    try {
      const binIds = critBins.map(b => b.bin_id)
      const res = await fetch(`${API}/api/optimize-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bin_ids: binIds }),
      })

      let orderedBins = critBins
      if (res.ok) {
        const data = await res.json()
        const ordered = data.ordered_bin_ids || data.optimized_route || binIds
        orderedBins = ordered.map((id: string) => critBins.find(b => b.bin_id === id)).filter(Boolean)
      }

      // Build route: depot → bins in order → back to depot (greedy nearest neighbor)
      const points: [number, number][] = [DEPOT]
      const remaining = [...orderedBins]
      let current: [number, number] = DEPOT

      while (remaining.length > 0) {
        let nearestIdx = 0
        let nearestDist = Infinity
        remaining.forEach((b, i) => {
          const d = Math.hypot(b.lat - current[0], b.lng - current[1])
          if (d < nearestDist) { nearestDist = d; nearestIdx = i }
        })
        const next = remaining.splice(nearestIdx, 1)[0]
        current = [next.lat, next.lng]
        points.push(current)
      }
      points.push(DEPOT) // return to depot

      // Calculate total distance (haversine approximation)
      let totalKm = 0
      for (let i = 0; i < points.length - 1; i++) {
        const dLat = (points[i+1][0] - points[i][0]) * 111
        const dLng = (points[i+1][1] - points[i][1]) * 111 * Math.cos(points[i][0] * Math.PI / 180)
        totalKm += Math.sqrt(dLat*dLat + dLng*dLng)
      }

      setRoutePoints(points)
      setRouteInfo({ distance: parseFloat(totalKm.toFixed(1)), bins: orderedBins.length, time: Math.ceil(totalKm * 4) })
      setShowRoute(true)

      // Fly map to show entire route
      setFlyTo([28.63, 77.18])
      toast.success(`Route optimized! ${orderedBins.length} bins, ${totalKm.toFixed(1)} km`, { icon: '🗺️' })
    } catch {
      toast.error('Route optimization failed')
    } finally {
      setOptimizing(false)
    }
  }, [bins])

  const toggleMode = async () => {
    const newMode = dispatchMode === 'manual' ? 'auto' : 'manual'
    setTogglingMode(true)
    try {
      const res = await fetch(`${API}/api/dispatch/mode/${newMode}`, { method: 'POST' })
      if (res.ok) {
        setDispatchMode(newMode)
        toast.success(newMode === 'auto' ? '🤖 Auto dispatch ON — max 5 vans' : '🕹️ Manual dispatch ON')
      }
    } catch { toast.error('Failed to change mode') }
    finally { setTogglingMode(false) }
  }

  const handleManualDispatch = useCallback(async (binId: string) => {
    dispatch(reportBin())
    try {
      const res = await fetch(`${API}/api/dispatch/manual/${binId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) { toast.success(data.message, { icon: '🚛' }); await fetchData() }
      else toast.error(data.message)
    } catch { toast.error('Dispatch request failed') }
  }, [dispatch, fetchData])

  const filteredBins = bins.filter(b => {
    if (filter === 'critical') return (b.fill_level||0) >= 75
    if (filter === 'medium')   return (b.fill_level||0) >= 40 && (b.fill_level||0) < 75
    if (filter === 'low')      return (b.fill_level||0) < 40
    return true
  })

  const dispatchedBinIds = new Set(dispatches.map((d: any) => d.bin_id))
  const animatedRoute    = routePoints.slice(0, routeAnimStep + 2)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Smart Bin Map"
        subtitle="Real-time bin monitoring across Delhi wards"
        actions={
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-[10px] font-body text-cyber-muted">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live · {lastUpdate}
              </div>
            )}
            <button
              onClick={toggleMode} disabled={togglingMode}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-all border',
                dispatchMode === 'auto'
                  ? 'bg-cyber-teal/15 border-cyber-teal/40 text-cyber-teal'
                  : 'bg-white/5 border-white/15 text-cyber-muted hover:border-cyber-teal/30 hover:text-cyber-teal',
              )}
            >
              <div className={cn('w-6 h-3 rounded-full relative transition-all', dispatchMode === 'auto' ? 'bg-cyber-teal' : 'bg-white/20')}>
                <div className={cn('absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all', dispatchMode === 'auto' ? 'left-3.5' : 'left-0.5')} />
              </div>
              {dispatchMode === 'auto' ? '🤖 Auto (5 max)' : '🕹️ Manual'}
            </button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#0e2a4a] overflow-y-auto">

          {/* Mode info */}
          <div className={cn('p-3 border-b border-[#0e2a4a] text-xs font-body', dispatchMode === 'auto' ? 'bg-cyber-teal/8 text-cyber-teal' : 'bg-white/3 text-cyber-muted')}>
            {dispatchMode === 'auto' ? '🤖 Auto — dispatching at 90% fill, max 5 vans' : '🕹️ Manual — click a critical bin to dispatch'}
          </div>

          {/* Route optimizer */}
          <div className="p-4 border-b border-[#0e2a4a]">
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Route Optimization</p>
            <button
              onClick={handleOptimizeRoute}
              disabled={optimizing}
              className={cn(
                'w-full flex items-center gap-2 justify-center py-2.5 rounded-lg text-xs font-body font-semibold transition-all border',
                optimizing
                  ? 'bg-white/5 border-white/10 text-cyber-muted cursor-not-allowed'
                  : 'bg-cyber-teal/10 border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal/20',
              )}
            >
              {optimizing ? (
                <><div className="w-3 h-3 border border-cyber-teal/30 border-t-cyber-teal rounded-full animate-spin" /> Optimizing...</>
              ) : (
                <><span>🗺️</span> Optimize Collection Route</>
              )}
            </button>

            <AnimatePresence>
              {routeInfo && showRoute && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 bg-cyber-teal/5 border border-cyber-teal/20 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Distance',  value: `${routeInfo.distance} km` },
                      { label: 'Bins',      value: String(routeInfo.bins) },
                      { label: 'Est. Time', value: `${routeInfo.time} min` },
                    ].map(s => (
                      <div key={s.label}>
                        <p className="text-cyber-teal font-display font-bold text-base">{s.value}</p>
                        <p className="text-cyber-muted text-[9px] font-body">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowRoute(false)} className="w-full mt-2 text-[10px] font-body text-cyber-muted hover:text-white transition-colors">Clear route</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filter */}
          <div className="p-4 border-b border-[#0e2a4a]">
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Filter Bins</p>
            <div className="space-y-1">
              {FILTERS.map(opt => (
                <button key={opt.key} onClick={() => setFilter(opt.key)}
                  className={cn('w-full text-left px-3 py-2 rounded-lg text-xs font-body transition-all',
                    filter === opt.key ? 'bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20' : 'text-cyber-muted hover:text-cyber-text hover:bg-white/5 border border-transparent'
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="p-4 border-b border-[#0e2a4a]">
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Legend</p>
            <div className="space-y-2">
              {[
                { color: '#10b981', label: 'Low (<40%)',      count: bins.filter(b => (b.fill_level||0) < 40).length },
                { color: '#f59e0b', label: 'Medium (40–75%)', count: bins.filter(b => (b.fill_level||0) >= 40 && (b.fill_level||0) < 75).length },
                { color: '#f43f5e', label: 'Critical (>75%)', count: bins.filter(b => (b.fill_level||0) >= 75).length },
                { color: '#f59e0b', label: '🚛 En Route',     count: dispatches.length },
                { color: '#00d4d4', label: '🗺️ Route',        count: showRoute ? routePoints.length - 2 : 0 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color, boxShadow: `0 0 5px ${item.color}` }} />
                    <span className="text-cyber-muted text-xs font-body">{item.label}</span>
                  </div>
                  <span className="text-white text-xs font-body font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active dispatches */}
          {dispatches.length > 0 && (
            <div className="p-4 border-b border-[#0e2a4a]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <p className="text-amber-400 text-[10px] font-body uppercase tracking-widest">{dispatches.length} Vehicle{dispatches.length > 1 ? 's' : ''} En Route</p>
                </div>
                <span className="text-cyber-muted text-[9px] font-body">/5 max</span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {dispatches.map((d: any) => (
                  <div key={d.dispatch_id} className="bg-amber-500/8 border border-amber-500/20 rounded-lg p-2.5">
                    <div className="flex justify-between mb-1">
                      <span className="text-amber-400 text-xs font-body font-semibold">{d.vehicle_id}</span>
                      <span className="text-amber-300 text-[10px] font-body">{d.progress_pct || 0}%</span>
                    </div>
                    <p className="text-cyber-muted text-[10px] font-body truncate">{d.bin_id} · {d.address}</p>
                    <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-amber-400 rounded-full" animate={{ width: `${d.progress_pct || 0}%` }} transition={{ duration: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bin list */}
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest px-1 mb-2">{filteredBins.length} Bins</p>
            {filteredBins.map(bin => {
              const color = bin.fill_color || '#10b981'
              const isDispatched = dispatchedBinIds.has(bin.bin_id)
              return (
                <motion.button key={bin.bin_id} whileHover={{ x: 2 }}
                  onClick={() => { setSelectedBin(bin); setFlyTo([bin.lat, bin.lng]) }}
                  className={cn('w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all',
                    selectedBin?.bin_id === bin.bin_id ? 'bg-cyber-teal/10 border border-cyber-teal/20' : 'hover:bg-white/5 border border-transparent'
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
                    {isDispatched && <div className="absolute -top-1 -right-1 text-[8px]">🚛</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-body font-semibold">{bin.bin_id}</p>
                    <p className="text-cyber-muted text-[10px] font-body truncate">{bin.address}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-xs font-display font-bold" style={{ color }}>{(bin.fill_level||0).toFixed(0)}%</span>
                    {isDispatched && <span className="text-[8px] text-amber-400 font-body">En Route</span>}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          <MapContainer center={DELHI_CENTER} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <MapController center={flyTo} />
            <MapResizer />

            {/* Depot marker */}
            <Marker position={DEPOT} icon={DEPOT_ICON}>
              <Popup>
                <div className="font-ui text-xs">
                  <p className="font-bold text-white mb-1">MCD Collection Depot</p>
                  <p className="text-gray-400">Central dispatch point for all vehicles</p>
                </div>
              </Popup>
            </Marker>

            {/* Optimized route polyline — animated drawing */}
            {showRoute && animatedRoute.length >= 2 && (
              <Polyline
                positions={animatedRoute}
                pathOptions={{
                  color: '#00d4d4',
                  weight: 3,
                  opacity: 0.8,
                  dashArray: '10 5',
                }}
              />
            )}

            {/* Route waypoint numbers */}
            {showRoute && routePoints.slice(1, -1).map((pt, i) => (
              <CircleMarker key={`route-${i}`} center={pt} radius={10}
                pathOptions={{ color: '#00d4d4', fillColor: '#00d4d4', fillOpacity: 0.9, weight: 2 }}
              >
                <Popup>
                  <p className="font-ui text-xs text-white font-bold">Stop #{i + 1}</p>
                </Popup>
              </CircleMarker>
            ))}

            {/* Bin markers */}
            {filteredBins.map(bin => {
              const color = bin.fill_color || '#10b981'
              const isDispatched = dispatchedBinIds.has(bin.bin_id)
              return (
                <CircleMarker key={bin.bin_id} center={[bin.lat, bin.lng]}
                  radius={(bin.fill_level||0) >= 75 ? 10 : 7}
                  pathOptions={{ color: isDispatched ? '#f59e0b' : color, fillColor: isDispatched ? '#f59e0b' : color, fillOpacity: 0.75, weight: isDispatched ? 3 : 1.5, dashArray: isDispatched ? '4 2' : undefined }}
                  eventHandlers={{ click: () => setSelectedBin(bin) }}
                >
                  <Popup>
                    <div className="min-w-[200px] font-ui">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-display font-bold text-white text-sm">{bin.bin_id}</span>
                        <span className="text-xs font-body px-2 py-0.5 rounded" style={{ color, background: color + '20', border: `1px solid ${color}40` }}>{bin.fill_status || 'unknown'}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{bin.address}</p>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Fill Level</span>
                          <span style={{ color }} className="font-semibold">{(bin.fill_level||0).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${bin.fill_level}%`, background: color }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mb-3">
                        <span className="text-gray-500">Waste Type</span>
                        <span className="text-gray-300 capitalize">{bin.waste_type}</span>
                      </div>
                      {isDispatched ? (
                        <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded text-xs text-amber-300 text-center">🚛 Collection vehicle en route</div>
                      ) : (bin.fill_level||0) >= 75 ? (
                        <button onClick={e => { e.stopPropagation(); handleManualDispatch(bin.bin_id) }} className="w-full py-1.5 text-xs font-semibold rounded border border-amber-500/40 text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 transition-colors">
                          🚛 Dispatch Collection Vehicle
                        </button>
                      ) : (
                        <p className="text-xs text-gray-500 text-center">Below dispatch threshold</p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* Van markers */}
            {dispatches.map((d: any) => (
              <Marker key={d.dispatch_id} position={getVanPosition(d)} icon={VAN_ICON}>
                <Popup>
                  <div className="font-ui text-xs min-w-[160px]">
                    <p className="font-bold text-white mb-1">{d.vehicle_id}</p>
                    <p className="text-gray-400">Target: {d.bin_id}</p>
                    <p className="text-gray-400 mb-2">{d.address}</p>
                    <div className="flex justify-between text-amber-400">
                      <span>Progress</span>
                      <span className="font-semibold">{d.progress_pct || 0}%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${d.progress_pct||0}%` }} />
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Overlay stats */}
          <div className="absolute top-4 right-4 z-[1000] space-y-2">
            {[
              { label: 'Total',    value: bins.length,                                  color: 'text-white'       },
              { label: 'Critical', value: bins.filter(b => (b.fill_level||0) >= 75).length, color: 'text-rose-400'  },
              { label: 'Active',   value: bins.filter(b => (b.fill_level||0) < 75).length,  color: 'text-emerald-400'},
              { label: 'En Route', value: dispatches.length,                             color: 'text-amber-400'   },
            ].map(stat => (
              <div key={stat.label} className="glass-panel border border-[#0e2a4a] rounded-lg px-3 py-2 text-right">
                <p className={cn('font-display font-bold text-lg leading-none', stat.color)}>{stat.value}</p>
                <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Route active indicator */}
          {showRoute && routeInfo && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
              <div className="glass-panel border border-cyber-teal/40 rounded-xl px-5 py-3 flex items-center gap-4"
                style={{ boxShadow: '0 0 20px rgba(0,212,212,0.2)' }}>
                <div className="w-2 h-2 rounded-full bg-cyber-teal animate-pulse" />
                <span className="text-cyber-teal text-xs font-body font-semibold">Optimized Route Active</span>
                <span className="text-cyber-muted text-xs font-body">{routeInfo.distance} km · {routeInfo.bins} bins · ~{routeInfo.time} min</span>
                <button onClick={() => setShowRoute(false)} className="text-cyber-muted hover:text-white text-xs font-body transition-colors ml-2">✕ Clear</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
