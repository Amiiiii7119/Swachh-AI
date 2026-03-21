import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number, decimals = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(decimals)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function getFillColor(fillLevel: number): string {
  if (fillLevel < 40) return '#10b981'
  if (fillLevel < 75) return '#f59e0b'
  return '#f43f5e'
}

export function getFillLabel(fillLevel: number): string {
  if (fillLevel < 40) return 'Low'
  if (fillLevel < 75) return 'Medium'
  return 'Critical'
}

export function getWasteColor(wasteType: string): string {
  const map: Record<string, string> = {
    biodegradable: '#10b981',
    recyclable: '#3b82f6',
    hazardous: '#f43f5e',
    electronic: '#8b5cf6',
    medical: '#f43f5e',
    general: '#6b7280',
  }
  return map[wasteType.toLowerCase()] || '#6b7280'
}

export function generateMockBins(): import('@/api/client').BinData[] {
  const wards = [
    { id: 'ward-001', name: 'Karol Bagh', lat: 28.6519, lng: 77.1905 },
    { id: 'ward-002', name: 'Dwarka', lat: 28.5921, lng: 77.0460 },
    { id: 'ward-003', name: 'Saket', lat: 28.5245, lng: 77.2066 },
    { id: 'ward-004', name: 'Rohini', lat: 28.7500, lng: 77.1100 },
    { id: 'ward-005', name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
  ]

  const bins = []
  for (let i = 0; i < 25; i++) {
    const ward = wards[i % wards.length]
    bins.push({
      id: `BIN-${String(i + 1).padStart(3, '0')}`,
      ward_id: ward.id,
      lat: ward.lat + (Math.random() - 0.5) * 0.04,
      lng: ward.lng + (Math.random() - 0.5) * 0.04,
      fill_level: Math.floor(Math.random() * 100),
      last_updated: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      waste_type: ['biodegradable', 'recyclable', 'hazardous', 'general'][Math.floor(Math.random() * 4)],
      address: `Sector ${Math.floor(Math.random() * 20) + 1}, ${ward.name}`,
    })
  }
  return bins
}

export const DELHI_WARDS: import('@/api/client').LeaderboardEntry[] = [
  {
    rank: 1,
    ward_id: 'ward-005',
    ward_name: 'Connaught Place',
    score: 94.2,
    segregation_score: 96,
    efficiency_score: 93,
    participation_score: 94,
    total_waste_kg: 12400,
  },
  {
    rank: 2,
    ward_id: 'ward-003',
    ward_name: 'Saket',
    score: 88.7,
    segregation_score: 90,
    efficiency_score: 87,
    participation_score: 89,
    total_waste_kg: 9800,
  },
  {
    rank: 3,
    ward_id: 'ward-001',
    ward_name: 'Karol Bagh',
    score: 83.1,
    segregation_score: 82,
    efficiency_score: 85,
    participation_score: 82,
    total_waste_kg: 15200,
  },
  {
    rank: 4,
    ward_id: 'ward-004',
    ward_name: 'Rohini',
    score: 77.4,
    segregation_score: 78,
    efficiency_score: 76,
    participation_score: 78,
    total_waste_kg: 18600,
  },
  {
    rank: 5,
    ward_id: 'ward-002',
    ward_name: 'Dwarka',
    score: 71.9,
    segregation_score: 70,
    efficiency_score: 74,
    participation_score: 72,
    total_waste_kg: 21000,
  },
]

export const MOCK_IMPACT_DATA: import('@/api/client').ImpactData = {
  ward_id: 'ward-001',
  co2_saved_kg: 48720,
  landfill_reduced_kg: 192400,
  trees_equivalent: 2214,
  water_saved_liters: 890000,
  energy_saved_kwh: 34800,
  monthly_data: [
    { month: 'Jan', co2_kg: 3200, landfill_kg: 12800 },
    { month: 'Feb', co2_kg: 3800, landfill_kg: 15200 },
    { month: 'Mar', co2_kg: 4200, landfill_kg: 16800 },
    { month: 'Apr', co2_kg: 3900, landfill_kg: 15600 },
    { month: 'May', co2_kg: 4600, landfill_kg: 18400 },
    { month: 'Jun', co2_kg: 4100, landfill_kg: 16400 },
    { month: 'Jul', co2_kg: 5200, landfill_kg: 20800 },
    { month: 'Aug', co2_kg: 4800, landfill_kg: 19200 },
    { month: 'Sep', co2_kg: 5600, landfill_kg: 22400 },
    { month: 'Oct', co2_kg: 4400, landfill_kg: 17600 },
    { month: 'Nov', co2_kg: 3820, landfill_kg: 15280 },
    { month: 'Dec', co2_kg: 4850, landfill_kg: 19400 },
  ],
}
