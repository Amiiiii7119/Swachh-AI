import axios, { AxiosInstance, AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.request.use(
    (config) => {
      return config
    },
    (error) => Promise.reject(error),
  )

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as typeof error.config & { _retryCount?: number }
      if (!config) return Promise.reject(error)

      config._retryCount = config._retryCount ?? 0

      const isNetworkError = !error.response
      const isServerError = error.response?.status !== undefined && error.response.status >= 500

      if ((isNetworkError || isServerError) && config._retryCount < 2) {
        config._retryCount += 1
        const delay = 1000 * config._retryCount
        await new Promise((res) => setTimeout(res, delay))
        return client(config)
      }

      return Promise.reject(error)
    },
  )

  return client
}

export const apiClient = createApiClient()

export interface BinData {
  id: string
  ward_id: string
  lat: number
  lng: number
  fill_level: number
  last_updated: string
  waste_type: string
  address: string
}

export interface LeaderboardEntry {
  rank: number
  ward_id: string
  ward_name: string
  score: number
  segregation_score: number
  efficiency_score: number
  participation_score: number
  total_waste_kg: number
}

export interface ClassifyResult {
  waste_type: string
  confidence: number
  recyclable: boolean
  hazardous: boolean
  disposal_instructions: string
  sub_category: string
}

export interface ImpactData {
  ward_id: string
  co2_saved_kg: number
  landfill_reduced_kg: number
  trees_equivalent: number
  water_saved_liters: number
  energy_saved_kwh: number
  monthly_data: { month: string; co2_kg: number; landfill_kg: number }[]
}

export interface RouteOptimizationResult {
  bin_ids: string[]
  optimized_route: string[]
  total_distance_km: number
  estimated_time_minutes: number
  waypoints: { lat: number; lng: number; bin_id: string }[]
}

export const api = {
  health: () => apiClient.get('/api/health'),

  classifyWaste: (formData: FormData) =>
    apiClient.post<ClassifyResult>('/api/classify-waste', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),

  getBins: () => apiClient.get<BinData[]>('/api/bins'),

  updateBin: (binId: string, data: Partial<BinData>) =>
    apiClient.post<BinData>('/api/update-bin', { bin_id: binId, ...data }),

  getLeaderboard: () => apiClient.get<LeaderboardEntry[]>('/api/leaderboard'),

  getImpact: (wardId: string) => apiClient.get<ImpactData>(`/api/impact/${wardId}`),

  optimizeRoute: (binIds: string[]) =>
    apiClient.post<RouteOptimizationResult>('/api/optimize-route', { bin_ids: binIds }),
}

export default api
