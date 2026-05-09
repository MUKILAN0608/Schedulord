import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, requestsApi } from '../api'

interface DecisionRequest {
  _id: string
  resourceType: string
  quantity: number
  priority: number
  createdAt: string
  status?: string
  reason?: string
  userId?: { name?: string; email?: string }
}

interface PredictionSummary {
  demandSignal?: number
  trend?: string
  spikeProbability?: number
  velocity?: number
  feasibilityScore?: number
  predictedLoad?: number
  priorityScore?: number
  aiScore?: number
  dataPoints?: number
  recommendation?: string
  trained?: boolean
  degraded?: boolean
  method?: string
  error?: {
    code?: string
    message?: string
    details?: string
  }
}

function normalizeTypeKey(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/[_\s-]+/g, '')
}

function normalizePrediction(p: any, fallback: PredictionSummary | null): PredictionSummary {
  const src = p && typeof p === 'object' ? p : {}
  const hasCore =
    typeof src.demandSignal === 'number' ||
    typeof src.spikeProbability === 'number' ||
    typeof src.recommendation === 'string'
  if (hasCore) return src as PredictionSummary
  if (fallback) return { ...fallback, degraded: true }
  return {}
}

function modelScore(p: PredictionSummary): number | null {
  if (typeof p.aiScore === 'number') return p.aiScore
  if (
    typeof p.feasibilityScore === 'number' &&
    typeof p.priorityScore === 'number' &&
    typeof p.predictedLoad === 'number'
  ) {
    return Math.max(0, Math.min(1, 0.4 * p.feasibilityScore + 0.4 * p.priorityScore + 0.2 * (1 - p.predictedLoad)))
  }
  return null
}

function requestAwareScore(p: PredictionSummary, r: DecisionRequest): number | null {
  const base = modelScore(p)
  if (base == null) return null

  const priorityNorm = Math.max(0, Math.min(1, Number(r.priority || 0) / 100))
  const quantityNorm = Math.max(0, Math.min(1, Number(r.quantity || 0) / 10))
  const spikeNorm = Math.max(0, Math.min(1, Number(p.spikeProbability || 0)))
  const waitingHours = Math.max(0, (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60))
  const waitingBoost = Math.max(0, Math.min(0.15, waitingHours * 0.03))
  const trendAdj = p.trend === 'increasing' ? 0.04 : p.trend === 'decreasing' ? -0.03 : 0

  // Per-request realism over trained type-level model score:
  // - Higher priority and longer wait should increase urgency.
  // - High spike pressure + large quantity should reduce immediate fit.
  const adjusted =
    base +
    0.24 * (priorityNorm - 0.5) -
    0.12 * (quantityNorm - 0.3) -
    0.10 * spikeNorm * quantityNorm +
    waitingBoost +
    trendAdj
  return Math.max(0, Math.min(1, adjusted))
}

