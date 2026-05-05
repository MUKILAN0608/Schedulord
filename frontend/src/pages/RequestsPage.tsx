import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { z } from 'zod'
import { getStoredUser, requestsApi, resourcesApi, usersApi } from '../api'
import { RootState } from '../store/store'
import { connectSocket, getSocket } from '../socket'

interface Req {
  _id: string
  resourceType: string
  quantity: number
  priority: number
  status: string
  reason: string
  createdAt: string
  allocation?: any
  userId?: string | { _id?: string; name?: string; email?: string }
  clientName?: string
  adminApproved?: boolean
  reviewerAdminId?: string | { _id?: string; name?: string; email?: string }
}

interface ResourceOption {
  _id: string
  name: string
  type: string
  capacity: number
  isAvailable: boolean
}

interface AdminOption {
  id: string
  name: string
}

const STATUS_FILTERS = ['all', 'pending', 'allocated', 'rejected', 'cancelled']

export default function RequestsPage() {
  const stored = getStoredUser()
  const [requests, setRequests] = useState<Req[]>([])
  const [availableResources, setAvailableResources] = useState<ResourceOption[]>([])
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ reviewerAdminId: '', selectedResourceId: '', quantity: '1', priority: '50' })
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>(stored?.role === 'admin' ? 'pending' : 'all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [topError, setTopError] = useState('')
  const [rejectDraft, setRejectDraft] = useState<{ id: string; reason: string } | null>(null)
  const requestSchema = z.object({
    reviewerAdminId: z.string().min(1),
    selectedResourceId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
    priority: z.coerce.number().int().min(0).max(100),
  })

  const user = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) {
      loadAvailableResources()
      loadAdmins()
    }
    loadRequests()
    const token = localStorage.getItem('schedulord_token')
    if (token) {
      const sock = connectSocket(token)
      sock.on('request.status', () => loadRequests())
    }
    return () => { getSocket()?.off('request.status') }
  }, [statusFilter, isAdmin])

  const loadRequests = async () => {
    try {
      const data = await requestsApi.listWithParams(
        statusFilter !== 'all' ? statusFilter : undefined
      )
      const normalized = (data.items || []).map((r: any) => {
        const user = typeof r.userId === 'object' ? r.userId : null
        return {
          ...r,
          clientName: user?.name || user?.email || (typeof r.userId === 'string' ? r.userId : 'Unknown'),
        }
      })
      setRequests(normalized)
    } catch (err) {
      console.error(err)
      setTopError('Unable to load requests right now. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableResources = async () => {
    try {
      const data = await resourcesApi.list()
      const items = (data.items || []).filter((r: ResourceOption) => r.isAvailable && r.capacity > 0)
      setAvailableResources(items)
      if (!form.selectedResourceId && items.length > 0) {
        setForm(prev => ({ ...prev, selectedResourceId: items[0]._id }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadAdmins = async () => {
    try {
      const data = await usersApi.admins()
      const items = data.items || []
      setAdminOptions(items)
      if (!form.reviewerAdminId && items.length > 0) {
        setForm(prev => ({ ...prev, reviewerAdminId: items[0].id }))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const parsed = requestSchema.parse(form)
      await requestsApi.create({
        reviewerAdminId: parsed.reviewerAdminId,
        preferredResourceId: parsed.selectedResourceId,
        resourceType: (availableResources.find(r => r._id === form.selectedResourceId)?.type || '').trim(),
        quantity: parsed.quantity,
        priority: parsed.priority,
      })
      setForm(prev => ({ ...prev, quantity: '1', priority: '50' }))
      loadRequests()
    } catch (err: any) {
      setTopError(err?.message || 'Unable to create request')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (id: string) => {
    setActionLoading(id + '_cancel')
    try {
      await requestsApi.cancel(id)
      loadRequests()
    } catch (err: any) { setTopError(err?.message || 'Unable to cancel request') }
    finally { setActionLoading(null) }
  }

  const handleApprove = async (id: string) => {
    setActionLoading(id + '_allocate')
    try {
      await requestsApi.approve(id)
      loadRequests()
    } catch (err: any) { setTopError(err?.message || 'Unable to approve request') }
    finally { setActionLoading(null) }
  }

  const handleRejectSubmit = async () => {
    if (!rejectDraft?.id) return
    setActionLoading(rejectDraft.id + '_reject')
    try {
      const reason = rejectDraft.reason || ''
      if (!reason.trim()) {
        setTopError('Reason is required for rejection')
        setActionLoading(null)
        return
      }
      await requestsApi.reject(rejectDraft.id, reason)
      setRejectDraft(null)
      loadRequests()
    } catch (err: any) { setTopError(err?.message || 'Unable to reject request') }
    finally { setActionLoading(null) }
  }

  const filteredRequests = isAdmin
    ? requests // backend already filters
    : requests.filter(r => statusFilter === 'all' ? true : r.status === statusFilter)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 border-t-2 border-b-2 border-[#D4AF37] rounded-full animate-spin" />
          <span className="text-[#D4AF37] font-mono text-[10px] tracking-widest animate-pulse">LOADING</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 max-w-6xl mx-auto min-h-screen">
      {topError && (
        <div className="rounded border border-red-500/50 bg-red-950/60 text-red-200 px-4 py-3 text-sm flex items-center justify-between">
          <span>{topError}</span>
          <button className="text-xs uppercase tracking-wider" onClick={() => setTopError('')}>Dismiss</button>
        </div>
      )}
      {/* Enterprise Title */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em] drop-shadow-sm">
          {isAdmin ? 'Request Management' : 'Workload Deployment'}
        </h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          {isAdmin ? 'Review, approve, and manage all client allocation requests' : 'Submit new allocations and track operational history'}
        </p>
        <div className="w-16 h-[2px] bg-[var(--text-primary)] opacity-20 mt-4 rounded-full" />
      </div>

      {/* Client Create Form */}
      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="relative overflow-hidden rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_0_20px_rgba(212,175,55,0.05)] p-8"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
          
          <div className="mb-8 flex flex-col items-center justify-center text-center">
            <h2 className="text-[14px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Initialize New Allocation</h2>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Fill out the parameters below to queue compute resources instantly.</p>
            <div className="w-8 h-[2px] mt-4 rounded-full bg-[#D4AF37] opacity-60" />
          </div>
          
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-3 space-y-2">
              <label htmlFor="reviewer-admin-input" className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest pl-1">Approving Admin</label>
              <select
                id="reviewer-admin-input"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                value={form.reviewerAdminId}
                onChange={e => setForm({ ...form, reviewerAdminId: e.target.value })}
                required
              >
                {adminOptions.length === 0 ? (
                  <option value="">No admin available</option>
                ) : (
                  adminOptions.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="md:col-span-4 space-y-2">
              <label htmlFor="resource-type-input" className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest pl-1">Available Resource</label>
              <select
                id="resource-type-input"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                value={form.selectedResourceId}
                onChange={e => setForm({ ...form, selectedResourceId: e.target.value })}
                required
              >
                {availableResources.length === 0 ? (
                  <option value="">No available resources</option>
                ) : (
                  availableResources.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.type}) - cap {r.capacity}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <label htmlFor="quantity-input" className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest pl-1">Quantity</label>
              <input 
                id="quantity-input"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37] transition-all" 
                type="number" 
                min="1" 
                value={form.quantity} 
                onChange={e => setForm({...form, quantity: e.target.value})} 
                required 
              />
            </div>
            
            <div className="md:col-span-4 space-y-2 relative pb-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="priority-slider" className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Priority Class</label>
                <span className="text-[10px] font-bold text-black bg-[#D4AF37] px-2 py-0.5 rounded-sm">{form.priority}</span>
              </div>
              <input 
                id="priority-slider"
                className="w-full h-1 bg-[var(--border-color)] appearance-none cursor-pointer accent-[#D4AF37]" 
                type="range" 
                min="0" 
                max="100" 
                value={form.priority} 
                onChange={e => setForm({...form, priority: e.target.value})} 
              />
              <div className="flex justify-between text-[8px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1 px-1">
                <span>Low</span>
                <span>Normal</span>
                <span>Critical</span>
              </div>
            </div>
            
            <div className="md:col-span-3">
              <button 
                id="deploy-request-btn"
                type="submit" 
                disabled={creating || !form.reviewerAdminId || !form.selectedResourceId || availableResources.length === 0 || adminOptions.length === 0} 
                className="w-full py-3.5 rounded bg-[#D4AF37] text-black text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'SENDING...' : 'DEPLOY'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mr-2">Filter:</span>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
              statusFilter === s
                ? 'bg-[#D4AF37] text-black'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s}
          </button>
        ))}
        <button onClick={loadRequests} className="ml-auto text-[10px] text-[var(--text-secondary)] hover:text-[#D4AF37] uppercase tracking-widest font-bold transition-colors">
          Refresh
        </button>
      </div>

      {/* Requests History Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">
            {isAdmin ? `Allocation Queue (${filteredRequests.length})` : `My Requests (${filteredRequests.length})`}
          </h3>
          {isAdmin && statusFilter === 'pending' && filteredRequests.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ffab40] animate-pulse" />
              <span className="text-[10px] text-[#ffab40] font-bold uppercase tracking-widest">{filteredRequests.length} Awaiting Action</span>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                {isAdmin && <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Client</th>}
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Resource Type</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Qty</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Priority</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Status</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Timestamp</th>
                <th className="text-right px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]">
              <AnimatePresence>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-16 text-[var(--text-secondary)]">
                      <div className="text-xs uppercase tracking-widest font-bold mb-2">NO RECORDS FOUND</div>
                      <p className="text-[10px]">{isAdmin ? `No ${statusFilter === 'all' ? '' : statusFilter + ' '}requests at this time.` : 'Your historical allocations will appear here.'}</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((r, i) => (
                    <motion.tr
                      key={r._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="hover:bg-[var(--bg-secondary)] transition-colors group"
                    >
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="leading-tight">
                            <p className="text-[11px] text-[var(--text-primary)] font-semibold">{r.clientName || 'Unknown'}</p>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className="font-mono text-[var(--text-primary)] font-bold">{r.resourceType}</span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-primary)] opacity-80 font-mono">{r.quantity}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[var(--border-color)] text-[var(--text-primary)]">
                            P{r.priority}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border ${
                          r.status === 'pending' && r.adminApproved ? 'border-[#42a5f5]/50 text-[#90caf9] bg-[#42a5f5]/10' :
                          r.status === 'allocated' ? 'border-[#D4AF37]/50 text-[#D4AF37] bg-[#D4AF37]/10' :
                          r.status === 'rejected' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                          r.status === 'cancelled' ? 'border-[var(--text-secondary)]/50 text-[var(--text-secondary)] bg-[var(--text-secondary)]/10' :
                          'border-[#ffab40]/30 text-[#ffab40] bg-transparent animate-pulse'
                        }`}>
                          {r.status === 'pending' && r.adminApproved ? 'approved' : r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)] text-[10px] font-mono">
                        {new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.status === 'pending' && isAdmin && (
                            <>
                              <button
                                id={`approve-btn-${r._id}`}
                                onClick={() => handleApprove(r._id)}
                                disabled={actionLoading === r._id + '_allocate'}
                                className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-black transition-all border border-[#D4AF37] hover:bg-[#D4AF37] px-3 py-1 disabled:opacity-50"
                              >
                                {actionLoading === r._id + '_allocate' ? '...' : 'APPROVE'}
                              </button>
                              <button
                                id={`reject-btn-${r._id}`}
                                onClick={() => setRejectDraft({ id: r._id, reason: '' })}
                                disabled={actionLoading === r._id + '_reject'}
                                className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all border border-red-500/50 hover:bg-red-500 px-3 py-1 disabled:opacity-50"
                              >
                                {actionLoading === r._id + '_reject' ? '...' : 'REJECT'}
                              </button>
                            </>
                          )}
                          {r.status === 'pending' && !isAdmin && (
                            <button
                              id={`cancel-btn-${r._id}`}
                              onClick={() => handleCancel(r._id)}
                              disabled={actionLoading === r._id + '_cancel'}
                              className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === r._id + '_cancel' ? '...' : 'CANCEL'}
                            </button>
                          )}
                          {r.reason && r.status !== 'pending' && (
                            <div className="max-w-[220px] text-left">
                              <span className="text-[10px] text-red-300 truncate block mb-1" title={r.reason}>
                                {r.reason}
                              </span>
                              <div className="h-[4px] rounded-full bg-red-500/20 overflow-hidden mb-1">
                                <div className="h-full w-full bg-red-500" />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
      {rejectDraft && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded border border-red-500/40 bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-red-300 mb-2">Reject Request</p>
          <div className="flex gap-2 items-center">
            <input
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm"
              placeholder="Enter rejection reason"
              value={rejectDraft.reason}
              onChange={(e) => setRejectDraft({ ...rejectDraft, reason: e.target.value })}
            />
            <button className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-red-500/60 text-red-300" onClick={handleRejectSubmit}>
              Confirm Reject
            </button>
            <button className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-[var(--border-color)]" onClick={() => setRejectDraft(null)}>
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
