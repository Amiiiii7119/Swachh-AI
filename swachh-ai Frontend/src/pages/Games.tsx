import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { useAppDispatch } from '@/hooks'
import { addEcoPoints, incrementGamesPlayed } from '@/store'
import { cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Difficulty = 'easy' | 'medium' | 'hard'
type GameId = 'sorting' | 'quiz' | 'ward' | 'factory' | null
type Screen = 'hub' | 'difficulty' | 'playing' | 'result'

interface DifficultyConfig {
  label: string
  color: string
  glow: string
  description: string
}

const DIFFICULTY_MAP: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: 'Easy',   color: '#10b981', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',  description: 'Learn the basics — perfect for beginners' },
  medium: { label: 'Medium', color: '#f59e0b', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',  description: 'A real challenge — for the informed citizen' },
  hard:   { label: 'Hard',   color: '#f43f5e', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.4)]',   description: 'Expert level — MCD officer mode' },
}

// ═══════════════════════════════════════════════════════════════
// SHARED DATA
// ═══════════════════════════════════════════════════════════════

type WasteCategory = 'biodegradable' | 'recyclable' | 'hazardous' | 'ewaste' | 'medical' | 'general'

interface WasteItem { id: string; name: string; emoji: string; category: WasteCategory; fact: string }

const ALL_WASTE_ITEMS: WasteItem[] = [
  { id: 'apple',      name: 'Apple Core',       emoji: '🍎', category: 'biodegradable', fact: 'Composts in 2 months, enriching soil' },
  { id: 'bottle',     name: 'Plastic Bottle',   emoji: '🍶', category: 'recyclable',    fact: 'PET bottles can be recycled into fiber' },
  { id: 'battery',    name: 'Dead Battery',      emoji: '🔋', category: 'hazardous',     fact: 'Contains mercury and lead — toxic to soil' },
  { id: 'newspaper',  name: 'Newspaper',         emoji: '📰', category: 'recyclable',    fact: 'Paper recycling saves 17 trees per ton' },
  { id: 'banana',     name: 'Banana Peel',       emoji: '🍌', category: 'biodegradable', fact: 'Rich in potassium — excellent compost' },
  { id: 'bulb',       name: 'CFL Bulb',          emoji: '💡', category: 'hazardous',     fact: 'Contains mercury vapour — never crush' },
  { id: 'can',        name: 'Aluminum Can',      emoji: '🥤', category: 'recyclable',    fact: 'Recycling aluminium uses 95% less energy' },
  { id: 'leaves',     name: 'Dry Leaves',        emoji: '🍂', category: 'biodegradable', fact: 'Excellent for Delhi compost pits' },
  { id: 'paint',      name: 'Paint Can',         emoji: '🪣', category: 'hazardous',     fact: 'VOC solvents contaminate groundwater' },
  { id: 'cardboard',  name: 'Cardboard Box',     emoji: '📦', category: 'recyclable',    fact: 'Flatten before recycling to save space' },
  { id: 'phone',      name: 'Old Phone',         emoji: '📱', category: 'ewaste',        fact: 'E-waste contains gold, silver, palladium' },
  { id: 'syringe',    name: 'Used Syringe',      emoji: '💉', category: 'medical',       fact: 'Biohazard — requires autoclave treatment' },
  { id: 'eggshell',   name: 'Egg Shells',        emoji: '🥚', category: 'biodegradable', fact: 'Calcium-rich — great garden amendment' },
  { id: 'motor_oil',  name: 'Motor Oil',         emoji: '🛢️', category: 'hazardous',     fact: '1L oil can contaminate 1M litres water' },
  { id: 'laptop',     name: 'Old Laptop',        emoji: '💻', category: 'ewaste',        fact: 'Delhi has 26 certified e-waste centres' },
  { id: 'medicine',   name: 'Expired Medicine',  emoji: '💊', category: 'medical',       fact: 'Flush medicines contaminate groundwater' },
  { id: 'steel_can',  name: 'Steel Can',         emoji: '🥫', category: 'recyclable',    fact: 'Steel is the most recycled material globally' },
  { id: 'veg_peels',  name: 'Vegetable Peels',   emoji: '🥕', category: 'biodegradable', fact: 'Peels contain most vitamins — compost gold' },
  { id: 'glass_jar',  name: 'Glass Jar',         emoji: '🫙', category: 'recyclable',    fact: 'Glass can be recycled infinitely' },
  { id: 'thermometer',name: 'Mercury Thermometer',emoji: '🌡️', category: 'hazardous',    fact: 'Mercury poisoning affects the nervous system' },
  { id: 'tea_bag',    name: 'Used Tea Bag',      emoji: '🍵', category: 'biodegradable', fact: 'Tea grounds improve soil drainage' },
  { id: 'cd',         name: 'Old CD/DVD',        emoji: '💿', category: 'ewaste',        fact: 'Contains polycarbonate — takes 1M yrs to decompose' },
  { id: 'coconut',    name: 'Coconut Shell',     emoji: '🥥', category: 'biodegradable', fact: 'Coconut shells make excellent biochar' },
  { id: 'aerosol',    name: 'Aerosol Can',       emoji: '🧴', category: 'hazardous',     fact: 'Pressurised — never puncture or incinerate' },
]

const BIN_CONFIG: Record<WasteCategory, { label: string; color: string; bg: string; border: string; icon: string }> = {
  biodegradable: { label: 'Biodegradable', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '🌿' },
  recyclable:    { label: 'Recyclable',    color: '#3b82f6', bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: '♻️' },
  hazardous:     { label: 'Hazardous',     color: '#f43f5e', bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: '⚠️' },
  ewaste:        { label: 'E-Waste',       color: '#8b5cf6', bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  icon: '⚡' },
  medical:       { label: 'Medical',       color: '#ec4899', bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    icon: '🏥' },
  general:       { label: 'General',       color: '#6b7280', bg: 'bg-gray-500/10',    border: 'border-gray-500/30',    icon: '🗑️' },
}

// ═══════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════