function fmtPct(v: number | undefined | null): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${Math.round(v * 100)}%`
}

function fmtFixed(v: number | undefined | null, digits = 2): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return v.toFixed(digits)
}

function displayUserName(user?: { name?: string; email?: string }): string {
  const name = String(user?.name || '').trim()
  if (name) return name
  const email = String(user?.email || '').trim()
  if (email && email.includes('@')) return email.split('@')[0]
  return 'user'
}

export default function AdminRequestDecisionsPage() {
  const [items, setItems] = useState<DecisionRequest[]>([])
  const [history, setHistory] = useState<DecisionRequest[]>([])
  const [predictions, setPredictions] = useState<Record<string, PredictionSummary>>({})
  const [loading, setLoading] = useState(true)
  const [topError, setTopError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectDraft, setRejectDraft] = useState<{ id: string; reason: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setTopError('')
    try {
      const [pendingData, allocatedData, rejectedData] = await Promise.all([
        requestsApi.listWithParams('pending'),
        requestsApi.listWithParams('allocated'),
        requestsApi.listWithParams('rejected'),
      ])
      const rows: DecisionRequest[] = pendingData.items || []
      setItems(rows)
      const historyRows: DecisionRequest[] = [
        ...(allocatedData.items || []),
        ...(rejectedData.items || []),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setHistory(historyRows)

      const types = Array.from(new Set(rows.map((r) => r.resourceType).filter(Boolean)))
      const allPrediction = await analyticsApi.predict('all').catch(() => null)
      const normalizedAll = normalizePrediction(allPrediction, null)

      // If per-type prediction service is degraded, reuse the all-type model
      // to avoid repeated failing requests and blank AI detail cards.
      const shouldSkipPerTypeFetch =
        !!normalizedAll?.degraded || !!normalizedAll?.error?.message

      const predPairs = shouldSkipPerTypeFetch
        ? types.map((t) => [t, normalizedAll] as const)
        : await Promise.all(
            types.map(async (t) => {
              try {
                const p = await analyticsApi.predict(t)
                return [t, normalizePrediction(p, normalizedAll)] as const
              } catch (err) {
                console.error(`Prediction fetch failed for ${t}`, err)
                return [t, normalizePrediction({}, normalizedAll)] as const
              }
            })
          )

      const byRawType = Object.fromEntries(predPairs)
      const byNormalizedType = Object.fromEntries(
        predPairs.map(([t, p]) => [normalizeTypeKey(t), p])
      )
      setPredictions({ ...byNormalizedType, ...byRawType })
    } catch (err: any) {
      setTopError(err?.message || 'Unable to load request decisions')
    } finally {
      setLoading(false)
    }
  }

  const decisionHint = (r: DecisionRequest) => {
    const p =
      predictions[r.resourceType] ||
      predictions[normalizeTypeKey(r.resourceType)] ||
      {}
    if (p.recommendation && p.recommendation.trim()) return p.recommendation
    const score = requestAwareScore(p, r)
    if (score == null) return 'Model output unavailable. Check prediction service health.'
    const spike = Number(p.spikeProbability || 0)
    const signal = Number(p.demandSignal || 0)
    if (score >= 0.75) return 'Strong model score: prioritize approval'
    if (score <= 0.35) return 'Low model score: review before approval'
    if (spike > 0.75 && r.priority < 60) return 'Hold for capacity'
    if (signal > 0.75 && r.priority < 45) return 'Review manually'
    if (r.priority >= 70) return 'Prioritize approval'
    return 'Approve if policy checks pass'
  }

  const approve = async (id: string) => {
    setActionLoading(id + '_approve')
    setTopError('')
    try {
      await requestsApi.approve(id)
      await loadData()
    } catch (err: any) {
      setTopError(err?.message || 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  const reject = async () => {
    if (!rejectDraft) return
    if (!rejectDraft.reason.trim()) {
      setTopError('Rejection reason is required')
      return
    }
    setActionLoading(rejectDraft.id + '_reject')
    setTopError('')
    try {
      await requestsApi.reject(rejectDraft.id, rejectDraft.reason.trim())
      setRejectDraft(null)
      await loadData()
    } catch (err: any) {
      setTopError(err?.message || 'Rejection failed')
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = useMemo(() => items.length, [items])
  const approvedCount = useMemo(() => history.filter((h) => h.status === 'allocated').length, [history])
  const rejectedCount = useMemo(() => history.filter((h) => h.status === 'rejected').length, [history])
  const panelCard = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
  const microLabel = 'text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)] font-black text-center'

  return (
    <div className="space-y-7 pb-12 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-7">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Request Decisions</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          Assigned approval queue with AI details and recommendation
        </p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      {topError && (
        <div className="rounded border border-red-500/50 bg-red-950/60 px-4 py-3 text-red-200 text-sm">{topError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className={panelCard}>
          <p className={microLabel}>Pending Assigned</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-gold)] mt-2 text-center">{pendingCount}</p>
        </div>
        <div className={panelCard}>
          <p className={microLabel}>Total Approved</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-green)] mt-2 text-center">{approvedCount}</p>
        </div>
        <div className={panelCard}>
          <p className={microLabel}>Total Rejected</p>
          <p className="text-3xl md:text-4xl font-black text-red-400 mt-2 text-center">{rejectedCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
        <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Assigned Requests ({pendingCount})</p>
          <button onClick={loadData} className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest text-[var(--text-secondary)] hover:text-[#D4AF37] border border-[var(--border-color)] font-bold">Refresh</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">Loading request decisions...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">No pending requests assigned to you.</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {items.map((r, idx) => {
              const p =
                predictions[r.resourceType] ||
                predictions[normalizeTypeKey(r.resourceType)] ||
                {}
              const score = requestAwareScore(p, r)
              return (
                <motion.div key={r._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="p-5 md:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div className="lg:col-span-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{displayUserName(r.userId)}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">Needs {r.quantity} x {r.resourceType} • Priority {r.priority}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">Submitted {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <div className="lg:col-span-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold mb-2">AI Detail</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <p className="text-[var(--text-secondary)]">Decision Score</p>
                        <p className="text-[var(--chart-green)] font-semibold">{score == null ? '—' : `${Math.round(score * 100)}%`}</p>
                        <p className="text-[var(--text-secondary)]">Demand Trend</p>
                        <p className="text-[var(--text-primary)] font-semibold">{p.trend || 'stable'} ({fmtPct(p.spikeProbability)})</p>
                        <p className="text-[var(--text-secondary)]">Model</p>
                        <p className={`font-semibold ${p.trained ? 'text-[var(--chart-green)]' : 'text-[var(--chart-gold)]'}`}>{p.trained ? 'ready' : 'learning'}</p>
                        <p className="text-[var(--text-secondary)]">Recommendation</p>
                        <p className="text-[var(--chart-cyan)] font-semibold">{decisionHint(r)}</p>
                      </div>
                      {p.error?.message && <p className="mt-2 text-[10px] text-red-300">{p.error.message}</p>}
                    </div>
                    <div className="lg:col-span-3 flex lg:justify-end gap-2">
                      <button onClick={() => approve(r._id)} disabled={actionLoading === r._id + '_approve'} className="px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors">
                        {actionLoading === r._id + '_approve' ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => setRejectDraft((prev) => prev?.id === r._id ? null : { id: r._id, reason: '' })} disabled={actionLoading === r._id + '_reject'} className="px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black border border-red-500/50 text-red-400 transition-colors">
                        {actionLoading === r._id + '_reject' ? '...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                  {rejectDraft?.id === r._id && (
                    <div className="mt-3 rounded border border-red-500/40 bg-[var(--bg-secondary)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-red-300 font-bold mb-2">Reject Request</p>
                      <div className="flex gap-2">
                        <input
                          value={rejectDraft.reason}
                          onChange={(e) => setRejectDraft({ id: r._id, reason: e.target.value })}
                          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm"
                          placeholder="Enter rejection reason"
                        />
                        <button onClick={reject} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-red-500/50 text-red-300">Confirm</button>
                        <button onClick={() => setRejectDraft(null)} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-[var(--border-color)] text-[var(--text-secondary)]">Cancel</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
        <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Decision History ({history.length})</p>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-secondary)]">No decision history yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {history.slice(0, 20).map((h) => (
              <div key={h._id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{displayUserName(h.userId)}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{h.quantity} x {h.resourceType} • Priority {h.priority}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] uppercase tracking-widest font-bold ${h.status === 'allocated' ? 'text-[var(--chart-green)]' : 'text-red-400'}`}>{h.status}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{new Date(h.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

