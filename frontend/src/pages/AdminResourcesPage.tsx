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
  const [form, setForm] = useState({ name: '', type: '', capacity: '1' })
  const suggestedTypes = ['GPU', 'CPU', 'TPU', 'Memory-Optimized', 'Storage']

  const stats = useMemo(() => {
    const total = resources.length
    const available = resources.filter(r => r.isAvailable).length
    const totalCapacity = resources.reduce((sum, r) => sum + r.capacity, 0)
    return { total, available, totalCapacity }
  }, [resources])

  const loadResources = async () => {
    try {
      const data = await resourcesApi.list()
      setResources(data.items || [])
    } finally {
      setLoading(false)
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

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Admin Resource Control</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">Dedicated capacity dashboard for admin operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4"><p className="text-xs text-[var(--text-secondary)]">Total Resources</p><p className="text-2xl font-bold text-white">{stats.total}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-[var(--text-secondary)]">Available</p><p className="text-2xl font-bold text-[var(--chart-green)]">{stats.available}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-[var(--text-secondary)]">Total Capacity</p><p className="text-2xl font-bold text-[var(--chart-gold)]">{stats.totalCapacity}</p></div>
      </div>

      <form onSubmit={createResource} className="glass-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="sr-only" htmlFor="admin-resource-name">Resource Name</label>
        <input id="admin-resource-name" className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name" required />
        <label className="sr-only" htmlFor="admin-resource-type">Resource Type</label>
        <input
          id="admin-resource-type"
          list="resource-type-suggestions"
          className="input-field"
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
          placeholder="Type (or select suggestion)"
          required
        />
        <datalist id="resource-type-suggestions">
          {suggestedTypes.map((type) => <option key={type} value={type} />)}
        </datalist>
        <label className="sr-only" htmlFor="admin-resource-capacity">Resource Capacity</label>
        <input id="admin-resource-capacity" className="input-field" type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required />
        <button type="submit" className="btn-primary">Create Resource</button>
      </form>

      <div className="space-y-3">
        {resources.map((r, idx) => (
          <motion.div key={r._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} className="glass-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{r.name} <span className="text-[var(--text-secondary)]">({r.type})</span></p>
              <p className="text-xs text-[var(--text-secondary)]">Capacity: {r.capacity}</p>
            </div>
            <button onClick={() => toggleResource(r._id, r.isAvailable)} className="btn-secondary">
              {r.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
