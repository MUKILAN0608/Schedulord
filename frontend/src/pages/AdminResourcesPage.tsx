import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { resourcesApi } from '../api'

interface Resource {
  _id: string
  name: string
  type: string
  capacity: number
  isAvailable: boolean
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState({ name: '', type: '', capacity: '1' })
  const suggestedTypes = ['GPU', 'CPU', 'TPU', 'Memory-Optimized', 'Storage']

  const stats = useMemo(() => {
    const total = resources.length
    const available = resources.filter(r => r.isAvailable).length
    const unavailable = total - available
    const totalCapacity = resources.reduce((sum, r) => sum + r.capacity, 0)
    const availableCapacity = resources.filter(r => r.isAvailable).reduce((sum, r) => sum + r.capacity, 0)
    const utilizationPct = totalCapacity > 0 ? Math.round(((totalCapacity - availableCapacity) / totalCapacity) * 100) : 0
    return { total, available, unavailable, totalCapacity, availableCapacity, utilizationPct }
  }, [resources])

  const loadResources = async () => {
    try {
      setRefreshing(true)
      const data = await resourcesApi.list()
      setResources(data.items || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadResources() }, [])

  const createResource = async (e: React.FormEvent) => {
    e.preventDefault()
    await resourcesApi.create({ name: form.name, type: form.type, capacity: Number(form.capacity) })
    setForm({ name: '', type: '', capacity: '1' })
    loadResources()
  }

  const toggleResource = async (id: string, isAvailable: boolean) => {
    await resourcesApi.update(id, { isAvailable: !isAvailable })
    loadResources()
  }

  if (loading) return <div className="text-center py-12 text-[var(--text-secondary)]">Loading resources...</div>

  const panelCard = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
  const kpiLabel = 'text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)] font-black text-center'

  return (
    <div className="space-y-7 pb-12 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-7 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Admin Resource Control</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">Dedicated capacity dashboard for admin operations</p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      <div className={`${panelCard} py-4 md:py-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] uppercase tracking-[0.16em] font-black text-[var(--text-secondary)]">
            Enterprise Resource Operations
          </div>
          <button onClick={loadResources} className="btn-secondary min-w-24">
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 md:gap-5">
        <div className={panelCard}>
          <p className={kpiLabel}>Total Resources</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-cyan)] mt-2 text-center">{stats.total}</p>
        </div>
        <div className={panelCard}>
          <p className={kpiLabel}>Available</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-green)] mt-2 text-center">{stats.available}</p>
        </div>
        <div className={panelCard}>
          <p className={kpiLabel}>Unavailable</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-gold)] mt-2 text-center">{stats.unavailable}</p>
        </div>
        <div className={panelCard}>
          <p className={kpiLabel}>Total Capacity</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-purple)] mt-2 text-center">{stats.totalCapacity}</p>
        </div>
        <div className={panelCard}>
          <p className={kpiLabel}>Utilization</p>
          <p className="text-3xl md:text-4xl font-black text-[#D4AF37] mt-2 text-center">{stats.utilizationPct}%</p>
        </div>
      </div>

      <form onSubmit={createResource} className={`${panelCard} grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4`}>
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-1 block" htmlFor="admin-resource-name">Resource Name</label>
          <input id="admin-resource-name" className="input-field w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. GPU-Cluster-01" required />
        </div>
        <div className="md:col-span-4">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-1 block" htmlFor="admin-resource-type">Resource Type</label>
          <input
            id="admin-resource-type"
            list="resource-type-suggestions"
            className="input-field w-full"
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            placeholder="Type (or select suggestion)"
            required
          />
          <datalist id="resource-type-suggestions">
            {suggestedTypes.map((type) => <option key={type} value={type} />)}
          </datalist>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-secondary)] mb-1 block" htmlFor="admin-resource-capacity">Capacity</label>
          <input id="admin-resource-capacity" className="input-field w-full" type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required />
        </div>
        <div className="md:col-span-3 flex items-end">
          <button type="submit" className="btn-primary w-full">Create Resource</button>
        </div>
      </form>

      <div className={`${panelCard} p-0 overflow-hidden`}>
        <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
          <h3 className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Resource Inventory ({resources.length})</h3>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Operational controls</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">Resource</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">Type</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">Capacity</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">Status</th>
                <th className="text-right px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]">
              {resources.map((r, idx) => (
                <motion.tr key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className="hover:bg-[var(--bg-secondary)] transition-colors">
                  <td className="px-6 py-4 text-[var(--text-primary)] font-semibold">{r.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-sm border-[var(--border-color)] text-[var(--text-secondary)]">
                      {r.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--text-primary)] font-mono">{r.capacity}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-sm ${
                      r.isAvailable
                        ? 'border-[var(--chart-green)]/40 text-[var(--chart-green)] bg-[var(--chart-green)]/10'
                        : 'border-[#D4AF37]/40 text-[#D4AF37] bg-[#D4AF37]/10'
                    }`}>
                      {r.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => toggleResource(r._id, r.isAvailable)} className="btn-secondary">
                      {r.isAvailable ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