function ResultScreen({ score, maxScore, gameName, difficulty, facts, onReplay, onBack }: {
  score: number; maxScore: number; gameName: string; difficulty: Difficulty
  facts: string[]; onReplay: () => void; onBack: () => void
}) {
  const dispatch = useAppDispatch()
  const pct   = Math.round((score / Math.max(maxScore, 1)) * 100)
  const grade = pct >= 90 ? 'S' : pct >= 75 ? 'A' : pct >= 55 ? 'B' : pct >= 35 ? 'C' : 'D'
  const gradeColors = { S: '#00d4d4', A: '#10b981', B: '#f59e0b', C: '#f97316', D: '#f43f5e' }
  const gc = gradeColors[grade]
  const pts = Math.floor(score * (difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1))

  useEffect(() => {
    dispatch(incrementGamesPlayed())
    dispatch(addEcoPoints(pts))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto"
    >
      <div className="cyber-card p-8 text-center">
        {/* Grade ring */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
          className="w-28 h-28 rounded-full border-4 flex items-center justify-center mx-auto mb-5"
          style={{ borderColor: gc, boxShadow: `0 0 40px ${gc}40` }}
        >
          <span className="font-display font-black text-5xl" style={{ color: gc }}>{grade}</span>
        </motion.div>

        <h2 className="font-display font-bold text-white text-3xl tracking-wider mb-1">Game Over!</h2>
        <p className="text-cyber-muted font-body text-sm mb-6">{gameName} · {DIFFICULTY_MAP[difficulty].label}</p>

        <div className="flex items-center justify-center gap-8 mb-6">
          <div>
            <p className="text-cyber-muted text-xs font-body uppercase tracking-wider">Score</p>
            <p className="font-display font-black text-5xl" style={{ color: gc }}>{score}</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-cyber-muted text-xs font-body uppercase tracking-wider">Accuracy</p>
            <p className="font-display font-black text-5xl text-white">{pct}%</p>
          </div>
          <div className="w-px h-12 bg-white/10" />
          <div>
            <p className="text-cyber-muted text-xs font-body uppercase tracking-wider">Eco Points</p>
            <p className="font-display font-black text-5xl text-cyber-teal">+{pts}</p>
          </div>
        </div>

        {/* Educational facts earned */}
        {facts.length > 0 && (
          <div className="bg-cyber-teal/5 border border-cyber-teal/20 rounded-xl p-4 mb-6 text-left">
            <p className="text-cyber-teal text-xs font-body uppercase tracking-widest mb-3">
              Facts You Learned Today
            </p>
            <div className="space-y-2">
              {facts.slice(0, 3).map((f, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="text-cyber-text text-xs font-body leading-relaxed flex gap-2"
                >
                  <span className="text-cyber-teal flex-shrink-0">▸</span>
                  {f}
                </motion.p>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onReplay}
            className="px-8 py-2.5 bg-cyber-teal text-cyber-bg rounded-lg font-display font-bold text-sm tracking-widest uppercase hover:bg-cyan-300 transition-all"
          >
            Play Again
          </button>
          <button
            onClick={onBack}
            className="px-8 py-2.5 border border-white/15 text-cyber-muted rounded-lg font-display font-bold text-sm tracking-widest uppercase hover:border-white/30 hover:text-white transition-all"
          >
            Game Hub
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GAME 1: WASTE SORTING (with levels)
// ═══════════════════════════════════════════════════════════════

function WasteSortingGame({ difficulty, onComplete }: { difficulty: Difficulty; onComplete: (score: number, facts: string[]) => void }) {
  const cfg = {
    easy:   { items: 8,  time: 90, bins: ['biodegradable', 'recyclable', 'hazardous'] as WasteCategory[] },
    medium: { items: 14, time: 65, bins: ['biodegradable', 'recyclable', 'hazardous', 'ewaste'] as WasteCategory[] },
    hard:   { items: 20, time: 45, bins: ['biodegradable', 'recyclable', 'hazardous', 'ewaste', 'medical'] as WasteCategory[] },
  }[difficulty]

  const dispatch = useAppDispatch()
  const validItems = ALL_WASTE_ITEMS.filter(i => cfg.bins.includes(i.category))
  const [items, setItems] = useState<WasteItem[]>(() =>
    [...validItems].sort(() => Math.random() - 0.5).slice(0, cfg.items)
  )
  const [score, setScore]     = useState(0)
  const [timeLeft, setTimeLeft] = useState(cfg.time)
  const [dragOver, setDragOver] = useState<WasteCategory | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong'; msg: string } | null>(null)
  const [factsLearned, setFactsLearned] = useState<string[]>([])
  const [combo, setCombo]     = useState(0)

  useEffect(() => {
    if (timeLeft <= 0 || items.length === 0) { onComplete(score, factsLearned); return }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, items.length, score])

  const handleDrop = useCallback((bin: WasteCategory) => {
    if (!draggingId) return
    const item = items.find(i => i.id === draggingId)
    if (!item) return
    const correct = item.category === bin
    if (correct) {
      const pts = 15 + combo * 5
      setScore(s => s + pts)
      setCombo(c => c + 1)
      dispatch(addEcoPoints(pts))
      setItems(prev => prev.filter(i => i.id !== draggingId))
      setFactsLearned(prev => [...new Set([...prev, item.fact])])
      setFeedback({ type: 'correct', msg: `+${pts} pts! ${item.fact}` })
    } else {
      setScore(s => Math.max(0, s - 5))
      setCombo(0)
      setFeedback({ type: 'wrong', msg: `Wrong! ${item.name} → ${BIN_CONFIG[item.category].label}` })
    }
    setDragOver(null); setDraggingId(null)
    setTimeout(() => setFeedback(null), 2500)
  }, [draggingId, items, combo, dispatch])

  const timerPct  = (timeLeft / cfg.time) * 100
  const timerColor = timeLeft <= 10 ? '#f43f5e' : timeLeft <= 20 ? '#f59e0b' : '#10b981'

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* HUD */}
      <div className="flex items-center justify-between cyber-card p-3">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">Score</p>
            <p className="text-cyber-teal font-display font-bold text-2xl">{score}</p>
          </div>
          <div className="text-center">
            <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">Left</p>
            <p className="text-white font-display font-bold text-2xl">{items.length}</p>
          </div>
          {combo > 1 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30"
            >
              <span className="text-amber-400 text-sm">🔥</span>
              <span className="text-amber-400 font-display font-bold">{combo}x COMBO</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40 h-2.5 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${timerPct}%`, background: timerColor }}
            />
          </div>
          <span
            className={cn('font-display font-bold text-xl w-8', timeLeft <= 10 && 'animate-pulse')}
            style={{ color: timerColor }}
          >{timeLeft}</span>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn('p-3 rounded-xl border text-sm font-body',
              feedback.type === 'correct'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            )}
          >
            {feedback.type === 'correct' ? '✓ ' : '✗ '}{feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items */}
      <div>
        <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">
          Drag each item to the correct bin
        </p>
        <div className="flex flex-wrap gap-3 min-h-[72px]">
          <AnimatePresence>
            {items.map(item => (
              <motion.div
                key={item.id}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 15 }}
                draggable
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => { setDraggingId(null); setDragOver(null) }}
                whileHover={{ scale: 1.08, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border cursor-grab active:cursor-grabbing select-none',
                  'bg-white/5 border-white/10 hover:border-cyber-teal/40',
                  draggingId === item.id && 'opacity-40'
                )}
              >
                <span className="text-3xl">{item.emoji}</span>
                <span className="text-white text-xs font-ui font-medium text-center whitespace-nowrap">{item.name}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bins */}
      <div className={cn('grid gap-3', {
        'grid-cols-3': cfg.bins.length === 3,
        'grid-cols-4': cfg.bins.length === 4,
        'grid-cols-5': cfg.bins.length === 5,
      })}>
        {cfg.bins.map(bin => {
          const bc = BIN_CONFIG[bin]
          const isOver = dragOver === bin
          return (
            <div
              key={bin}
              onDragOver={e => { e.preventDefault(); setDragOver(bin) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(bin)}
              className={cn(
                'min-h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-200',
                bc.bg, bc.border,
                isOver && 'border-solid scale-105'
              )}
              style={isOver ? { borderColor: bc.color, boxShadow: `0 0 24px ${bc.color}30` } : {}}
            >
              <span className="text-3xl">{bc.icon}</span>
              <p className="font-display font-semibold text-xs tracking-wide" style={{ color: bc.color }}>
                {bc.label.toUpperCase()}
              </p>
              {isOver && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-body" style={{ color: bc.color }}>Drop here!</motion.p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GAME 2: SPEED QUIZ (with levels)
// ═══════════════════════════════════════════════════════════════

const QUIZ_QUESTIONS = [
  { item: 'Used Tea Bags',       emoji: '🍵', correct: 'biodegradable' as WasteCategory,  explanation: 'Tea is organic — composts in weeks' },
  { item: 'Glass Jar',           emoji: '🫙', correct: 'recyclable'    as WasteCategory,  explanation: 'Glass is 100% infinitely recyclable' },
  { item: 'Expired Medicine',    emoji: '💊', correct: 'medical'       as WasteCategory,  explanation: 'Medicines need pharmacy disposal' },
  { item: 'Coffee Grounds',      emoji: '☕', correct: 'biodegradable' as WasteCategory,  explanation: 'Coffee is great for composting' },
  { item: 'Steel Cans',          emoji: '🥫', correct: 'recyclable'    as WasteCategory,  explanation: 'Steel recycling saves 75% energy' },
  { item: 'Motor Oil',           emoji: '🛢️', correct: 'hazardous'     as WasteCategory,  explanation: 'Oil contaminates groundwater' },
  { item: 'Old Laptop',          emoji: '💻', correct: 'ewaste'        as WasteCategory,  explanation: 'E-waste has recoverable precious metals' },
  { item: 'Pizza Box',           emoji: '🍕', correct: 'biodegradable' as WasteCategory,  explanation: 'Greasy paper — goes to wet waste' },
  { item: 'Broken Thermometer',  emoji: '🌡️', correct: 'hazardous'     as WasteCategory,  explanation: 'Mercury is highly toxic' },
  { item: 'Coconut Shell',       emoji: '🥥', correct: 'biodegradable' as WasteCategory,  explanation: 'Natural material — compostable' },
  { item: 'Old CD',              emoji: '💿', correct: 'ewaste'        as WasteCategory,  explanation: 'Polycarbonate plastic — e-waste centre' },
  { item: 'Aerosol Can',         emoji: '🧴', correct: 'hazardous'     as WasteCategory,  explanation: 'Pressurised — hazardous waste' },
  { item: 'Vegetable Peels',     emoji: '🥕', correct: 'biodegradable' as WasteCategory,  explanation: 'Best compost material available' },
  { item: 'Broken Glass',        emoji: '🔮', correct: 'recyclable'    as WasteCategory,  explanation: 'Wrap before placing in recyclables' },
  { item: 'Hospital Syringe',    emoji: '💉', correct: 'medical'       as WasteCategory,  explanation: 'Sharps need autoclave treatment' },
  { item: 'Newspaper',           emoji: '📰', correct: 'recyclable'    as WasteCategory,  explanation: 'Dry paper = valuable recyclable' },
  { item: 'Fertiliser Container',emoji: '🧪', correct: 'hazardous'     as WasteCategory,  explanation: 'Chemical residues are toxic' },
  { item: 'Egg Shells',          emoji: '🥚', correct: 'biodegradable' as WasteCategory,  explanation: 'Calcium-rich compost amendment' },
]

function SpeedQuizGame({ difficulty, onComplete }: { difficulty: Difficulty; onComplete: (score: number, facts: string[]) => void }) {
  const timePerQ  = { easy: 10, medium: 6, hard: 3 }[difficulty]
  const binCount  = { easy: 3, medium: 4, hard: 5 }[difficulty]
  const penalties = { easy: false, medium: false, hard: true }[difficulty]

  const dispatch    = useAppDispatch()
  const [questions] = useState(() => [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5))
  const [current, setCurrent]   = useState(0)
  const [score, setScore]       = useState(0)
  const [timeLeft, setTimeLeft] = useState(timePerQ)
  const [answered, setAnswered] = useState<string | null>(null)
  const [streak, setStreak]     = useState(0)
  const [factsLearned, setFactsLearned] = useState<string[]>([])

  const q        = questions[current]
  const allBins  = Object.keys(BIN_CONFIG) as WasteCategory[]
  const options  = [q.correct, ...allBins.filter(b => b !== q.correct).sort(() => Math.random() - 0.5)].slice(0, binCount) as WasteCategory[]

  useEffect(() => {
    if (answered) return
    if (timeLeft <= 0) { handleAnswer(null); return }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, answered])

  const handleAnswer = useCallback((choice: WasteCategory | null) => {
    if (answered !== null) return
    const correct = choice === q.correct
    if (correct) {
      const pts = 10 + streak * 3
      setScore(s => s + pts)
      setStreak(s => s + 1)
      dispatch(addEcoPoints(pts))
      setFactsLearned(prev => [...new Set([...prev, q.explanation])])
    } else {
      setStreak(0)
      if (penalties) setScore(s => Math.max(0, s - 5))
    }
    setAnswered(choice ?? 'timeout')
    setTimeout(() => {
      if (current + 1 >= questions.length) {
        onComplete(score + (correct ? 10 + streak * 3 : 0), factsLearned)
      } else {
        setCurrent(c => c + 1)
        setAnswered(null)
        setTimeLeft(timePerQ)
      }
    }, 1100)
  }, [answered, q, current, questions.length, score, streak, factsLearned, dispatch, timePerQ, penalties])

  const timerPct = (timeLeft / timePerQ) * 100

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* HUD */}
      <div className="flex justify-between items-center cyber-card p-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-cyber-muted text-[9px] font-body uppercase">Score</p>
            <p className="text-cyber-teal font-display font-bold text-2xl">{score}</p>
          </div>
          {streak > 1 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30">
              <span className="text-amber-400">🔥</span>
              <span className="text-amber-400 font-display font-bold text-sm">{streak}x</span>
            </motion.div>
          )}
        </div>
        <div className="text-right">
          <p className="text-cyber-muted text-[9px] font-body uppercase">Question</p>
          <p className="text-white font-display font-bold text-lg">{current + 1}/{questions.length}</p>
        </div>
      </div>

      {/* Timer */}
      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full transition-colors duration-300', timeLeft <= 2 ? 'bg-rose-400' : 'bg-cyber-teal')}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          className="cyber-card p-8 text-center"
        >
          <div className="text-8xl mb-4">{q.emoji}</div>
          <h3 className="font-display font-bold text-white text-2xl tracking-wide">{q.item}</h3>
          <p className="text-cyber-muted text-sm font-body mt-1">Which bin does this belong in?</p>
          {difficulty === 'hard' && <p className="text-rose-400 text-xs font-body mt-1">⚠ Wrong answers deduct 5 points</p>}
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <div className={cn('grid gap-3', options.length <= 3 ? 'grid-cols-3' : options.length === 4 ? 'grid-cols-4' : 'grid-cols-5')}>
        {options.map(opt => {
          const bc = BIN_CONFIG[opt]
          const isChosen  = answered === opt
          const isCorrect = opt === q.correct
          const showResult = answered !== null
          return (
            <motion.button
              key={opt}
              whileHover={!answered ? { scale: 1.05, y: -3 } : {}}
              whileTap={!answered ? { scale: 0.96 } : {}}
              onClick={() => handleAnswer(opt)}
              disabled={!!answered}
              className={cn(
                'py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all duration-200',
                bc.bg, bc.border,
                showResult && isCorrect && 'ring-2 ring-emerald-400/50 scale-105',
                showResult && isChosen && !isCorrect && 'opacity-50 ring-2 ring-rose-400/50',
                !answered && 'cursor-pointer',
              )}
            >
              <span className="text-2xl">{bc.icon}</span>
              <span className="font-display font-semibold text-xs tracking-wide" style={{ color: bc.color }}>
                {bc.label.toUpperCase()}
              </span>
              {showResult && isCorrect && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400">✓</motion.span>}
              {showResult && isChosen && !isCorrect && <span className="text-rose-400">✗</span>}
            </motion.button>
          )
        })}
      </div>

      {/* Explanation */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('p-3 rounded-xl border text-sm font-body', answered === q.correct ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300')}
          >
            {answered === q.correct ? `✓ Correct! ` : `✗ That was ${BIN_CONFIG[q.correct].label}. `}
            {q.explanation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GAME 3: DELHI WARD MANAGER
// ═══════════════════════════════════════════════════════════════

interface WardBin { id: string; fill: number; ward: string; status: 'ok' | 'warning' | 'critical' }
interface Crisis   { id: string; msg: string; icon: string; penalty: number; duration: number }

function WardManagerGame({ difficulty, onComplete }: { difficulty: Difficulty; onComplete: (score: number, facts: string[]) => void }) {
  const cfg = {
    easy:   { budget: 15000, time: 120, bins: 10, crisisRate: 0.3, vehicleCost: 300,  binCost: 1000 },
    medium: { budget: 10000, time: 90,  bins: 15, crisisRate: 0.6, vehicleCost: 500,  binCost: 1500 },
    hard:   { budget: 6000,  time: 60,  bins: 20, crisisRate: 0.9, vehicleCost: 800,  binCost: 2500 },
  }[difficulty]

  const dispatch = useAppDispatch()
  const [budget, setBudget]     = useState(cfg.budget)
  const [timeLeft, setTimeLeft] = useState(cfg.time)
  const [co2Saved, setCo2Saved] = useState(0)
  const [collections, setCollections] = useState(0)
  const [crises, setCrises]     = useState<Crisis[]>([])
  const [facts]                 = useState<string[]>([
    'Delhi generates 11,000 tonnes of waste daily',
    'Only 30% of Delhi waste is currently recycled',
    'MCD operates 250+ waste collection vehicles',
    'Composting can reduce landfill load by 40%',
    'E-waste recycling recovers gold worth billions yearly',
  ])

  const WARD_BINS: WardBin[] = Array.from({ length: cfg.bins }, (_, i) => ({
    id:     `BIN-${i + 1}`,
    fill:   Math.floor(Math.random() * 80) + 20,
    ward:   ['Karol Bagh', 'Rohini', 'Dwarka', 'Saket', 'Connaught Place'][i % 5],
    status: 'ok' as const,
  }))

  const [bins, setBins] = useState<WardBin[]>(WARD_BINS)

  const CRISIS_POOL: Crisis[] = [
    { id: 'festival', msg: '🎉 Diwali festival — 3x waste surge!',      icon: '🎉', penalty: 500, duration: 15 },
    { id: 'rain',     msg: '🌧️ Monsoon — bins overflowing faster!',      icon: '🌧️', penalty: 300, duration: 10 },
    { id: 'strike',   msg: '🚧 Driver strike — vehicle shortage!',        icon: '🚧', penalty: 400, duration: 12 },
    { id: 'spill',    msg: '☣️ Chemical spill — area needs cleanup!',     icon: '☣️', penalty: 600, duration: 8  },
    { id: 'fire',     msg: '🔥 Landfill fire — emergency clearance!',    icon: '🔥', penalty: 700, duration: 10 },
  ]

  // Fill bins over time
  useEffect(() => {
    const t = setInterval(() => {
      setBins(prev => prev.map(b => ({
        ...b,
        fill:   Math.min(100, b.fill + Math.random() * 3),
        status: b.fill >= 85 ? 'critical' : b.fill >= 60 ? 'warning' : 'ok',
      })))
    }, 2000)
    return () => clearInterval(t)
  }, [])

  // Timer
  useEffect(() => {
    if (timeLeft <= 0) {
      const finalScore = Math.floor(co2Saved * 10 + collections * 50 + (budget / 100))
      dispatch(addEcoPoints(Math.floor(finalScore / 10)))
      onComplete(finalScore, facts)
      return
    }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, co2Saved, collections, budget])

  // Random crises
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < cfg.crisisRate / 10) {
        const crisis = CRISIS_POOL[Math.floor(Math.random() * CRISIS_POOL.length)]
        setCrises(prev => {
          if (prev.find(c => c.id === crisis.id)) return prev
          setBudget(b => Math.max(0, b - crisis.penalty))
          setTimeout(() => setCrises(p => p.filter(c => c.id !== crisis.id)), crisis.duration * 1000)
          return [...prev, crisis]
        })
      }
    }, 3000)
    return () => clearInterval(t)
  }, [])

  const dispatchVehicle = (binId: string) => {
    if (budget < cfg.vehicleCost) { toast.error('Insufficient budget!'); return }
    setBudget(b => b - cfg.vehicleCost)
    setBins(prev => prev.map(b =>
      b.id === binId ? { ...b, fill: Math.floor(Math.random() * 15) + 5, status: 'ok' } : b
    ))
    setCo2Saved(c => c + 2.5)
    setCollections(c => c + 1)
    dispatch(addEcoPoints(20))
    toast.success(`Vehicle dispatched! CO₂ saved +2.5kg`, { icon: '🚛' })
  }

  const addNewBin = () => {
    if (budget < cfg.binCost) { toast.error('Insufficient budget!'); return }
    setBudget(b => b - cfg.binCost)
    setBins(prev => [...prev, { id: `BIN-NEW-${Date.now()}`, fill: 0, ward: 'New Zone', status: 'ok' }])
    toast.success('New bin installed! Coverage improved', { icon: '🗑️' })
  }

  const timerPct   = (timeLeft / cfg.time) * 100
  const critBins   = bins.filter(b => b.status === 'critical').length
  const warnBins   = bins.filter(b => b.status === 'warning').length
  const currentScore = Math.floor(co2Saved * 10 + collections * 50 + (budget / 100))

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header HUD */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Budget',      value: `₹${budget.toLocaleString()}`, color: budget < 2000 ? 'text-rose-400' : 'text-cyber-teal' },
          { label: 'CO₂ Saved',   value: `${co2Saved.toFixed(1)} kg`,   color: 'text-emerald-400' },
          { label: 'Collections', value: String(collections),             color: 'text-amber-400' },
          { label: 'Score',       value: String(currentScore),            color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="cyber-card p-3 text-center">
            <p className="text-cyber-muted text-[9px] font-body uppercase tracking-wider">{s.label}</p>
            <p className={cn('font-display font-bold text-xl', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Timer */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full transition-all duration-1000', timeLeft <= 15 ? 'bg-rose-400 animate-pulse' : 'bg-cyber-teal')}
            style={{ width: `${timerPct}%` }}
          />
        </div>
        <span className={cn('font-display font-bold text-lg w-10 text-right', timeLeft <= 15 && 'text-rose-400 animate-pulse')}>{timeLeft}s</span>
      </div>

      {/* Crisis alerts */}
      <AnimatePresence>
        {crises.map(c => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl"
          >
            <span className="text-2xl flex-shrink-0">{c.icon}</span>
            <div className="flex-1">
              <p className="text-rose-300 text-sm font-body font-semibold">{c.msg}</p>
              <p className="text-rose-400/60 text-xs font-body">Budget impact: -₹{c.penalty}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Status bar */}
      <div className="flex items-center gap-4 text-xs font-body">
        <span className="text-rose-400">{critBins} critical bins</span>
        <span className="text-amber-400">{warnBins} warning bins</span>
        <span className="text-emerald-400">{bins.length - critBins - warnBins} healthy bins</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Bin grid */}
        <div className="cyber-card p-4">
          <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Bin Status — Click to dispatch vehicle</p>
          <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
            {bins.map(b => {
              const color = b.status === 'critical' ? '#f43f5e' : b.status === 'warning' ? '#f59e0b' : '#10b981'
              return (
                <motion.button
                  key={b.id}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => b.status !== 'ok' && dispatchVehicle(b.id)}
                  className={cn('p-2 rounded-lg border text-center transition-all', b.status !== 'ok' && 'cursor-pointer hover:brightness-110')}
                  style={{ borderColor: color + '40', background: color + '15' }}
                  title={`${b.id}: ${b.fill.toFixed(0)}% — ${b.ward}`}
                >
                  <div className="text-lg">🗑️</div>
                  <div className="text-[10px] font-body font-bold" style={{ color }}>{b.fill.toFixed(0)}%</div>
                  {b.status === 'critical' && <div className="text-[8px] text-rose-400 animate-pulse">!</div>}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="cyber-card p-4 space-y-3">
          <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">Management Actions</p>

          <button
            onClick={addNewBin}
            disabled={budget < cfg.binCost}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
              budget >= cfg.binCost
                ? 'bg-cyber-teal/8 border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal/15'
                : 'bg-white/3 border-white/10 text-cyber-muted cursor-not-allowed'
            )}
          >
            <span className="text-2xl">🗑️</span>
            <div>
              <p className="font-ui font-semibold text-sm">Install New Bin</p>
              <p className="text-[11px] font-body opacity-70">Cost: ₹{cfg.binCost.toLocaleString()} · Increases coverage</p>
            </div>
          </button>

          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <p className="font-ui font-semibold text-sm text-white mb-2">Quick Facts</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {facts.map((f, i) => (
                <p key={i} className="text-cyber-muted text-[11px] font-body flex gap-2">
                  <span className="text-cyber-teal flex-shrink-0">▸</span>{f}
                </p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-white/3 rounded-lg p-2">
              <p className="text-cyber-teal font-display font-bold text-lg">{critBins}</p>
              <p className="text-cyber-muted text-[10px] font-body">Critical</p>
            </div>
            <div className="bg-white/3 rounded-lg p-2">
              <p className="text-emerald-400 font-display font-bold text-lg">{collections}</p>
              <p className="text-cyber-muted text-[10px] font-body">Collected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GAME 4: RECYCLING FACTORY CONVEYOR
// ═══════════════════════════════════════════════════════════════

interface ConveyorItem { id: string; item: WasteItem; x: number; speed: number; caught: boolean; missed: boolean }

function RecyclingFactoryGame({ difficulty, onComplete }: { difficulty: Difficulty; onComplete: (score: number, facts: string[]) => void }) {
  const cfg = {
    easy:   { speed: 2.5, spawnRate: 2200, time: 60,  lives: 5 },
    medium: { speed: 4.0, spawnRate: 1600, time: 60,  lives: 3 },
    hard:   { speed: 6.0, spawnRate: 1100, time: 60,  lives: 2 },
  }[difficulty]

  const dispatch = useAppDispatch()
  const [score, setScore]         = useState(0)
  const [timeLeft, setTimeLeft]   = useState(cfg.time)
  const [lives, setLives]         = useState(cfg.lives)
  const [items, setItems]         = useState<ConveyorItem[]>([])
  const [combo, setCombo]         = useState(0)
  const [factsLearned, setFactsLearned] = useState<string[]>([])
  const [feedback, setFeedback]   = useState<{ id: string; correct: boolean; pts: number } | null>(null)
  const idRef = useRef(0)

  // Game timer
  useEffect(() => {
    if (timeLeft <= 0 || lives <= 0) {
      onComplete(score, factsLearned)
      return
    }
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft, lives, score])

  // Spawn items
  useEffect(() => {
    if (timeLeft <= 0 || lives <= 0) return
    const t = setInterval(() => {
      const item = ALL_WASTE_ITEMS[Math.floor(Math.random() * ALL_WASTE_ITEMS.length)]
      setItems(prev => [...prev, {
        id:     String(idRef.current++),
        item,
        x:      0,
        speed:  cfg.speed + Math.random() * 0.5,
        caught: false,
        missed: false,
      }])
    }, cfg.spawnRate)
    return () => clearInterval(t)
  }, [timeLeft, lives, cfg.spawnRate, cfg.speed])

  // Move items
  useEffect(() => {
    const t = setInterval(() => {
      setItems(prev => {
        const updated = prev.map(i => ({ ...i, x: i.x + i.speed }))
        const missed  = updated.filter(i => i.x >= 100 && !i.caught && !i.missed)
        if (missed.length > 0) {
          setLives(l => l - missed.length)
          setCombo(0)
        }
        return updated.filter(i => i.x < 105 && !i.caught)
      })
    }, 80)
    return () => clearInterval(t)
  }, [])

  const catchItem = (convItem: ConveyorItem, bin: WasteCategory) => {
    const correct = convItem.item.category === bin
    if (correct) {
      const pts = 10 + combo * 2
      setScore(s => s + pts)
      setCombo(c => c + 1)
      dispatch(addEcoPoints(pts))
      setFactsLearned(prev => [...new Set([...prev, convItem.item.fact])])
      setFeedback({ id: convItem.id, correct: true, pts })
    } else {
      setScore(s => Math.max(0, s - 3))
      setCombo(0)
      setLives(l => l - 1)
      setFeedback({ id: convItem.id, correct: false, pts: -3 })
    }
    setItems(prev => prev.map(i => i.id === convItem.id ? { ...i, caught: true } : i))
    setTimeout(() => setFeedback(null), 600)
  }

  const timerPct = (timeLeft / cfg.time) * 100

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* HUD */}
      <div className="flex items-center justify-between cyber-card p-3">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-cyber-muted text-[9px] font-body uppercase">Score</p>
            <p className="text-cyber-teal font-display font-bold text-2xl">{score}</p>
          </div>
          <div>
            <p className="text-cyber-muted text-[9px] font-body uppercase">Lives</p>
            <p className="text-rose-400 font-display font-bold text-2xl">{'❤️'.repeat(lives)}</p>
          </div>
          {combo > 1 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30">
              <span className="text-amber-400 font-display font-bold text-sm">🔥 {combo}x</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-cyber-teal rounded-full transition-all duration-1000" style={{ width: `${timerPct}%` }} />
          </div>
          <span className={cn('font-display font-bold text-lg', timeLeft <= 10 && 'text-rose-400')}>{timeLeft}s</span>
        </div>
      </div>

      {/* Conveyor belt */}
      <div className="cyber-card p-4">
        <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest mb-3">
          Conveyor Belt — Click an item then its correct bin below
        </p>
        <div className="relative h-20 bg-black/20 rounded-xl overflow-hidden border border-white/8">
          {/* Belt lines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: `${(i + 1) * 8.33}%` }} />
          ))}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10" />

          {/* Items on belt */}
          {items.filter(i => !i.caught).map(convItem => (
            <motion.button
              key={convItem.id}
              className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-pointer hover:scale-110 transition-transform"
              style={{ left: `${Math.min(convItem.x, 98)}%`, transform: 'translate(-50%, -50%)' }}
              onClick={() => {
                // Clicking opens bin selection — handled by clicking item then bin
              }}
              title={convItem.item.name}
            >
              <span className="text-2xl select-none">{convItem.item.emoji}</span>
              <span className="text-white text-[9px] font-body whitespace-nowrap bg-black/40 px-1 rounded">
                {convItem.item.name.split(' ')[0]}
              </span>
            </motion.button>
          ))}

          {/* Score feedback */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -30 }}
                exit={{ opacity: 0 }}
                className={cn('absolute top-2 right-4 font-display font-bold text-lg', feedback.correct ? 'text-emerald-400' : 'text-rose-400')}
              >
                {feedback.correct ? `+${feedback.pts}` : `${feedback.pts}`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bin targets */}
      <p className="text-cyber-muted text-[10px] font-body uppercase tracking-widest text-center">
        Click an item on the belt, then click its correct bin below
      </p>
      <div className="grid grid-cols-4 gap-3">
        {(['biodegradable', 'recyclable', 'hazardous', 'ewaste'] as WasteCategory[]).map(bin => {
          const bc = BIN_CONFIG[bin]
          return (
            <div
              key={bin}
              className={cn('p-4 rounded-xl border-2 text-center cursor-pointer transition-all duration-150 hover:scale-105', bc.bg, bc.border)}
              onClick={() => {
                // Sort the leftmost unhandled item into this bin
                const firstItem = items.filter(i => !i.caught).sort((a, b) => b.x - a.x)[0]
                if (firstItem) catchItem(firstItem, bin)
              }}
              style={{ borderColor: bc.color + '60' }}
            >
              <span className="text-3xl block mb-1">{bc.icon}</span>
              <p className="font-display font-bold text-xs" style={{ color: bc.color }}>
                {bc.label.toUpperCase()}
              </p>
              <p className="text-cyber-muted text-[9px] font-body mt-0.5">Click to sort</p>
            </div>
          )
        })}
      </div>

      <p className="text-cyber-muted text-xs font-body text-center">
        Items fall off the right edge and cost you a life. Sort the rightmost item first!
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DIFFICULTY SELECTOR
// ═══════════════════════════════════════════════════════════════

function DifficultySelector({ game, onSelect, onBack }: {
  game: { title: string; icon: string }
  onSelect: (d: Difficulty) => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-cyber-muted hover:text-white transition-colors text-sm font-body mb-6">
        ← Back to Game Hub
      </button>

      <div className="text-center mb-8">
        <div className="text-6xl mb-3">{game.icon}</div>
        <h2 className="font-display font-bold text-white text-3xl tracking-wider">{game.title}</h2>
        <p className="text-cyber-muted font-body mt-2">Select your difficulty level</p>
      </div>

      <div className="space-y-3">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d, i) => {
          const dc = DIFFICULTY_MAP[d]
          return (
            <motion.button
              key={d}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ x: 6 }}
              onClick={() => onSelect(d)}
              className={cn(
                'w-full flex items-center gap-5 p-5 rounded-xl border-2 transition-all text-left',
                'bg-white/3 hover:bg-white/6 border-white/10 hover:border-opacity-60'
              )}
              style={{ ['--hover-border' as string]: dc.color }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: dc.color + '20', border: `2px solid ${dc.color}40` }}
              >
                {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-xl tracking-wide" style={{ color: dc.color }}>
                  {dc.label}
                </p>
                <p className="text-cyber-muted text-sm font-body mt-0.5">{dc.description}</p>
              </div>
              <div className="text-cyber-muted text-sm font-body flex-shrink-0">
                {d === 'easy' ? '1x pts' : d === 'medium' ? '2x pts' : '3x pts'}
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GAME HUB
// ═══════════════════════════════════════════════════════════════

const GAMES = [
  {
    id: 'sorting' as GameId,
    title: 'Waste Sorting Challenge',
    icon: '🗑️',
    desc: 'Drag waste items into the correct bins before time runs out. More bins at higher levels.',
    tags: ['Drag & Drop', 'Timed', 'Combo Points'],
    color: '#10b981',
  },
  {
    id: 'quiz' as GameId,
    title: 'Speed Classification Quiz',
    icon: '⚡',
    desc: 'Race the clock. Classify waste items correctly. Build streaks for bonus points.',
    tags: ['Multiple Choice', 'Streak Bonus', 'Facts'],
    color: '#8b5cf6',
  },
  {
    id: 'ward' as GameId,
    title: 'Delhi Ward Manager',
    icon: '🏛️',
    desc: 'Manage a Delhi ward\'s waste system. Dispatch vehicles, install bins, handle crises with limited budget.',
    tags: ['Strategy', 'Budget', 'Real MCD Scenarios'],
    color: '#f59e0b',
    badge: '★ MCD Special',
  },
  {
    id: 'factory' as GameId,
    title: 'Recycling Factory',
    icon: '🏭',
    desc: 'Items fly past on a conveyor belt. Sort them into correct processing bins before they fall off!',
    tags: ['Fast-Paced', 'Reflex', 'Conveyor Belt'],
    color: '#f43f5e',
  },
]

// ═══════════════════════════════════════════════════════════════
// MAIN GAMES PAGE
// ═══════════════════════════════════════════════════════════════

export default function Games() {
  const [screen, setScreen]         = useState<Screen>('hub')
  const [selectedGame, setSelectedGame] = useState<GameId>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [finalScore, setFinalScore] = useState(0)
  const [finalFacts, setFinalFacts] = useState<string[]>([])

  const handleSelectGame = (id: GameId) => { setSelectedGame(id); setScreen('difficulty') }
  const handleSelectDifficulty = (d: Difficulty) => { setDifficulty(d); setScreen('playing') }
  const handleComplete = (score: number, facts: string[]) => { setFinalScore(score); setFinalFacts(facts); setScreen('result') }
  const handleReplay = () => setScreen('playing')
  const handleBack  = () => { setScreen('hub'); setSelectedGame(null) }

  const currentGame = GAMES.find(g => g.id === selectedGame)

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Eco Games"
        subtitle={screen === 'hub' ? 'Learn waste management through interactive play' : currentGame?.title || ''}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">

          {/* HUB */}
          {screen === 'hub' && (
            <motion.div key="hub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {GAMES.map((g, i) => (
                    <motion.button
                      key={g.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileHover={{ y: -4 }}
                      onClick={() => handleSelectGame(g.id)}
                      className="cyber-card p-6 text-left group cursor-pointer"
                      style={{ borderColor: g.color + '25' }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform"
                          style={{ background: g.color + '15', border: `2px solid ${g.color}30` }}
                        >
                          {g.icon}
                        </div>
                        {g.badge && (
                          <span
                            className="text-[10px] font-body font-bold px-2 py-1 rounded"
                            style={{ background: g.color + '20', color: g.color, border: `1px solid ${g.color}40` }}
                          >
                            {g.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-white text-xl tracking-wide mb-2">{g.title}</h3>
                      <p className="text-cyber-muted text-sm font-body leading-relaxed mb-4">{g.desc}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {g.tags.map(t => (
                          <span key={t} className="text-[10px] font-body px-2 py-0.5 rounded"
                            style={{ background: g.color + '12', color: g.color, border: `1px solid ${g.color}25` }}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                            <div key={d} className="w-2 h-2 rounded-full" style={{ background: DIFFICULTY_MAP[d].color }} />
                          ))}
                          <span className="text-cyber-muted text-[10px] font-body ml-1">3 difficulty levels</span>
                        </div>
                        <span className="font-display font-semibold text-sm group-hover:translate-x-1 transition-transform inline-block" style={{ color: g.color }}>
                          Play →
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Quick guide */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="cyber-card p-5">
                  <h3 className="font-display font-semibold text-white tracking-wide mb-3 text-lg">
                    Delhi Waste Classification Guide
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(Object.entries(BIN_CONFIG) as [WasteCategory, typeof BIN_CONFIG[WasteCategory]][]).map(([key, cfg]) => (
                      <div key={key} className={cn('p-3 rounded-xl border', cfg.bg, cfg.border)}>
                        <p className="font-display font-bold text-sm mb-1" style={{ color: cfg.color }}>
                          {cfg.icon} {cfg.label}
                        </p>
                        <p className="text-cyber-muted text-[11px] font-body">
                          {key === 'biodegradable' && 'Food waste, plant matter, paper towels, cooked food'}
                          {key === 'recyclable'    && 'Clean plastic, glass, metal, dry paper, cardboard'}
                          {key === 'hazardous'     && 'Batteries, chemicals, paint, pesticides, aerosols'}
                          {key === 'ewaste'        && 'Phones, laptops, cables, bulbs, circuit boards'}
                          {key === 'medical'       && 'Syringes, medicines, bandages, clinical waste'}
                          {key === 'general'       && 'Contaminated items that cannot be recycled'}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* DIFFICULTY SELECT */}
          {screen === 'difficulty' && currentGame && (
            <motion.div key="difficulty" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <DifficultySelector game={currentGame} onSelect={handleSelectDifficulty} onBack={handleBack} />
            </motion.div>
          )}

          {/* PLAYING */}
          {screen === 'playing' && (
            <motion.div key="playing" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="text-cyber-muted hover:text-white transition-colors text-sm font-body">← Hub</button>
                    <span className="text-cyber-muted">/</span>
                    <span className="text-white text-sm font-body">{currentGame?.title}</span>
                    <span
                      className="text-[10px] font-body font-bold px-2 py-0.5 rounded"
                      style={{ background: DIFFICULTY_MAP[difficulty].color + '20', color: DIFFICULTY_MAP[difficulty].color }}
                    >
                      {DIFFICULTY_MAP[difficulty].label.toUpperCase()}
                    </span>
                  </div>
                </div>

                {selectedGame === 'sorting' && (
                  <WasteSortingGame key={`sorting-${difficulty}`} difficulty={difficulty} onComplete={handleComplete} />
                )}
                {selectedGame === 'quiz' && (
                  <SpeedQuizGame key={`quiz-${difficulty}`} difficulty={difficulty} onComplete={handleComplete} />
                )}
                {selectedGame === 'ward' && (
                  <WardManagerGame key={`ward-${difficulty}`} difficulty={difficulty} onComplete={handleComplete} />
                )}
                {selectedGame === 'factory' && (
                  <RecyclingFactoryGame key={`factory-${difficulty}`} difficulty={difficulty} onComplete={handleComplete} />
                )}
              </div>
            </motion.div>
          )}

          {/* RESULT */}
          {screen === 'result' && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <ResultScreen
                score={finalScore}
                maxScore={selectedGame === 'sorting' ? 400 : selectedGame === 'quiz' ? 300 : selectedGame === 'ward' ? 2000 : 500}
                gameName={currentGame?.title || ''}
                difficulty={difficulty}
                facts={finalFacts}
                onReplay={handleReplay}
                onBack={handleBack}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
