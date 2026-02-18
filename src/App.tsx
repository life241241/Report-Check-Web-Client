import { useState, useRef, useCallback, useId } from 'react'
import {
  Search, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  RotateCcw, Car, CreditCard, Loader2, Shield, Zap, MapPin, Building2
} from 'lucide-react'
import { checkFines, type CheckResponse, type MunicipalityResult } from './api.ts'

const TOTAL_MUNIS = 22

// ─── Small reusable pieces ───────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-accent rounded-xl rotate-3 opacity-20" />
        <div className="relative w-8 h-8 bg-accent rounded-xl flex items-center justify-center shadow-sm">
          <Car size={15} className="text-white" />
        </div>
      </div>
      <div>
        <div className="font-display font-bold text-ink text-sm leading-tight">דוחות חנייה</div>
        <div className="text-[10px] text-muted leading-tight">בדיקה מרכזית</div>
      </div>
    </div>
  )
}

function Pill({ children, variant = 'default' }: {
  children: React.ReactNode
  variant?: 'default' | 'ok' | 'danger' | 'warn'
}) {
  const cls = {
    default: 'bg-border/60 text-muted',
    ok:      'bg-ok-bg text-ok border border-ok-border',
    danger:  'bg-danger-bg text-danger border border-danger-border',
    warn:    'bg-warn-bg text-warn border border-warn-border',
  }[variant]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {children}
    </span>
  )
}

// ─── Progress bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          בודק: <span className="text-ink font-medium">{label}</span>
        </span>
        <span className="font-display font-bold text-accent tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-l from-accent to-accent-2 rounded-full transition-all duration-500 ease-out shimmer-bar"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted/60">
        <span>סריקה מקבילית</span>
        <span>{TOTAL_MUNIS} רשויות</span>
      </div>
    </div>
  )
}

// ─── Result card ─────────────────────────────────────────────────────────────

