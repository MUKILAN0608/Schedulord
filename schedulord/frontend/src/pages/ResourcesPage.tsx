import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { resourcesApi } from '../api'
import { RootState } from '../store/store'

interface Resource {
  _id: string
  name: string
  type: string
  capacity: number
  isAvailable: boolean
  metadata: Record<string, any>
  createdAt: string
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', type: '', capacity: '' })
  const [creating, setCreating] = useState(false)
  const user = useSelector((s: RootState) => s.auth.user)
  const isAdmin = user?.role === 'admin'

  useEffect(() => { loadResources() }, [])

  const loadResources = async () => {
    try {
      const data = await resourcesApi.list()
      setResources(data.items || [])
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
      await resourcesApi.create({ name: form.name, type: form.type, capacity: Number(form.capacity) })
      setShowCreate(false)
      setForm({ name: '', type: '', capacity: '' })
      loadResources()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource?')) return
    try {
      await resourcesApi.delete(id)
      loadResources()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleToggle = async (id: string, available: boolean) => {
    try {
      await resourcesApi.update(id, { isAvailable: !available })
      loadResources()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Loading Resources...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Resource Explorer</h1>
          <p className="text-sm text-[#636380] mt-1">Manage and monitor system resources</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary" id="create-resource-btn">
            + New Resource
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Create Resource</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="input-field" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            <input className="input-field" placeholder="Type (e.g. compute, storage)" value={form.type} onChange={e => setForm({...form, type: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Capacity" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required min="0" />
            <button type="submit" disabled={creating} className="btn-primary disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
          </form>
        </motion.div>
      )}

      {/* Resource Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.length === 0 ? (
          <div className="col-span-full text-center py-16 text-[#636380]">
            No resources yet. {isAdmin ? 'Create your first resource above.' : 'Ask an admin to create resources.'}
          </div>
        ) : (
          resources.map((r, i) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card-sm stat-card p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{r.name}</h3>
                  <p className="text-xs text-[#636380] font-mono mt-0.5">{r.type}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${r.isAvailable ? 'bg-[var(--color-neon-green)]' : 'bg-[var(--color-neon-red)]'}`} />
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-xl font-bold text-[var(--color-accent-secondary)]">{r.capacity}</p>
                  <p className="text-xs text-[#636380]">Capacity</p>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-[var(--color-dark-700)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(5, Math.min(100, r.capacity > 0 ? 80 : 0))}%`,
                        background: r.isAvailable ? 'linear-gradient(90deg, #6c5ce7, #00e5ff)' : '#ff5252',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`status-badge ${r.isAvailable ? 'status-allocated' : 'status-rejected'}`}>
                  {r.isAvailable ? 'Available' : 'Unavailable'}
                </span>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => handleToggle(r._id, r.isAvailable)} className="text-xs text-[var(--color-accent-secondary)] hover:text-white transition-colors">
                      Toggle
                    </button>
                    <button onClick={() => handleDelete(r._id)} className="text-xs text-[var(--color-neon-red)] hover:text-white transition-colors">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
