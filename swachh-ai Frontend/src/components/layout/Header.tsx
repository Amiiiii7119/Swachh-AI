import { motion } from 'framer-motion'
import { useAppSelector } from '@/hooks'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { userActions } = useAppSelector((s) => s.app)
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="h-16 flex items-center justify-between px-6 border-b border-[#0e2a4a] glass-panel flex-shrink-0">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-bold text-xl text-white tracking-wider uppercase"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <p className="text-cyber-muted text-xs font-body mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {actions}

        <div className="hidden sm:flex items-center gap-3 border-l border-[#0e2a4a] pl-4">
          <div className="text-right">
            <div className="text-white text-sm font-body font-semibold tracking-widest">{timeStr}</div>
            <div className="text-cyber-muted text-[10px] font-body">{dateStr}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-[#0e2a4a] pl-4">
          <div className="w-8 h-8 rounded-full bg-cyber-teal/20 border border-cyber-teal/40 flex items-center justify-center">
            <span className="text-cyber-teal text-xs font-display font-bold">U</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-white text-xs font-ui font-semibold">Inspector</div>
            <div className="text-cyber-muted text-[10px] font-body">{userActions.ecoPoints} pts</div>
          </div>
        </div>
      </div>
    </div>
  )
}
