import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/helpers'

interface LoginProps {
  onLogin: (role: 'officer' | 'citizen' | 'admin') => void
}

const ACCOUNTS = [
  { username: 'officer@mcd.gov.in',  password: 'swachh2026', role: 'officer' as const,  label: 'Ward Officer',      badge: 'MCD'   },
  { username: 'admin@swachh.ai',     password: 'admin2026',   role: 'admin'   as const,  label: 'System Admin',      badge: 'ADMIN' },
  { username: 'citizen@delhi.gov.in',password: 'delhi2026',   role: 'citizen' as const,  label: 'Delhi Citizen',     badge: 'ECO'   },
]

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 800)) // simulate auth
    const account = ACCOUNTS.find(a => a.username === username && a.password === password)
    if (account) {
      onLogin(account.role)
    } else {
      setError('Invalid credentials. Try: officer@mcd.gov.in / swachh2026')
      setLoading(false)
    }
  }

  const quickLogin = (acc: typeof ACCOUNTS[0]) => {
    setUsername(acc.username)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen bg-cyber-bg grid-bg bg-grid flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-cyber-teal/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full bg-violet-500/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyber-teal/15 border-2 border-cyber-teal/40 flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 0 30px rgba(0,212,212,0.2)' }}>
            <span className="font-display font-black text-cyber-teal text-2xl">SA</span>
          </div>
          <h1 className="font-display font-black text-white text-3xl tracking-widest">SWACHH AI</h1>
          <p className="text-cyber-teal text-xs font-body tracking-widest mt-1">MUNICIPAL CORPORATION OF DELHI</p>
          <p className="text-cyber-muted text-xs font-body mt-1">AI-Driven Circular Waste Intelligence System</p>
        </motion.div>

        {/* Login card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="cyber-card p-6"
        >
          <h2 className="font-display font-bold text-white text-lg tracking-wider mb-5 text-center">Officer Login</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-cyber-muted text-[10px] font-body uppercase tracking-widest block mb-1.5">
                Email / Officer ID
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="officer@mcd.gov.in"
                className="w-full bg-white/5 border border-[#0e2a4a] focus:border-cyber-teal/50 rounded-lg px-4 py-2.5 text-white text-sm font-body outline-none transition-all placeholder-cyber-muted/40"
              />
            </div>
            <div>
              <label className="text-cyber-muted text-[10px] font-body uppercase tracking-widest block mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-[#0e2a4a] focus:border-cyber-teal/50 rounded-lg px-4 py-2.5 text-white text-sm font-body outline-none transition-all placeholder-cyber-muted/40"
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-400 text-xs font-body bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-3 rounded-lg font-display font-bold text-sm tracking-widest uppercase transition-all',
                loading
                  ? 'bg-cyber-teal/30 text-cyber-muted cursor-not-allowed'
                  : 'bg-cyber-teal text-cyber-bg hover:bg-cyan-300',
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-cyber-bg/30 border-t-cyber-bg rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : 'Login to Dashboard'}
            </button>
          </form>

          {/* Quick login */}
          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3 text-center">Quick Demo Login</p>
            <div className="space-y-2">
              {ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  onClick={() => quickLogin(acc)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/8 hover:border-cyber-teal/30 hover:bg-white/6 transition-all text-left"
                >
                  <span
                    className="text-[9px] font-body font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: acc.role === 'admin' ? 'rgba(139,92,246,0.2)' : acc.role === 'officer' ? 'rgba(0,212,212,0.2)' : 'rgba(16,185,129,0.2)',
                      color:      acc.role === 'admin' ? '#8b5cf6' : acc.role === 'officer' ? '#00d4d4' : '#10b981',
                    }}
                  >{acc.badge}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-body font-medium">{acc.label}</p>
                    <p className="text-cyber-muted text-[10px] font-body truncate">{acc.username}</p>
                  </div>
                  <span className="text-cyber-muted text-[10px] font-body flex-shrink-0">Click to fill</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center mt-5">
          <p className="text-cyber-muted text-[10px] font-body">
            India Innovates 2026 · Bharat Mandapam, New Delhi · Domain 1 — Urban Solutions
          </p>
          <p className="text-cyber-muted/50 text-[9px] font-body mt-1">
            Powered by Pathway 0.29.0 · FastAPI · React · AI Vision
          </p>
        </motion.div>
      </div>
    </div>
  )
}
