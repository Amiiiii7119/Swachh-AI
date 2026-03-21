import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { BinData, ClassifyResult, LeaderboardEntry, ImpactData } from '@/api/client'

interface AppState {
  bins: BinData[]
  leaderboard: LeaderboardEntry[]
  classificationResult: ClassifyResult | null
  selectedWardId: string
  impactData: ImpactData | null
  sidebarCollapsed: boolean
  apiStatus: 'online' | 'offline' | 'checking'
  userActions: {
    wasteClassified: number
    binsReported: number
    gamesPlayed: number
    ecoPoints: number
  }
}

const initialState: AppState = {
  bins: [],
  leaderboard: [],
  classificationResult: null,
  selectedWardId: 'ward-001',
  impactData: null,
  sidebarCollapsed: false,
  apiStatus: 'checking',
  userActions: {
    wasteClassified: 0,
    binsReported: 0,
    gamesPlayed: 0,
    ecoPoints: 0,
  },
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setBins(state, action: PayloadAction<BinData[]>) {
      state.bins = action.payload
    },
    setLeaderboard(state, action: PayloadAction<LeaderboardEntry[]>) {
      state.leaderboard = action.payload
    },
    setClassificationResult(state, action: PayloadAction<ClassifyResult | null>) {
      state.classificationResult = action.payload
      if (action.payload) {
        state.userActions.wasteClassified += 1
        state.userActions.ecoPoints += 10
      }
    },
    setSelectedWard(state, action: PayloadAction<string>) {
      state.selectedWardId = action.payload
    },
    setImpactData(state, action: PayloadAction<ImpactData | null>) {
      state.impactData = action.payload
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    setApiStatus(state, action: PayloadAction<'online' | 'offline' | 'checking'>) {
      state.apiStatus = action.payload
    },
    addEcoPoints(state, action: PayloadAction<number>) {
      state.userActions.ecoPoints += action.payload
    },
    incrementGamesPlayed(state) {
      state.userActions.gamesPlayed += 1
    },
    reportBin(state) {
      state.userActions.binsReported += 1
      state.userActions.ecoPoints += 5
    },
  },
})

export const {
  setBins,
  setLeaderboard,
  setClassificationResult,
  setSelectedWard,
  setImpactData,
  toggleSidebar,
  setApiStatus,
  addEcoPoints,
  incrementGamesPlayed,
  reportBin,
} = appSlice.actions

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
