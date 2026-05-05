import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, requestsApi } from '../api'

interface DecisionRequest {
  _id: string
  resourceType: string
  quantity: number
  priority: number
  createdAt: string
  reason?: string
  userId?: { name?: string; email?: string }
}

interface PredictionSummary {
  demandSignal?: number
  trend?: string
  spikeProbability?: number
  method?: string
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
      const predPairs = await Promise.all(types.map(async (t) => {
        try {
          const p = await analyticsApi.predict(t)
          return [t, p] as const
        } catch {
          return [t, {}] as const
        }
      }))
      setPredictions(Object.fromEntries(predPairs))
    } catch (err: any) {
      setTopError(err?.message || 'Unable to load request decisions')
    } finally {
      setLoading(false)
    }
  }

  const decisionHint = (r: DecisionRequest) => {
    const p = predictions[r.resourceType] || {}
    const spike = Number(p.spikeProbability || 0)
    const signal = Number(p.demandSignal || 0)
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
      await requestsApi.reject(rejectDraft.id, rejectDraft.reason)
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

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Request Decisions</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          Assigned approval queue with AI details and recommendation
        </p>
      </div>

      {topError && (
        <div className="rounded border border-red-500/50 bg-red-950/60 px-4 py-3 text-red-200 text-sm">{topError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Pending Assigned</p>
          <p className="text-3xl font-black text-[var(--chart-gold)] mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Total Approved</p>
          <p className="text-3xl font-black text-[var(--chart-green)] mt-1">{approvedCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Total Rejected</p>
          <p className="text-3xl font-black text-red-400 mt-1">{rejectedCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Assigned Requests ({pendingCount})</p>
          <button onClick={loadData} className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] hover:text-[#D4AF37] font-bold">Refresh</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">Loading request decisions...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">No pending requests assigned to you.</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {items.map((r, idx) => {
              const p = predictions[r.resourceType] || {}
              return (
                <motion.div key={r._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <div className="lg:col-span-4">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{r.userId?.name || 'Unknown user'}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">Needs {r.quantity} x {r.resourceType} • Priority {r.priority}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">Submitted {new Date(r.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <div className="lg:col-span-5 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] font-bold mb-2">AI Detail</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <p className="text-[var(--text-secondary)]">Demand Signal</p><p className="text-[var(--text-primary)] font-semibold">{Number(p.demandSignal || 0).toFixed(2)}</p>
                        <p className="text-[var(--text-secondary)]">Trend</p><p className="text-[var(--text-primary)] font-semibold">{p.trend || 'stable'}</p>
                        <p className="text-[var(--text-secondary)]">Spike Probability</p><p className="text-[var(--text-primary)] font-semibold">{Math.round(Number(p.spikeProbability || 0) * 100)}%</p>
                        <p className="text-[var(--text-secondary)]">Recommendation</p><p className="text-[var(--chart-cyan)] font-semibold">{decisionHint(r)}</p>
                      </div>
                    </div>
                    <div className="lg:col-span-3 flex lg:justify-end gap-2">
                      <button onClick={() => approve(r._id)} disabled={actionLoading === r._id + '_approve'} className="px-3 py-2 text-[10px] uppercase tracking-widest font-black border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black">
                        {actionLoading === r._id + '_approve' ? '...' : 'Approve'}
                      </button>
                      <button onClick={() => setRejectDraft({ id: r._id, reason: '' })} className="px-3 py-2 text-[10px] uppercase tracking-widest font-black border border-red-500/50 text-red-400">
                        Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-color)]">
          <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold">Decision History ({history.length})</p>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-secondary)]">No decision history yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {history.slice(0, 20).map((h) => (
              <div key={h._id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{h.userId?.name || 'Unknown user'}</p>
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

      {rejectDraft && (
        <div className="rounded border border-red-500/40 bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] uppercase tracking-widest text-red-300 font-bold mb-2">Reject Request</p>
          <div className="flex gap-2">
            <input
              value={rejectDraft.reason}
              onChange={(e) => setRejectDraft({ ...rejectDraft, reason: e.target.value })}
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm"
              placeholder="Enter rejection reason"
            />
            <button onClick={reject} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-red-500/50 text-red-300">Confirm</button>
            <button onClick={() => setRejectDraft(null)} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-[var(--border-color)] text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

