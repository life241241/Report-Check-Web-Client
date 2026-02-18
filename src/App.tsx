import { useState, useRef, useCallback, useId, useEffect } from 'react'
import {
  Search, CheckCircle2, XCircle, AlertTriangle, ChevronDown,
  RotateCcw, Car, CreditCard, Loader2, Shield, MapPin, Building2,
  Calendar, Fuel, Palette, Gauge, Info, ChevronLeft, ChevronRight
} from 'lucide-react'
import {
  checkFinesStream, fetchMunicipalities, fetchMunicipalityImages, fetchVehicleInfo,
  type CheckResponse, type MunicipalityResult, type MunicipalityInfo, type VehicleInfo,
} from './api.ts'

/* ═══════════════════════════════════════════════════════════
   🧪 TEST MODE — set to true to simulate results without
   hitting the real server. Set to false for production.
   ═══════════════════════════════════════════════════════════ */
const TEST_MODE = true
/* ═══════════════════════════════════════════════════════════ */

const MOCK_MUNICIPALITY_RESULTS: MunicipalityResult[] = [
  { name: 'עיריית בית שמש', status: 'clean' },
  { name: 'עיריית רמת גן', status: 'fine', count: 2, amount: '750.00', fines: [
    { number: '12345', amount: 250, date: '15/01/2026', time: '09:30', price_display: '₪250' },
    { number: '12346', amount: 500, date: '02/02/2026', time: '14:15', price_display: '₪500' },
  ]},
  { name: 'עיריית מודיעין עילית', status: 'clean' },
  { name: 'עיריית גבעתיים', status: 'clean' },
  { name: 'מ.א דרום השרון', status: 'failed', error: 'timeout' },
  { name: 'עיריית הרצליה', status: 'clean' },
  { name: 'מועצה אזורית גוש עציון', status: 'clean' },
  { name: 'עיריית כפר קאסם', status: 'clean' },
  { name: 'מועצה מקומית בית דגן', status: 'clean' },
  { name: 'מ.מ. מזכרת בתיה', status: 'fine', count: 1, amount: '350.00', fines: [
    { number: '99887', amount: 350, date: '10/12/2025', time: '11:00', price_display: '₪350' },
  ]},
  { name: 'מועצה מקומית שוהם', status: 'clean' },
  { name: 'עיריית מעלה אדומים', status: 'clean' },
  { name: 'עיריית גני תקווה', status: 'clean' },
  { name: 'עיריית מצפה רמון', status: 'failed', error: 'connection error' },
  { name: 'עיריית ערד', status: 'clean' },
  { name: 'עיריית טירת כרמל', status: 'clean' },
  { name: 'עיריית כוכב יאיר-צור יגאל', status: 'clean' },
  { name: 'מ.א עמק יזרעאל', status: 'clean' },
  { name: 'עיריית שדרות', status: 'clean' },
  { name: 'עיריית יהוד - מונוסון', status: 'clean' },
  { name: 'רשות שדות התעופה', status: 'clean' },
  { name: 'מ.מ אורנית', status: 'clean' },
]

const TOTAL_MUNIS = 22

/* ═══════════════════════════════════════════════════════════
   Reusable Components
   ═══════════════════════════════════════════════════════════ */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center shadow-lg shadow-[var(--accent-glow)] animate-glow-ring">
          <Car size={16} className="text-white" />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[var(--ok)] rounded-full border-2 border-[var(--bg)] animate-breathe" />
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

/* ─── Municipality Grid — Real-time progress ─── */

/* ─── Municipality Tile — Rectangle card with name ─── */

