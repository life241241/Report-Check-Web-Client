import { useState, useRef, useCallback, useId } from 'react'
import {
  Search, CheckCircle2, XCircle, AlertTriangle, ChevronDown,
  RotateCcw, Car, CreditCard, Loader2, Shield, Zap, MapPin, Building2,
  Sparkles, Calendar, Fuel, Palette, Gauge, Info, ChevronLeft, ChevronRight, ChevronUp
} from 'lucide-react'
import { checkFines, fetchVehicleInfo, type CheckResponse, type MunicipalityResult, type VehicleInfo } from './api.ts'

const TOTAL_MUNIS = 22

/* ═══════════════════════════════════════════════════════════
   Reusable Components
   ═══════════════════════════════════════════════════════════ */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
          <Car size={16} className="text-white" />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--ok)] rounded-full border-2 border-[var(--bg)]" />
      </div>
      <div>
        <div className="font-bold text-[var(--ink)] text-sm leading-tight tracking-tight">ReportCheck</div>
        <div className="text-[10px] text-[var(--muted)] leading-tight">בדיקת דוחות חנייה ארצית</div>
      </div>
    </div>
  )
}

function StatusBadge({ status, count }: { status: string; count?: number }) {
  const config = {
    clean: {
      bg: 'bg-[var(--ok-bg)] border-[var(--ok-border)]',
      text: 'text-[var(--ok)]',
      icon: <CheckCircle2 size={12} />,
      label: 'ללא דוחות',
    },
    fine: {
      bg: 'bg-[var(--danger-bg)] border-[var(--danger-border)]',
      text: 'text-[var(--danger)]',
      icon: <AlertTriangle size={12} />,
      label: `${count} ${(count ?? 0) > 1 ? 'דוחות פתוחים' : 'דוח פתוח'}`,
    },
    failed: {
      bg: 'bg-[var(--warn-bg)] border-[var(--warn-border)]',
      text: 'text-[var(--warn)]',
      icon: <XCircle size={12} />,
      label: 'לא זמין',
    },
  }[status] ?? { bg: '', text: '', icon: null, label: '' }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.bg} ${config.text}`}>
      {config.icon} {config.label}
    </span>
  )
}

/* ─── Progress ─── */

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">
          סורק כעת: <span className="text-[var(--ink)] font-medium">{label}</span>
        </span>
        <span className="font-bold text-[var(--accent-light)] tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out shimmer-bar"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent), #8b5cf6, var(--accent))',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1"><Zap size={10} className="text-[var(--accent-light)]" /> סורק במקביל</span>
        <span>מתוך {TOTAL_MUNIS} רשויות</span>
      </div>
    </div>
  )
}

/* ─── Result Card ─── */

function ResultCard({ r, delay }: { r: MunicipalityResult; delay: number }) {
  const [open, setOpen] = useState(false)
  const hasFines = r.status === 'fine' && r.fines && r.fines.length > 0

  return (
    <div
      className="glass rounded-2xl overflow-hidden animate-swing-in group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3.5 ${hasFines ? 'cursor-pointer' : ''} transition-colors duration-200 hover:bg-[var(--surface-hover)]`}
        onClick={() => hasFines && setOpen(v => !v)}
      >
        <StatusBadge status={r.status} count={r.count} />

        <span className="flex-1 text-sm text-[var(--ink)] font-medium truncate">{r.name}</span>

        {r.status === 'fine' && r.amount && (
          <span className="font-bold text-sm text-[var(--danger)] flex-shrink-0 tabular-nums">
            ₪{r.amount}
          </span>
        )}

        {r.status === 'failed' && r.error && (
          <span className="text-[11px] text-[var(--muted)] truncate max-w-[140px] flex-shrink-0">{r.error}</span>
        )}

        {hasFines && (
          <span className="text-[var(--muted)] flex-shrink-0 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
            <ChevronDown size={14} />
          </span>
        )}
      </div>

      {open && hasFines && (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 space-y-2 animate-fade-in">
          {r.fines!.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-[var(--border)] last:border-0">
              {f.number && (
                <span className="font-mono bg-[var(--surface)] text-[var(--muted)] px-2 py-0.5 rounded-md text-[11px] border border-[var(--border)]">
                  #{f.number}
                </span>
              )}
              {f.date && <span className="text-[var(--ink-secondary)]">{f.date}</span>}
              {f.time && <span className="text-[var(--muted)]">{f.time}</span>}
              {(f.price_display || f.amount) && (
                <span className="font-semibold text-[var(--danger)] mr-auto">
                  {f.price_display ?? `₪${f.amount}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Summary ─── */

function Summary({ s }: { s: CheckResponse['summary'] }) {
  const items = [
    { label: 'תקין', value: s.clean, color: 'var(--ok)', bg: 'var(--ok-bg)', border: 'var(--ok-border)', icon: <CheckCircle2 size={18} /> },
    { label: 'נמצאו דוחות', value: s.fine, color: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)', icon: <AlertTriangle size={18} /> },
    { label: 'לא זמין', value: s.failed, color: 'var(--warn)', bg: 'var(--warn-bg)', border: 'var(--warn-border)', icon: <XCircle size={18} /> },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, value, color, bg, border, icon }, i) => (
        <div
          key={label}
          className={`glass rounded-2xl text-center py-5 px-2 ${i === 0 ? 'animate-slide-right' : i === 1 ? 'animate-swing-in' : 'animate-slide-left'}`}
          style={{ borderColor: border, background: bg, animationDelay: `${i * 120}ms` }}
        >
          <div className="flex justify-center mb-2" style={{ color }}>{icon}</div>
          <div className="font-black text-3xl tabular-nums" style={{ color }}>{value}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1 font-medium">{label}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Vehicle Info Card — Horizontal Swipe Carousel ─── */

function VehicleCard({ v }: { v: VehicleInfo }) {
  const [page, setPage] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const testExpired = v.test_expiry ? new Date(v.test_expiry) < new Date() : false
  const totalPages = 3

  const goTo = (p: number) => {
    const next = Math.max(0, Math.min(p, totalPages - 1))
    setPage(next)
    scrollRef.current?.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setPage(idx)
  }

  return (
    <div className="glass-strong rounded-2xl overflow-hidden animate-swing-in">
      {/* Header with arrows */}
      <div className="px-5 py-3.5 flex items-center gap-3 border-b border-[var(--border)]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center shadow-lg shadow-[var(--accent-glow)] animate-float-x">
          <Car size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-[var(--ink)] text-sm">פרטי הרכב</div>
          <div className="text-[11px] text-[var(--muted)]">
            {v.manufacturer} {v.model} {v.year ? `(${v.year})` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => goTo(page + 1)} className="w-7 h-7 rounded-lg glass flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => goTo(page - 1)} className="w-7 h-7 rounded-lg glass flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Swipeable pages */}
      <div ref={scrollRef} onScroll={handleScroll} className="scroll-x">

        {/* Page 1: Main info */}
        <div className="w-full min-w-full px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-[var(--accent-light)]">מידע כללי</span>
            <div className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-lg border mr-auto ${
              testExpired
                ? 'bg-[var(--danger-bg)] border-[var(--danger-border)] text-[var(--danger)]'
                : 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok)]'
            }`}>
              {testExpired ? 'טסט פג תוקף' : 'טסט בתוקף'}
            </div>
          </div>
          {([
            { icon: <Car size={14} />, label: 'יצרן ודגם', value: [v.manufacturer, v.model].filter(Boolean).join(' — ') },
            { icon: <Calendar size={14} />, label: 'שנת ייצור', value: v.year?.toString() },
            { icon: <Palette size={14} />, label: 'צבע', value: v.color },
            { icon: <Fuel size={14} />, label: 'סוג דלק', value: v.fuel },
            { icon: <Info size={14} />, label: 'בעלות', value: v.ownership },
          ] as const).filter(d => d.value).map((d, i) => (
            <div key={i} className="flex items-center gap-3 text-sm animate-slide-right" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="text-[var(--accent-light)]">{d.icon}</span>
              <span className="text-[var(--muted)] min-w-[80px]">{d.label}</span>
              <span className="text-[var(--ink)] font-medium">{d.value}</span>
            </div>
          ))}
        </div>

        {/* Page 2: Test & dates */}
        <div className="w-full min-w-full px-5 py-4 space-y-3">
          <span className="text-xs font-semibold text-[var(--accent-light)]">טסט ותאריכים</span>
          {([
            { icon: <Gauge size={14} />, label: 'טסט אחרון', value: v.last_test, color: 'text-[var(--ink)]' },
            { icon: <Calendar size={14} />, label: 'תוקף עד', value: v.test_expiry, color: testExpired ? 'text-[var(--danger)]' : 'text-[var(--ok)]' },
            { icon: <MapPin size={14} />, label: 'עלייה לכביש', value: v.on_road_since, color: 'text-[var(--ink)]' },
          ] as const).filter(d => d.value).map((d, i) => (
            <div key={i} className="flex items-center gap-3 text-sm animate-slide-left" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="text-[var(--accent-light)]">{d.icon}</span>
              <span className="text-[var(--muted)] min-w-[80px]">{d.label}</span>
              <span className={`font-medium ${d.color}`}>{d.value}</span>
            </div>
          ))}
          {testExpired && (
            <div className="mt-3 flex items-center gap-2 text-xs bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] px-3 py-2 rounded-xl animate-bounce-x">
              <AlertTriangle size={13} /> הטסט פג תוקף — יש לחדש בהקדם
            </div>
          )}
        </div>

        {/* Page 3: Technical */}
        <div className="w-full min-w-full px-5 py-4 space-y-3">
          <span className="text-xs font-semibold text-[var(--accent-light)]">פרטים טכניים</span>
          {([
            { label: 'קוד דגם', value: v.model_code },
            { label: 'רמת גימור', value: v.trim },
            { label: 'מנוע', value: v.engine },
            { label: 'צמיג קדמי', value: v.front_tire },
            { label: 'צמיג אחורי', value: v.rear_tire },
            { label: 'מס׳ שלדה', value: v.chassis },
          ] as const).filter(d => d.value).map((d, i) => (
            <div key={i} className="flex items-center gap-3 text-xs animate-slide-right" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="text-[var(--muted)] min-w-[80px]">{d.label}</span>
              <span className="text-[var(--ink-secondary)] font-mono text-[11px]">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex items-center justify-center gap-2 py-3 border-t border-[var(--border)]">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              page === i
                ? 'w-6 bg-[var(--accent)]'
                : 'w-1.5 bg-[var(--border-light)] hover:bg-[var(--muted)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Filters ─── */

type FilterKey = 'all' | 'fine' | 'clean' | 'failed'

function Filters({
  active, onChange, summary, total,
}: {
  active: FilterKey
  onChange: (k: FilterKey) => void
  summary: CheckResponse['summary']
  total: number
}) {
  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'כל הרשויות', count: total },
    { key: 'fine', label: 'עם דוחות', count: summary.fine },
    { key: 'clean', label: 'תקין', count: summary.clean },
    { key: 'failed', label: 'לא זמין', count: summary.failed },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t, i) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border animate-slide-left
            ${active === t.key
              ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent-glow)]'
              : 'glass text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--border-light)]'
            }`}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {t.label}
          <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
            active === t.key ? 'bg-white/20' : 'bg-[var(--surface)]'
          }`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
  )
}

/* ─── Input Field ─── */

function InputField({
  id, label, icon, value, onChange, placeholder, maxLength, disabled,
}: {
  id: string
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder: string
  maxLength: number
  disabled: boolean
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-[var(--ink-secondary)]">
        <span className="text-[var(--accent-light)]">{icon}</span>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5
                   font-mono text-lg tracking-[0.18em] text-center text-[var(--ink)]
                   placeholder:text-[var(--muted)]/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-base
                   focus:outline-none input-glow
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Main App
   ═══════════════════════════════════════════════════════════ */

export default function App() {
  const [idNum, setIdNum] = useState('')
  const [carNum, setCarNum] = useState('')
  const [loading, setLoading] = useState(false)
  const [pct, setPct] = useState(0)
  const [muniLabel, setMuniLabel] = useState('')
  const [response, setResponse] = useState<CheckResponse | null>(null)
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null)
  const [apiError, setApiError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idId = useId()
  const carId = useId()

  const PREVIEW_MUNIS = [
    'עיריית רמת גן', 'עיריית הרצליה', 'עיריית ערד', 'מועצה מקומית שוהם',
    'עיריית בית שמש', 'רשות שדות התעופה', 'עיריית גבעתיים', 'מ.א עמק יזרעאל',
    'עיריית שדרות', 'מועצה אזורית גוש עציון',
  ]

  const startProgress = useCallback(() => {
    setPct(0)
    let p = 0; let i = 0
    timerRef.current = setInterval(() => {
      p = Math.min(p + Math.random() * 5 + 2, 91)
      setPct(p)
      setMuniLabel(PREVIEW_MUNIS[i % PREVIEW_MUNIS.length])
      i++
    }, 650)
  }, [])

  const stopProgress = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idNum.trim() || !carNum.trim()) return
    setLoading(true)
    setApiError('')
    setResponse(null)
    setVehicleInfo(null)
    setFilter('all')
    startProgress()
    // Fetch vehicle info immediately (fast, public API)
    fetchVehicleInfo(carNum)
      .then(v => setVehicleInfo(v))
      .catch(() => {})

    try {
      const data = await checkFines(idNum, carNum)
      stopProgress()
      setPct(100)
      setTimeout(() => { setResponse(data); setLoading(false) }, 400)
    } catch (err: unknown) {
      stopProgress()
      setApiError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
      setLoading(false)
      setPct(0)
    }
  }

  const handleReset = () => {
    setResponse(null); setVehicleInfo(null); setIdNum(''); setCarNum('')
    setPct(0); setFilter('all'); setApiError('')
  }

  const filtered = response?.results.filter(r => filter === 'all' || r.status === filter) ?? []

  return (
    <div className="min-h-svh flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass-strong border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] bg-[var(--ok-bg)] px-3 py-1.5 rounded-full border border-[var(--ok-border)]">
            <Shield size={11} className="text-[var(--ok)]" />
            <span className="text-[var(--ok)]">מוצפן ומאובטח</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-8 space-y-7">

        {/* Hero */}
        {!response && !loading && (
          <section className="text-center space-y-5 pt-4 animate-slide-right">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center shadow-2xl shadow-[var(--accent-glow)] animate-float">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>

            <div className="animate-slide-left" style={{ animationDelay: '100ms' }}>
              <h1 className="font-black text-4xl leading-[1.15] text-[var(--ink)] tracking-tight">
                יש לך דוחות
                <span className="block bg-gradient-to-l from-[var(--accent-light)] to-purple-400 bg-clip-text text-transparent">
                  חנייה פתוחים?
                </span>
              </h1>
              <p className="text-[var(--muted)] text-sm mt-3 max-w-sm mx-auto leading-relaxed">
                בדוק ברגע אחד מול {TOTAL_MUNIS} רשויות מקומיות בישראל.<br />
                הסריקה מתבצעת במקביל — ותקבל תשובה תוך שניות ספורות.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-xs text-[var(--muted)] pt-1 flex-wrap">
              {([
                [<MapPin size={12} />, `${TOTAL_MUNIS} רשויות`],
                [<Zap size={12} />, 'תוצאות מיידיות'],
                [<Building2 size={12} />, 'ישירות מהעיריות'],
                [<Shield size={12} />, 'ללא רישום'],
              ] as const).map(([icon, text], i) => (
                <span key={i} className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] px-3 py-1.5 rounded-full animate-bounce-x" style={{ animationDelay: `${200 + i * 100}ms` }}>
                  <span className="text-[var(--accent-light)]">{icon}</span> {text}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Form */}
        {!response && (
          <section className="glass-strong rounded-3xl p-6 space-y-5 animate-slide-left" style={{ animationDelay: '100ms' }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputField
                id={idId} label="מספר תעודת זהות" icon={<CreditCard size={15} />}
                value={idNum} onChange={setIdNum}
                placeholder="הזן 9 ספרות" maxLength={9} disabled={loading}
              />
              <InputField
                id={carId} label="מספר רכב" icon={<Car size={15} />}
                value={carNum} onChange={setCarNum}
                placeholder="הזן מספר רכב" maxLength={8} disabled={loading}
              />

              {apiError && (
                <div className="flex items-center gap-2.5 text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl px-4 py-3.5 animate-fade-in">
                  <XCircle size={15} className="flex-shrink-0" />
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !idNum.trim() || !carNum.trim()}
                className="btn-gradient w-full flex items-center justify-center gap-2.5
                           text-white font-bold text-base
                           px-6 py-4 rounded-xl
                           shadow-lg shadow-[var(--accent-glow)]"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  {loading
                    ? <><Loader2 size={17} className="animate-spin-slow" /> הסריקה מתבצעת...</>
                    : <><Search size={17} /> התחל בדיקה</>
                  }
                </span>
              </button>
            </form>

            {loading && (
              <div className="pt-5 border-t border-[var(--border)] animate-fade-in">
                <ProgressBar pct={pct} label={muniLabel} />
              </div>
            )}
          </section>
        )}

        {/* Vehicle info card — shows immediately, even during loading */}
        {vehicleInfo && <VehicleCard v={vehicleInfo} />}

        {/* Results */}
        {response && (
          <div className="space-y-5 animate-slide-right">

            <Summary s={response.summary} />

            {response.summary.fine > 0 ? (
              <div className="flex items-start gap-3 bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl px-5 py-4 animate-bounce-x">
                <div className="w-8 h-8 rounded-lg bg-[var(--danger-border)] flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-[var(--danger)]" />
                </div>
                <div>
                  <div className="font-bold text-[var(--danger)] text-sm">שים לב — נמצאו דוחות פתוחים!</div>
                  <div className="text-xs text-[var(--danger)]/60 mt-0.5">
                    ב-{response.summary.fine} {response.summary.fine === 1 ? 'רשות' : 'רשויות'} נמצאו דוחות. לחץ על כל שורה כדי לראות פירוט מלא.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-[var(--ok-bg)] border border-[var(--ok-border)] rounded-2xl px-5 py-4 animate-bounce-x">
                <div className="w-8 h-8 rounded-lg bg-[var(--ok-border)] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-[var(--ok)]" />
                </div>
                <div className="font-bold text-[var(--ok)] text-sm">הכל תקין — לא נמצאו דוחות פתוחים</div>
              </div>
            )}

            <Filters
              active={filter}
              onChange={setFilter}
              summary={response.summary}
              total={response.results.length}
            />

            <div className="space-y-2.5">
              {filtered.map((r, i) => (
                <ResultCard key={r.name} r={r} delay={i * 40} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-[var(--muted)] text-sm animate-fade-in glass rounded-2xl">
                  לא נמצאו תוצאות בסינון הנוכחי
                </div>
              )}
            </div>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2.5 py-3.5
                         text-sm text-[var(--accent-light)] hover:text-white
                         glass hover:bg-[var(--accent)]/20
                         rounded-xl transition-all duration-200 group animate-slide-left"
              style={{ animationDelay: '300ms' }}
            >
              <RotateCcw size={14} className="transition-transform group-hover:rotate-[-45deg]" />
              בצע בדיקה חדשה
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-[var(--muted)]/40 py-8 space-y-1.5 border-t border-[var(--border)] mt-4 animate-slide-right" style={{ animationDelay: '200ms' }}>
        <div>הנתונים מתקבלים ישירות ממערכות הרשויות המקומיות</div>
        <div>המערכת אינה שומרת פרטים אישיים — הכל נמחק מיד לאחר הבדיקה</div>
        <div className="pt-1 text-[var(--muted)]/25">© {new Date().getFullYear()} ReportCheck</div>
      </footer>
    </div>
  )
}