function ResultCard({ r, delay }: { r: MunicipalityResult; delay: number }) {
  const [open, setOpen] = useState(false)
  const hasFines = r.status === 'fine' && r.fines && r.fines.length > 0

  const statusEl = {
    clean: (
      <Pill variant="ok">
        <CheckCircle2 size={11} /> נקי
      </Pill>
    ),
    fine: (
      <Pill variant="danger">
        <AlertTriangle size={11} /> {r.count} {(r.count ?? 0) > 1 ? 'דוחות' : 'דוח'}
      </Pill>
    ),
    failed: (
      <Pill variant="warn">
        <XCircle size={11} /> שגיאה
      </Pill>
    ),
  }[r.status]

  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden shadow-card animate-fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 ${hasFines ? 'cursor-pointer hover:bg-surface-2' : ''} transition-colors`}
        onClick={() => hasFines && setOpen(v => !v)}
      >
        {statusEl}

        <span className="flex-1 text-sm text-ink font-medium truncate">{r.name}</span>

        {r.status === 'fine' && r.amount && (
          <span className="font-display font-bold text-sm text-danger flex-shrink-0 tabular-nums">
            ₪{r.amount}
          </span>
        )}

        {r.status === 'failed' && r.error && (
          <span className="text-[11px] text-muted truncate max-w-[140px] flex-shrink-0">{r.error}</span>
        )}

        {hasFines && (
          <span className="text-muted flex-shrink-0">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {open && hasFines && (
        <div className="border-t border-border bg-surface-2 px-4 py-2.5 space-y-1.5 animate-fade-in">
          {r.fines!.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-border/50 last:border-0">
              {f.number && (
                <span className="font-mono bg-border/50 text-muted px-1.5 py-0.5 rounded text-[11px]">#{f.number}</span>
              )}
              {f.date && <span className="text-ink">{f.date}</span>}
              {f.time && <span className="text-muted">{f.time}</span>}
              {(f.price_display || f.amount) && (
                <span className="font-display font-semibold text-danger mr-auto">
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

// ─── Summary strip ────────────────────────────────────────────────────────────

function Summary({ s }: { s: CheckResponse['summary'] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {([
        { label: 'נקיים', value: s.clean,  color: 'text-ok',     bg: 'bg-ok-bg border-ok-border' },
        { label: 'דוחות', value: s.fine,   color: 'text-danger', bg: 'bg-danger-bg border-danger-border' },
        { label: 'שגיאות',value: s.failed, color: 'text-warn',   bg: 'bg-warn-bg border-warn-border' },
      ] as const).map(({ label, value, color, bg }) => (
        <div key={label} className={`rounded-2xl border ${bg} text-center py-4 shadow-card`}>
          <div className={`font-display font-black text-2xl ${color} tabular-nums`}>{value}</div>
          <div className="text-[11px] text-muted mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

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
    { key: 'all',    label: 'הכל',    count: total },
    { key: 'fine',   label: 'דוחות',  count: summary.fine },
    { key: 'clean',  label: 'נקיים',  count: summary.clean },
    { key: 'failed', label: 'שגיאות', count: summary.failed },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border
            ${active === t.key
              ? 'bg-ink text-white border-ink shadow-sm'
              : 'bg-surface text-muted border-border hover:border-ink/20 hover:text-ink'
            }`}
        >
          {t.label}
          <span className={`text-[10px] tabular-nums ${active === t.key ? 'opacity-60' : 'opacity-50'}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────

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
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <span className="text-accent">{icon}</span>
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
        className="w-full bg-surface border border-border rounded-xl px-4 py-3.5
                   font-mono text-lg tracking-[0.18em] text-center text-ink
                   placeholder:text-muted/40 placeholder:font-sans placeholder:tracking-normal placeholder:text-base
                   focus:outline-none focus:border-accent focus:shadow-focus
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all duration-150"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [idNum, setIdNum]     = useState('')
  const [carNum, setCarNum]   = useState('')
  const [loading, setLoading] = useState(false)
  const [pct, setPct]         = useState(0)
  const [muniLabel, setMuniLabel] = useState('')
  const [response, setResponse]   = useState<CheckResponse | null>(null)
  const [apiError, setApiError]   = useState('')
  const [filter, setFilter]       = useState<FilterKey>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idId  = useId()
  const carId = useId()

  const PREVIEW_MUNIS = [
    'עיריית רמת גן','עיריית הרצליה','עיריית ערד','מועצה מקומית שוהם',
    'עיריית בית שמש','רשות שדות התעופה','עיריית גבעתיים','מ.א עמק יזרעאל',
    'עיריית שדרות','מועצה אזורית גוש עציון',
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
    setFilter('all')
    startProgress()
    try {
      const data = await checkFines(idNum, carNum)
      stopProgress()
      setPct(100)
      setTimeout(() => { setResponse(data); setLoading(false) }, 350)
    } catch (err: unknown) {
      stopProgress()
      setApiError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
      setLoading(false)
      setPct(0)
    }
  }

  const handleReset = () => {
    setResponse(null); setIdNum(''); setCarNum('')
    setPct(0); setFilter('all'); setApiError('')
  }

  const filtered = response?.results.filter(r => filter === 'all' || r.status === filter) ?? []

  return (
    <div className="min-h-svh flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Shield size={11} className="text-ok" />
            <span>ללא שמירת מידע</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 space-y-6">

        {/* Hero — shown only before results */}
        {!response && !loading && (
          <section className="text-center space-y-3 pt-2 animate-fade-up">
            <h1 className="font-display font-black text-[2.6rem] leading-[1.1] text-ink">
              בדיקת דוחות<br />
              <span className="text-accent">חנייה</span> מרכזית
            </h1>
            <p className="text-muted text-sm">
              סריקה מקבילית של {TOTAL_MUNIS} רשויות מקומיות בישראל
            </p>
            <div className="flex items-center justify-center gap-5 text-xs text-muted pt-1">
              {([
                [<MapPin size={11} />,     `${TOTAL_MUNIS} רשויות`],
                [<Zap size={11} />,        'בדיקה מהירה'],
                [<Building2 size={11} />,  'ישיר מהמקור'],
              ] as const).map(([icon, text], i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-accent">{icon}</span> {text}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Form */}
        {!response && (
          <section className="bg-surface border border-border rounded-2xl shadow-card-md p-6 space-y-5 animate-fade-up">
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputField
                id={idId} label="תעודת זהות" icon={<CreditCard size={14} />}
                value={idNum} onChange={setIdNum}
                placeholder="000000000" maxLength={9} disabled={loading}
              />
              <InputField
                id={carId} label="מספר רכב" icon={<Car size={14} />}
                value={carNum} onChange={setCarNum}
                placeholder="00000000" maxLength={8} disabled={loading}
              />

              {apiError && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger-bg border border-danger-border rounded-xl px-4 py-3 animate-fade-in">
                  <XCircle size={14} className="flex-shrink-0" />
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !idNum.trim() || !carNum.trim()}
                className="w-full flex items-center justify-center gap-2
                           bg-accent hover:bg-accent-2 active:scale-[0.98]
                           text-white font-display font-semibold text-base
                           px-6 py-3.5 rounded-xl
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
                           transition-all duration-150 shadow-sm"
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin-slow" /> סורק רשויות...</>
                  : <><Search size={16} /> בדוק דוחות</>
                }
              </button>
            </form>

            {loading && (
              <div className="pt-4 border-t border-border animate-fade-in">
                <ProgressBar pct={pct} label={muniLabel} />
              </div>
            )}
          </section>
        )}

        {/* Results */}
        {response && (
          <div className="space-y-4 animate-fade-in">

            {/* Summary tiles */}
            <Summary s={response.summary} />

            {/* Fines alert */}
            {response.summary.fine > 0 && (
              <div className="flex items-start gap-3 bg-danger-bg border border-danger-border rounded-2xl px-4 py-3.5 animate-fade-up">
                <AlertTriangle size={17} className="text-danger flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-display font-semibold text-danger text-sm">נמצאו דוחות פתוחים</div>
                  <div className="text-xs text-danger/70 mt-0.5">
                    {response.summary.fine} {response.summary.fine === 1 ? 'רשות' : 'רשויות'} עם דוחות — לחץ על שורה לפרטים
                  </div>
                </div>
              </div>
            )}

            {response.summary.fine === 0 && (
              <div className="flex items-center gap-3 bg-ok-bg border border-ok-border rounded-2xl px-4 py-3.5 animate-fade-up">
                <CheckCircle2 size={17} className="text-ok flex-shrink-0" />
                <div className="font-display font-semibold text-ok text-sm">לא נמצאו דוחות פתוחים</div>
              </div>
            )}

            {/* Filter tabs */}
            <Filters
              active={filter}
              onChange={setFilter}
              summary={response.summary}
              total={response.results.length}
            />

            {/* Cards */}
            <div className="space-y-2">
              {filtered.map((r, i) => (
                <ResultCard key={r.name} r={r} delay={i * 35} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-muted text-sm animate-fade-in">
                  אין תוצאות בקטגוריה זו
                </div>
              )}
            </div>

            {/* New search */}
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3
                         text-sm text-muted hover:text-ink
                         bg-surface border border-border hover:border-ink/25
                         rounded-xl transition-all"
            >
              <RotateCcw size={13} />
              בדיקה חדשה
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-muted/50 py-6 space-y-1">
        <div>המידע מתקבל ישירות מהרשויות המקומיות דרך doh.co.il</div>
        <div>פרטים אישיים אינם נשמרים בשרת</div>
      </footer>
    </div>
  )
}