function MunicipalityTile({ muni, result, loading, imageUrl }: {
  muni: MunicipalityInfo
  result?: MunicipalityResult
  loading: boolean
  imageUrl?: string
}) {
  const isDone = !!result

  return (
    <div
      className={`glass rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all duration-500
        ${isDone ? 'animate-tile-done' : loading ? 'opacity-40 animate-pulse' : 'opacity-60'}
        ${isDone && result!.status === 'clean' ? 'border-[var(--ok-border)] bg-[var(--ok-bg)]' : ''}
        ${isDone && result!.status === 'fine' ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]' : ''}
        ${isDone && result!.status === 'failed' ? 'border-[var(--warn-border)] bg-[var(--warn-bg)]' : ''}`}
    >
      {/* Icon / Image */}
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shadow-sm"
          style={{ backgroundColor: muni.color }}
        >
          {imageUrl
            ? <img src={imageUrl} alt={muni.name} className="w-7 h-7 object-contain" />
            : <span className="text-white font-bold text-xs">{muni.initials}</span>
          }
        </div>
        {isDone && (
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[var(--bg)] animate-pop-in ${
            result!.status === 'clean' ? 'bg-[var(--ok)]' :
            result!.status === 'fine' ? 'bg-[var(--danger)]' : 'bg-[var(--warn)]'
          }`}>
            {result!.status === 'clean' && <CheckCircle2 size={8} className="text-white" />}
            {result!.status === 'fine' && <AlertTriangle size={8} className="text-white" />}
            {result!.status === 'failed' && <XCircle size={8} className="text-white" />}
          </div>
        )}
      </div>

      {/* Name */}
      <span className={`text-xs font-medium leading-tight truncate ${
        isDone && result!.status === 'clean' ? 'text-[var(--ok)]' :
        isDone && result!.status === 'fine' ? 'text-[var(--danger)]' :
        isDone && result!.status === 'failed' ? 'text-[var(--warn)]' :
        'text-[var(--ink-secondary)]'
      }`}>
        {muni.name}
      </span>

      {/* Loading spinner for this tile */}
      {loading && !isDone && (
        <Loader2 size={12} className="animate-spin-slow text-[var(--muted)] mr-auto flex-shrink-0" />
      )}
    </div>
  )
}

/* ─── Municipality Marquee — vertical scrolling names on sides ─── */

function MunicipalityMarquee({ municipalities, images, side }: {
  municipalities: MunicipalityInfo[]
  images: Record<string, string>
  side: 'left' | 'right'
}) {
  // Duplicate the list so the scroll can loop seamlessly
  const items = [...municipalities, ...municipalities]

  return (
    <div className={`marquee-col marquee-col-${side} hidden lg:block`}
      style={{ height: 'calc(100vh - 64px)', top: 0 }}>
      <div className={`marquee-track ${side === 'right' ? 'marquee-track-down' : 'marquee-track-up'}`}>
        {items.map((m, i) => (
          <div key={`${m.id}-${i}`}
            className="glass rounded-xl px-3 py-2 flex items-center gap-2.5 mx-3 opacity-50 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ backgroundColor: m.color }}>
              {images[m.name]
                ? <img src={images[m.name]} alt={m.name} className="w-5 h-5 object-contain" />
                : <span className="text-white font-bold text-[10px]">{m.initials}</span>}
            </div>
            <span className="text-[11px] text-[var(--muted)] font-medium truncate">{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Municipality Column ─── */

function MunicipalityColumn({ municipalities, results, loading, images, label }: {
  municipalities: MunicipalityInfo[]
  results: Record<string, MunicipalityResult>
  loading: boolean
  images: Record<string, string>
  label: string
}) {
  const completed = municipalities.filter(m => results[m.name]).length
  const total = municipalities.length

  return (
    <div className="space-y-3 animate-swing-in">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-[var(--muted)]">{label}</span>
        <span className="text-[10px] font-bold text-[var(--accent-light)] tabular-nums">
          {completed}/{total}
        </span>
      </div>
      <div className="space-y-2">
        {municipalities.map((m, i) => (
          <MunicipalityTile
            key={m.id}
            muni={m}
            result={results[m.name]}
            loading={loading}
            imageUrl={images[m.name]}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Result Card ─── */

function ResultCard({ r, delay, imageUrl, color }: { r: MunicipalityResult; delay: number; imageUrl?: string; color?: string }) {
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
        {/* Municipality icon */}
        <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm" style={{ backgroundColor: color || 'var(--surface-solid)' }}>
          {imageUrl
            ? <img src={imageUrl} alt={r.name} className="w-6 h-6 object-contain" />
            : <Building2 size={14} className="text-white/60" />}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--ink)] font-medium truncate block">{r.name}</span>
          <StatusBadge status={r.status} count={r.count} />
        </div>

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
  const [municipalities, setMunicipalities] = useState<MunicipalityInfo[]>([])
  const [muniImages, setMuniImages] = useState<Record<string, string>>({})
  const [streamResults, setStreamResults] = useState<Record<string, MunicipalityResult>>({})
  const [response, setResponse] = useState<CheckResponse | null>(null)
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null)
  const [apiError, setApiError] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const streamRef = useRef<Record<string, MunicipalityResult>>({})
  const idId = useId()
  const carId = useId()

  // Fetch municipality list + images on mount
  useEffect(() => {
    fetchMunicipalities()
      .then(munis => {
        setMunicipalities(munis)
        // Fetch Wikipedia images for all municipalities
        fetchMunicipalityImages(munis.map(m => m.name))
          .then(setMuniImages)
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

  const TOTAL_MUNIS = municipalities.length || 22

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idNum.trim() || !carNum.trim()) return
    setLoading(true)
    setApiError('')
    setResponse(null)
    setVehicleInfo(null)
    setFilter('all')
    streamRef.current = {}
    setStreamResults({})

    // Fetch vehicle info immediately (fast, public API)
    fetchVehicleInfo(carNum)
      .then(v => setVehicleInfo(v))
      .catch(() => {})

    if (TEST_MODE) {
      // 🧪 Simulate streaming results with delays — no real server calls
      for (const mockResult of MOCK_MUNICIPALITY_RESULTS) {
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 400))
        streamRef.current[mockResult.name] = mockResult
        setStreamResults({ ...streamRef.current })
      }
      const allResults = Object.values(streamRef.current)
      const summary = {
        clean: allResults.filter(r => r.status === 'clean').length,
        fine: allResults.filter(r => r.status === 'fine').length,
        failed: allResults.filter(r => r.status === 'failed').length,
      }
      setResponse({ results: allResults, summary })
      setLoading(false)
      return
    }

    try {
      await checkFinesStream(
        idNum,
        carNum,
        // onResult — called for each municipality as it completes
        (result) => {
          streamRef.current[result.name] = result
          setStreamResults({ ...streamRef.current })
        },
        // onDone — called when all municipalities have been checked
        (summary) => {
          const allResults = Object.values(streamRef.current)
          setResponse({ results: allResults, summary })
          setLoading(false)
        },
      )
      // If stream ends without explicit 'done' event
      if (!response) {
        const allResults = Object.values(streamRef.current)
        const summary = {
          clean: allResults.filter(r => r.status === 'clean').length,
          fine: allResults.filter(r => r.status === 'fine').length,
          failed: allResults.filter(r => r.status === 'failed').length,
        }
        setResponse({ results: allResults, summary })
        setLoading(false)
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
      setLoading(false)
    }
  }

  const handleReset = () => {
    setResponse(null); setVehicleInfo(null); setIdNum(''); setCarNum('')
    setFilter('all'); setApiError(''); setStreamResults({}); streamRef.current = {}
  }

  const showGrid = loading || (Object.keys(streamResults).length > 0)

  // Split municipalities into right (first 12) and left (last 10) columns
  const midpoint = Math.ceil(municipalities.length / 2)
  const rightMunis = municipalities.slice(0, midpoint)
  const leftMunis = municipalities.slice(midpoint)

  const filtered = response?.results.filter(r => filter === 'all' || r.status === filter) ?? []

  return (
    <div className="min-h-svh flex flex-col">

      {/* Floating particles */}
      <div className="particles">
        <div className="particle" /><div className="particle" /><div className="particle" /><div className="particle" />
        <div className="particle" /><div className="particle" /><div className="particle" /><div className="particle" />
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass-strong border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] bg-[var(--ok-bg)] px-3 py-1.5 rounded-full border border-[var(--ok-border)] animate-breathe">
            <Shield size={11} className="text-[var(--ok)]" />
            <span className="text-[var(--ok)]">מוצפן ומאובטח</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 w-full">

        {/* ── Before scanning: centered with side marquees ── */}
        {!response && !loading && !showGrid && (
          <div className="relative">
            {/* Side marquee columns */}
            <MunicipalityMarquee municipalities={municipalities} images={muniImages} side="right" />
            <MunicipalityMarquee municipalities={municipalities} images={muniImages} side="left" />

            <div className="max-w-xl mx-auto px-5 py-6 space-y-6 relative z-10">
            {/* Compact Hero + Form together */}
            <section className="glass-strong rounded-3xl p-6 space-y-5 animate-tilt-settle hover-lift">
              {/* Mini hero inside the card */}
              <div className="text-center space-y-1.5 animate-sway">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center shadow-lg shadow-[var(--accent-glow)] animate-subtle-bounce">
                    <Car size={18} className="text-white" />
                  </div>
                  <div className="text-right">
                    <h1 className="font-black text-2xl text-[var(--ink)] tracking-tight leading-none">ReportCheck</h1>
                    <p className="text-xs font-semibold text-gradient-animated">
                      מערכת ארצית לאיתור דוחות חנייה
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border)] animate-border-dance" />

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  id={idId} label="מספר תעודת זהות" icon={<CreditCard size={15} />}
                  value={idNum} onChange={setIdNum}
                  placeholder="נא להזין 9 ספרות" maxLength={9} disabled={loading}
                />
                <InputField
                  id={carId} label="מספר רכב" icon={<Car size={15} />}
                  value={carNum} onChange={setCarNum}
                  placeholder="נא להזין מספר רכב" maxLength={8} disabled={loading}
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

              {/* Inline badges */}
              <div className="flex items-center justify-center gap-3 text-xs text-[var(--muted)] flex-wrap pt-1">
                {[
                  `${TOTAL_MUNIS} רשויות`,
                  'תוצאות תוך שניות',
                  'ללא רישום',
                ].map((text, i) => (
                  <span key={i} className="flex items-center gap-1.5 animate-slide-up-fade" style={{ animationDelay: `${400 + i * 120}ms` }}>
                    <CheckCircle2 size={11} className="text-[var(--ok)] animate-pulse-dot" style={{ animationDelay: `${i * 600}ms` }} />
                    <span>{text}</span>
                  </span>
                ))}
              </div>
            </section>

            {/* About — below the fold */}
            <section className="glass rounded-2xl px-5 py-4 text-right space-y-2.5 animate-slide-up-fade hover-tilt" style={{ animationDelay: '300ms' }}>
              <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                <span className="font-bold text-[var(--ink)]">ReportCheck</span> מאפשרת בדיקה מרוכזת של דוחות חנייה פתוחים מול {TOTAL_MUNIS} רשויות מקומיות בישראל — במקום אחד.
              </p>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                המערכת מבצעת סריקה מקבילית ומציגה תוצאות ישירות ממערכות הרשויות המקומיות, תוך שמירה על חיבור מאובטח וללא שמירת נתונים אישיים.
              </p>
            </section>
          </div>
          </div>
        )}

        {/* ── During scanning: 3-column layout ── */}
        {!response && (loading || showGrid) && (
          <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col lg:flex-row gap-5 items-start">
            {/* Right column — municipalities */}
            <div className="hidden lg:block w-[240px] flex-shrink-0 sticky top-20">
              <MunicipalityColumn
                municipalities={rightMunis}
                results={streamResults}
                loading={loading}
                images={muniImages}
                label="רשויות (1)"
              />
            </div>

            {/* Center — Form + progress */}
            <div className="w-full lg:flex-1 max-w-lg mx-auto space-y-5">
              <section className="glass-strong rounded-3xl p-6 space-y-5 animate-slide-right">
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-sm text-[var(--accent-light)]">
                        <Loader2 size={14} className="animate-spin-slow" />
                        <span>סורק {Object.keys(streamResults).length}/{municipalities.length} רשויות...</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--accent-light)] tabular-nums">
                        {municipalities.length > 0 ? Math.round((Object.keys(streamResults).length / municipalities.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out shimmer-bar"
                        style={{
                          width: `${municipalities.length > 0 ? (Object.keys(streamResults).length / municipalities.length) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, var(--accent), #8b5cf6, var(--accent))',
                          backgroundSize: '200% 100%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>

              {vehicleInfo && <VehicleCard v={vehicleInfo} />}

              {/* Mobile: show all municipalities stacked */}
              <div className="lg:hidden space-y-4">
                <MunicipalityColumn
                  municipalities={rightMunis}
                  results={streamResults}
                  loading={loading}
                  images={muniImages}
                  label="רשויות (1)"
                />
                <MunicipalityColumn
                  municipalities={leftMunis}
                  results={streamResults}
                  loading={loading}
                  images={muniImages}
                  label="רשויות (2)"
                />
              </div>
            </div>

            {/* Left column — municipalities */}
            <div className="hidden lg:block w-[240px] flex-shrink-0 sticky top-20">
              <MunicipalityColumn
                municipalities={leftMunis}
                results={streamResults}
                loading={loading}
                images={muniImages}
                label="רשויות (2)"
              />
            </div>
          </div>
        )}

        {/* ── After results ── */}
        {response && (
          <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">

            {/* ── Results Hero Card ── */}
            <div className="glass-strong rounded-3xl overflow-hidden animate-tilt-settle">
              <div className="relative px-6 py-8 text-center" style={{
                background: response.summary.fine > 0
                  ? 'linear-gradient(135deg, rgba(248,113,113,0.12) 0%, rgba(139,92,246,0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(99,102,241,0.08) 100%)'
              }}>
                <div className="flex justify-center mb-4 animate-pop-in">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl animate-subtle-bounce ${
                    response.summary.fine > 0
                      ? 'bg-gradient-to-br from-[var(--danger)] to-orange-500 shadow-red-500/20'
                      : 'bg-gradient-to-br from-[var(--ok)] to-emerald-400 shadow-emerald-500/20'
                  }`}>
                    {response.summary.fine > 0
                      ? <AlertTriangle size={28} className="text-white" />
                      : <CheckCircle2 size={28} className="text-white" />}
                  </div>
                </div>
                <h2 className="font-black text-2xl text-[var(--ink)] animate-fade-in" style={{ animationDelay: '150ms' }}>
                  {response.summary.fine > 0 ? 'נמצאו דוחות פתוחים' : 'הכל תקין!'}
                </h2>
                <p className="text-sm text-[var(--muted)] mt-2 animate-fade-in" style={{ animationDelay: '250ms' }}>
                  {response.summary.fine > 0
                    ? `ב-${response.summary.fine} ${response.summary.fine === 1 ? 'רשות' : 'רשויות'} מתוך ${response.results.length} נמצאו דוחות פתוחים`
                    : `הסריקה הושלמה — ${response.results.length} רשויות נבדקו בהצלחה`}
                </p>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 border-t border-[var(--border)]">
                {[
                  { label: 'תקין', value: response.summary.clean, color: 'var(--ok)', icon: <CheckCircle2 size={15} /> },
                  { label: 'דוחות', value: response.summary.fine, color: 'var(--danger)', icon: <AlertTriangle size={15} /> },
                  { label: 'לא זמין', value: response.summary.failed, color: 'var(--warn)', icon: <XCircle size={15} /> },
                ].map(({ label, value, color, icon }, i) => (
                  <div key={label} className="text-center py-4 px-3 animate-count-up" style={{ animationDelay: `${300 + i * 100}ms` }}>
                    <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color }}>
                      {icon}
                      <span className="font-black text-2xl tabular-nums">{value}</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Fines Detail Section ── */}
            {response.results.some(r => r.status === 'fine') && (
              <div className="space-y-3 animate-slide-right" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center gap-2 px-1">
                  <AlertTriangle size={14} className="text-[var(--danger)]" />
                  <span className="text-sm font-bold text-[var(--danger)]">דוחות פתוחים</span>
                  <span className="text-xs font-bold text-[var(--danger)]/70 mr-auto tabular-nums">
                    סה״כ ₪{response.results
                      .filter(r => r.status === 'fine')
                      .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0)
                      .toLocaleString()}
                  </span>
                </div>
                {response.results.filter(r => r.status === 'fine').map((r, i) => {
                  const muni = municipalities.find(m => m.name === r.name)
                  return (
                    <ResultCard key={r.name} r={r} delay={300 + i * 80}
                      imageUrl={muniImages[r.name]} color={muni?.color} />
                  )
                })}
              </div>
            )}

            {/* ── Clean Municipalities — Compact Grid ── */}
            {response.results.some(r => r.status === 'clean') && (
              <div className="space-y-3 animate-slide-left" style={{ animationDelay: '400ms' }}>
                <div className="flex items-center gap-2 px-1">
                  <CheckCircle2 size={14} className="text-[var(--ok)]" />
                  <span className="text-sm font-bold text-[var(--ok)]">רשויות תקינות</span>
                  <span className="text-[11px] tabular-nums font-bold text-[var(--ok)]/60 mr-auto">{response.summary.clean}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {response.results.filter(r => r.status === 'clean').map((r, i) => {
                    const muni = municipalities.find(m => m.name === r.name)
                    const img = muniImages[r.name]
                    return (
                      <div key={r.name} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2.5 animate-pop-in"
                        style={{ animationDelay: `${500 + i * 30}ms` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: muni?.color || '#6366f1' }}>
                          {img
                            ? <img src={img} alt={r.name} className="w-5 h-5 object-contain" />
                            : <span className="text-white font-bold text-[10px]">{muni?.initials || '?'}</span>}
                        </div>
                        <span className="text-[11px] text-[var(--ok)] font-medium truncate flex-1">{r.name}</span>
                        <CheckCircle2 size={11} className="text-[var(--ok)] flex-shrink-0 opacity-60" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Failed Municipalities ── */}
            {response.results.some(r => r.status === 'failed') && (
              <div className="space-y-3 animate-slide-right" style={{ animationDelay: '500ms' }}>
                <div className="flex items-center gap-2 px-1">
                  <XCircle size={14} className="text-[var(--warn)]" />
                  <span className="text-sm font-bold text-[var(--warn)]">לא הצלחנו לבדוק</span>
                  <span className="text-[11px] tabular-nums font-bold text-[var(--warn)]/60 mr-auto">{response.summary.failed}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {response.results.filter(r => r.status === 'failed').map((r, i) => {
                    const muni = municipalities.find(m => m.name === r.name)
                    const img = muniImages[r.name]
                    return (
                      <div key={r.name} className="glass rounded-xl px-3 py-2.5 flex items-center gap-2.5 animate-pop-in"
                        style={{ animationDelay: `${600 + i * 30}ms` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: muni?.color || '#6366f1' }}>
                          {img
                            ? <img src={img} alt={r.name} className="w-5 h-5 object-contain" />
                            : <span className="text-white font-bold text-[10px]">{muni?.initials || '?'}</span>}
                        </div>
                        <span className="text-[11px] text-[var(--warn)] font-medium truncate flex-1">{r.name}</span>
                        <XCircle size={11} className="text-[var(--warn)] flex-shrink-0 opacity-60" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Vehicle Info ── */}
            {vehicleInfo && <VehicleCard v={vehicleInfo} />}

            {/* ── Reset Button ── */}
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2.5 py-4
                         text-sm font-semibold text-[var(--accent-light)] hover:text-white
                         glass-strong hover:bg-[var(--accent)]/20
                         rounded-2xl transition-all duration-300 group animate-slide-left"
              style={{ animationDelay: '600ms' }}
            >
              <RotateCcw size={15} className="transition-transform duration-300 group-hover:rotate-[-90deg]" />
              בצע בדיקה חדשה
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-[var(--muted)]/40 py-8 space-y-1.5 border-t border-[var(--border)] animate-border-dance mt-4 animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
        <div>הנתונים מתקבלים ישירות ממערכות הרשויות המקומיות.</div>
        <div>המערכת אינה שומרת פרטים אישיים והמידע נמחק עם סיום הבדיקה.</div>
        <div className="pt-1 text-[var(--muted)]/25">© {new Date().getFullYear()} ReportCheck</div>
      </footer>
    </div>
  )
}
