import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { requestsApi } from '../api'
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
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ resourceType: '', quantity: '1', priority: '50' })
  const [creating, setCreating] = useState(false)
  const user = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    loadRequests()
    const token = localStorage.getItem('schedulord_token')
    if (token) {
      const sock = connectSocket(token)
      sock.on('request.status', () => loadRequests())
    }
    return () => { getSocket()?.off('request.status') }
  }, [])

  const loadRequests = async () => {
    try {
      const data = await requestsApi.list()
      setRequests(data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await requestsApi.create({
        resourceType: form.resourceType,
        quantity: Number(form.quantity),
        priority: Number(form.priority),
      })
      setShowCreate(false)
      setForm({ resourceType: '', quantity: '1', priority: '50' })
      loadRequests()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await requestsApi.cancel(id)
      loadRequests()
    } catch (err: any) { alert(err.message) }
  }

  const handleAllocate = async (id: string) => {
    try {
      await requestsApi.allocateNow(id)
      loadRequests()
    } catch (err: any) { alert(err.message) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Loading Requests...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Allocation Requests</h1>
          <p className="text-sm text-[#636380] mt-1">Submit and track resource allocation requests</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary" id="create-request-btn">
          + New Request
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Submit Allocation Request</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="input-field" placeholder="Resource Type (e.g. compute)" value={form.resourceType} onChange={e => setForm({...form, resourceType: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required min="1" />
            <div>
              <input className="input-field" type="range" min="0" max="100" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} />
              <p className="text-xs text-[#636380] mt-1 text-center">Priority: {form.priority}</p>
            </div>
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">{creating ? 'Submitting...' : 'Submit'}</button>
          </form>
        </motion.div>
      )}

      {/* Requests Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-glass-border)]">
                <th className="text-left px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Type</th>
                <th className="text-left px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Qty</th>
                <th className="text-left px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Priority</th>
                <th className="text-left px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Status</th>
                <th className="text-left px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Created</th>
                <th className="text-right px-5 py-3 text-xs text-[#636380] uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-[#636380]">No requests yet. Submit your first allocation request.</td></tr>
              ) : (
                requests.map((r, i) => (
                  <motion.tr
                    key={r._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-[rgba(108,92,231,0.06)] hover:bg-[rgba(108,92,231,0.05)] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-[var(--color-accent-secondary)]">{r.resourceType}</span>
                    </td>
                    <td className="px-5 py-4 text-white">{r.quantity}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[var(--color-dark-600)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${r.priority}%`, background: r.priority > 70 ? '#ff5252' : r.priority > 40 ? '#ffab40' : '#00e676' }} />
                        </div>
                        <span className="text-xs text-[#8888a0]">{r.priority}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`status-badge status-${r.status}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-4 text-[#8888a0] text-xs font-mono">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'pending' && (
                          <>
                            {isAdmin && (
                              <button onClick={() => handleAllocate(r._id)} className="text-xs text-[var(--color-neon-cyan)] hover:text-white transition-colors">
                                Allocate
                              </button>
                            )}
                            <button onClick={() => handleCancel(r._id)} className="text-xs text-[var(--color-neon-red)] hover:text-white transition-colors">
                              Cancel
                            </button>
                          </>
                        )}
                        {r.reason && (
                          <span className="text-xs text-[#636380] italic" title={r.reason}>
                            {r.reason.slice(0, 30)}
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
