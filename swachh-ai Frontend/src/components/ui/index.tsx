import { motion } from 'framer-motion'
import { cn,  } from '@/utils/helpers'
import { useCountUp as useCountUpHook } from '@/hooks'

interface StatCardProps {
  label: string
  value: number
  unit?: string
  icon?: React.ReactNode
  color?: 'teal' | 'amber' | 'rose' | 'green' | 'purple'
  trend?: number
  decimals?: number
  delay?: number
}

const colorMap = {
  teal: {
    bg: 'bg-cyber-teal/8',
    border: 'border-cyber-teal/20',
    icon: 'text-cyber-teal bg-cyber-teal/10',
    value: 'text-cyber-teal',
    glow: 'shadow-[0_0_20px_rgba(0,212,212,0.1)]',
  },
  amber: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/20',
    icon: 'text-amber-400 bg-amber-500/10',
    value: 'text-amber-400',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.1)]',
  },
  rose: {
    bg: 'bg-rose-500/8',
    border: 'border-rose-500/20',
    icon: 'text-rose-400 bg-rose-500/10',
    value: 'text-rose-400',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.1)]',
  },
  green: {
    bg: 'bg-emerald-500/8',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400 bg-emerald-500/10',
    value: 'text-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  purple: {
    bg: 'bg-violet-500/8',
    border: 'border-violet-500/20',
    icon: 'text-violet-400 bg-violet-500/10',
    value: 'text-violet-400',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
}

export function StatCard({ label, value, unit, icon, color = 'teal', trend, decimals = 0, delay = 0 }: StatCardProps) {
  const animatedValue = useCountUpHook(value)
  const colors = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn(
        'corner-bracket relative cyber-card p-5 transition-all duration-300 cursor-default',
        colors.glow,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-cyber-muted text-xs font-body uppercase tracking-widest mb-3">{label}</p>
          <div className="flex items-end gap-1.5">
            <span className={cn('font-display font-bold text-3xl leading-none', colors.value)}>
              {animatedValue >= 1000
                ? (animatedValue / 1000).toFixed(1) + 'K'
                : animatedValue.toFixed(decimals)}
            </span>
            {unit && <span className="text-cyber-muted text-sm font-body mb-0.5">{unit}</span>}
          </div>

          {trend !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-body', trend >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
              <span className="text-cyber-muted">this month</span>
            </div>
          )}
        </div>

        {icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colors.icon)}>
            {icon}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg overflow-hidden">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: delay + 0.3, duration: 0.8 }}
          className={cn('h-full origin-left', {
            'bg-gradient-to-r from-cyber-teal/60 to-cyan-300/30': color === 'teal',
            'bg-gradient-to-r from-amber-400/60 to-amber-300/30': color === 'amber',
            'bg-gradient-to-r from-rose-400/60 to-rose-300/30': color === 'rose',
            'bg-gradient-to-r from-emerald-400/60 to-emerald-300/30': color === 'green',
            'bg-gradient-to-r from-violet-400/60 to-violet-300/30': color === 'purple',
          })}
        />
      </div>
    </motion.div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('cyber-card p-5 animate-pulse', className)}>
      <div className="h-3 w-24 bg-white/5 rounded mb-4" />
      <div className="h-8 w-32 bg-white/5 rounded mb-2" />
      <div className="h-3 w-16 bg-white/5 rounded" />
    </div>
  )
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cyber-card p-4 animate-pulse flex items-center gap-4">
          <div className="w-8 h-8 bg-white/5 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/5 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
          <div className="w-12 h-6 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-cyber-muted mb-4 opacity-40 scale-150">{icon}</div>}
      <h3 className="font-display text-lg font-semibold text-cyber-muted tracking-wide">{title}</h3>
      {description && <p className="text-cyber-muted/60 text-sm font-body mt-1 max-w-xs">{description}</p>}
    </div>
  )
}

export function Badge({ children, color = 'teal' }: { children: React.ReactNode; color?: 'teal' | 'amber' | 'rose' | 'green' }) {
  const colors = {
    teal: 'bg-cyber-teal/10 text-cyber-teal border-cyber-teal/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-body font-medium border uppercase tracking-wider', colors[color])}>
      {children}
    </span>
  )
}

// Re-export for convenience  
export { cn }

