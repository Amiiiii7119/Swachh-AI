import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#030712',
          panel: '#0a1628',
          border: '#0e2a4a',
          teal: '#00d4d4',
          'teal-dim': '#00a8a8',
          'teal-glow': '#00ffff',
          amber: '#f59e0b',
          rose: '#f43f5e',
          green: '#10b981',
          purple: '#8b5cf6',
          text: '#c8d6e5',
          muted: '#4a6080',
        },
      },
      fontFamily: {
        display: ['Rajdhani', 'sans-serif'],
        body: ['IBM Plex Mono', 'monospace'],
        ui: ['DM Sans', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,212,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,212,0.04) 1px, transparent 1px)',
        'cyber-gradient': 'linear-gradient(135deg, #030712 0%, #0a1628 50%, #030712 100%)',
        'teal-glow': 'radial-gradient(ellipse at center, rgba(0,212,212,0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(0,212,212,0.05) 0%, rgba(0,0,0,0) 100%)',
      },
      backgroundSize: {
        'grid': '48px 48px',
      },
      boxShadow: {
        'cyber': '0 0 0 1px rgba(0,212,212,0.2), 0 4px 24px rgba(0,0,0,0.6)',
        'cyber-hover': '0 0 0 1px rgba(0,212,212,0.5), 0 8px 32px rgba(0,212,212,0.15)',
        'cyber-glow': '0 0 20px rgba(0,212,212,0.3), 0 0 60px rgba(0,212,212,0.1)',
        'rose-glow': '0 0 20px rgba(244,63,94,0.4)',
        'green-glow': '0 0 20px rgba(16,185,129,0.4)',
        'amber-glow': '0 0 20px rgba(245,158,11,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'border-flow': 'borderFlow 4s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        borderFlow: {
          '0%, 100%': { borderColor: 'rgba(0,212,212,0.3)' },
          '50%': { borderColor: 'rgba(0,212,212,0.8)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
