import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
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
  userId?: string
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-16 h-16 border-t-2 border-b-2 border-[#D4AF37] rounded-full animate-spin"></div>
          <span className="text-[#D4AF37] font-mono text-[10px] tracking-widest animate-pulse">LOADING</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 max-w-6xl mx-auto min-h-screen">
      {/* Enterprise Title */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em] drop-shadow-sm">
          Workload Deployment
        </h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          Submit new allocations and track operational history
        </p>
        <div className="w-16 h-[2px] bg-[var(--text-primary)] opacity-20 mt-4 rounded-full"></div>
      </div>
      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="relative overflow-hidden rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_0_20px_rgba(212,175,55,0.05)] p-8"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]"></div>
          
          <div className="mb-8 flex flex-col items-center justify-center text-center">
            <h2 className="text-[14px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Initialize New Allocation</h2>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Fill out the parameters below to queue compute resources instantly.</p>
            <div className="w-8 h-[2px] mt-4 rounded-full bg-[#D4AF37] opacity-60"></div>
          </div>
          
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest pl-1">Resource Type</label>
              <input 
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37] transition-all" 
                placeholder="e.g. CPU, GPU, Node" 
                value={form.resourceType} 
                onChange={e => setForm({...form, resourceType: e.target.value})} 
                required 
              />
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest pl-1">Quantity</label>
              <input 
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
                <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Priority Class</label>
                <span className="text-[10px] font-bold text-black bg-[#D4AF37] px-2 py-0.5 rounded-sm">{form.priority}</span>
              </div>
              <input 
                className="w-full h-1 bg-[var(--border-color)] appearance-none cursor-pointer accent-[#D4AF37]" 
                type="range" 
                min="0" 
                max="100" 
                value={form.priority} 
                onChange={e => setForm({...form, priority: e.target.value})} 
              />
              <div className="flex justify-between text-[8px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1 px-1 absolute bottom-[-10px] w-full">
                <span>Low</span>
                <span>Normal</span>
                <span>Critical</span>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <button 
                type="submit" 
                disabled={creating || !form.resourceType} 
                className="w-full py-3.5 rounded bg-[#D4AF37] text-black text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'SENDING...' : 'DEPLOY'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Requests History Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
          <h3 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">Allocation History</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                {isAdmin && <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Client ID</th>}
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Resource Type</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Quantity</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Priority</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Status</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Timestamp</th>
                <th className="text-right px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]">
              <AnimatePresence>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-16 text-[var(--text-secondary)]">
                      <div className="text-xs uppercase tracking-widest font-bold mb-2">NO RECORDS FOUND</div>
                      <p className="text-[10px]">{isAdmin ? 'No pending allocations found.' : 'Your historical allocations will appear here.'}</p>
                    </td>
                  </tr>
                ) : (
                  requests.map((r, i) => (
                    <motion.tr
                      key={r._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-[var(--bg-secondary)] transition-colors group"
                    >
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <span className="font-mono text-[var(--text-primary)] opacity-80 text-[10px]">{r.userId ? r.userId.substring(0, 8) + '...' : 'Unknown'}</span>
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
                          r.status === 'allocated' ? 'border-[#D4AF37]/50 text-[#D4AF37] bg-[#D4AF37]/10' :
                          r.status === 'rejected' ? 'border-[var(--text-primary)]/50 text-[var(--text-primary)] bg-[var(--text-primary)]/10' :
                          r.status === 'cancelled' ? 'border-[var(--text-secondary)]/50 text-[var(--text-secondary)] bg-[var(--text-secondary)]/10' :
                          'border-[#D4AF37]/30 text-[#D4AF37] bg-transparent animate-pulse'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--text-secondary)] text-[10px] font-mono">
                        {new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {r.status === 'pending' && (
                            <>
                              {isAdmin && (
                                <button onClick={() => handleAllocate(r._id)} className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-[var(--text-primary)] transition-colors border border-[#D4AF37] hover:bg-[#D4AF37] px-3 py-1">
                                  ACCEPT
                                </button>
                              )}
                              <button onClick={() => handleCancel(r._id)} className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:text-black transition-colors border border-[var(--text-primary)] hover:bg-[var(--text-primary)] px-3 py-1">
                                CANCEL
                              </button>
                            </>
                          )}
                        </div>
                        {r.reason && r.status !== 'pending' && (
                          <span className="text-[10px] text-[var(--text-secondary)] block mt-1 truncate max-w-[150px] ml-auto" title={r.reason}>
                            {r.reason}
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
