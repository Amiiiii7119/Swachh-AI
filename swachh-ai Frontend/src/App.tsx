import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAppDispatch } from '@/hooks'
import { setApiStatus } from '@/store'
import { api } from '@/api/client'
import Login from '@/pages/login'

const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Classifier  = lazy(() => import('./pages/Classifier'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const MapView     = lazy(() => import('./pages/MapView'))
const Impact      = lazy(() => import('./pages/Impact'))
const Games       = lazy(() => import('./pages/Games'))

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-cyber-teal/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-transparent border-t-cyber-teal rounded-full animate-spin" />
        </div>
        <p className="text-cyber-muted text-xs font-body uppercase tracking-widest animate-pulse">Loading module...</p>
      </div>
    </div>
  )
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  const dispatch = useAppDispatch()
  const [loggedIn, setLoggedIn] = useState(() => {
    return localStorage.getItem('swachh_auth') === 'true'
  })

  const handleLogin = (role: string) => {
    localStorage.setItem('swachh_auth', 'true')
    localStorage.setItem('swachh_role', role)
    setLoggedIn(true)
  }

  useEffect(() => {
    dispatch(setApiStatus('checking'))
    api.health()
      .then(() => dispatch(setApiStatus('online')))
      .catch(() => dispatch(setApiStatus('offline')))
  }, [])

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cyber-bg grid-bg bg-grid">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-cyber-teal/4 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-violet-500/4 blur-[120px]" />
      </div>

      <Sidebar onLogout={() => { localStorage.removeItem('swachh_auth'); setLoggedIn(false) }} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"            element={<PageWrapper><Dashboard /></PageWrapper>} />
              <Route path="/classifier"  element={<PageWrapper><Classifier /></PageWrapper>} />
              <Route path="/leaderboard" element={<PageWrapper><Leaderboard /></PageWrapper>} />
              <Route path="/map"         element={<PageWrapper><MapView /></PageWrapper>} />
              <Route path="/impact"      element={<PageWrapper><Impact /></PageWrapper>} />
              <Route path="/games"       element={<PageWrapper><Games /></PageWrapper>} />
              <Route path="*" element={
                <PageWrapper>
                  <div className="flex-1 flex items-center justify-center flex-col gap-4">
                    <p className="font-display text-6xl font-black text-cyber-teal">404</p>
                    <p className="text-cyber-muted font-body">Page not found.</p>
                  </div>
                </PageWrapper>
              } />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  )
}
