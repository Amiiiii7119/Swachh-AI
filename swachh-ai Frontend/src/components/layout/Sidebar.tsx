import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppDispatch, useAppSelector } from '@/hooks'
import { toggleSidebar } from '@/store'
import { cn } from '@/utils/helpers'

const NAV_ITEMS = [
  {
    path: '/', label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    path: '/classifier', label: 'AI Classifier',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" /></svg>,
  },
  {
    path: '/leaderboard', label: 'Leaderboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M8 11h8M8 15h5" /></svg>,
  },
  {
    path: '/map', label: 'Smart Map',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>,
  },
  {
    path: '/impact', label: 'Eco Impact',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  },
  {
    path: '/games', label: 'Eco Games',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01M7 12h.01M17 12h.01M10 10v4M8 12h4" /><circle cx="16" cy="12" r="1" fill="currentColor" /></svg>,
  },
]

interface SidebarProps {
  onLogout?: () => void
}

export function Sidebar({ onLogout }: SidebarProps) {
  const dispatch  = useAppDispatch()
  const { sidebarCollapsed, apiStatus, userActions } = useAppSelector(s => s.app)
  const location  = useLocation()
  const role      = localStorage.getItem('swachh_role') || 'officer'
  const roleLabel = role === 'admin' ? 'System Admin' : role === 'officer' ? 'Ward Officer' : 'Delhi Citizen'
  const roleColor = role === 'admin' ? '#8b5cf6' : role === 'officer' ? '#00d4d4' : '#10b981'

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex-shrink-0 h-screen sticky top-0 flex flex-col glass-panel border-r border-[#0e2a4a] z-40"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#0e2a4a]">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-cyber-teal/20 border border-cyber-teal/40 flex items-center justify-center flex-shrink-0">
                <span className="text-cyber-teal text-xs font-display font-bold">SA</span>
              </div>
              <div>
                <div className="font-display font-bold text-white text-sm tracking-widest">SWACHH</div>
                <div className="font-body text-cyber-teal text-[9px] tracking-widest -mt-0.5">AI SYSTEM v6.0</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => dispatch(toggleSidebar())} className="w-7 h-7 flex items-center justify-center text-cyber-muted hover:text-cyber-teal transition-colors rounded">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            {sidebarCollapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
          </svg>
        </button>
      </div>

      {/* Role badge */}
      {!sidebarCollapsed && (
        <div className="px-4 py-2.5 border-b border-[#0e2a4a]">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: roleColor + '12', border: `1px solid ${roleColor}30` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: roleColor }} />
            <span className="text-[10px] font-body font-semibold" style={{ color: roleColor }}>{roleLabel}</span>
          </div>
        </div>
      )}

      {/* API status */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b border-[#0e2a4a]', sidebarCollapsed && 'justify-center px-0')}>
        <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', {
          'bg-green-400 shadow-[0_0_6px_#10b981]': apiStatus === 'online',
          'bg-rose-500': apiStatus === 'offline',
          'bg-amber-400 animate-pulse': apiStatus === 'checking',
        })} />
        {!sidebarCollapsed && <span className="text-[10px] font-body text-cyber-muted uppercase tracking-wider">API {apiStatus}</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
          return (
            <NavLink key={item.path} to={item.path}>
              <motion.div
                whileHover={{ x: sidebarCollapsed ? 0 : 2 }}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  sidebarCollapsed ? 'justify-center' : '',
                  isActive ? 'bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20' : 'text-cyber-muted hover:text-cyber-text hover:bg-white/5 border border-transparent',
                )}
              >
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-cyber-teal rounded-r"
                    style={{ boxShadow: '0 0 8px rgba(0,212,212,0.6)' }} />
                )}
                <span className="flex-shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                      className="font-ui text-sm font-medium whitespace-nowrap overflow-hidden"
                    >{item.label}</motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </NavLink>
          )
        })}
      </nav>

      {/* Eco Points */}
      <div className={cn('border-t border-[#0e2a4a] p-3', sidebarCollapsed && 'flex justify-center')}>
        {sidebarCollapsed ? (
          <div className="text-center">
            <div className="text-cyber-teal text-xs font-body font-semibold">{userActions.ecoPoints}</div>
            <div className="text-cyber-muted text-[8px]">PTS</div>
          </div>
        ) : (
          <div className="bg-cyber-teal/5 border border-cyber-teal/15 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyber-muted text-[10px] font-body uppercase tracking-wider">Eco Points</span>
              <span className="text-cyber-teal font-display font-bold text-sm">{userActions.ecoPoints.toLocaleString()}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyber-teal to-cyan-300 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((userActions.ecoPoints % 100), 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-cyber-muted text-[9px] font-body">Level {Math.floor(userActions.ecoPoints / 100) + 1}</span>
              <span className="text-cyber-muted text-[9px] font-body">{100 - (userActions.ecoPoints % 100)} to next</span>
            </div>
            {/* Redemption hint */}
            <div className="mt-2 pt-2 border-t border-white/8">
              <p className="text-cyber-muted text-[9px] font-body text-center">
                🎁 Points redeemable for MCD bill discounts
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      {onLogout && (
        <div className={cn('border-t border-[#0e2a4a] p-3', sidebarCollapsed && 'flex justify-center')}>
          <button
            onClick={onLogout}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-cyber-muted hover:text-rose-400 hover:bg-rose-500/8 transition-all border border-transparent hover:border-rose-500/20',
              sidebarCollapsed ? 'justify-center' : 'w-full',
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {!sidebarCollapsed && <span className="text-xs font-body">Logout</span>}
          </button>
        </div>
      )}
    </motion.aside>
  )
}
