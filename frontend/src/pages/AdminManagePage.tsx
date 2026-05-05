import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usersApi } from '../api'

interface User {
  id: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  name?: string
}

export default function AdminManagePage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '', role: 'admin' })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'provision'>('overview')

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      const data = await usersApi.list()
      setUsers(data.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    if (form.password !== form.confirmPassword) {
      setFormError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }
    setCreating(true)
    try {
      await usersApi.create(form.email, form.password, form.role as 'admin' | 'user', form.name)
      setFormSuccess(`${form.role === 'admin' ? 'Admin' : 'User'} account created successfully`)
      setForm({ email: '', password: '', confirmPassword: '', name: '', role: 'admin' })
      setShowCreate(false)
      loadUsers()
    } catch (err: any) {
      setFormError(err.message || 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const clients = users.filter(u => u.role === 'user')

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
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">
          Admin Management
        </h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          Provision administrators & manage user accounts
        </p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, colorClass: 'text-[var(--chart-cyan)]' },
          { label: 'Admins', value: admins.length, colorClass: 'text-[#D4AF37]' },
          { label: 'Clients', value: clients.length, colorClass: 'text-[var(--chart-green)]' },
          { label: 'Active', value: users.filter(u => u.isActive).length, colorClass: 'text-[var(--chart-purple)]' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col items-center justify-center text-center"
          >
            <p className={`text-3xl font-black ${s.colorClass}`}>{s.value}</p>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${activeTab === 'overview' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>Accounts Overview</button>
        <button onClick={() => setActiveTab('provision')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${activeTab === 'provision' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>Provision Access</button>
      </div>

      {/* Create Admin / User Section */}
      {activeTab === 'provision' && (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-[0_0_20px_rgba(212,175,55,0.05)]">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
        
        <div className="p-6 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em]">Provision Access</h2>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold mt-1 opacity-70">
              Create new admin or user accounts
            </p>
          </div>
          <button
            id="toggle-create-admin"
            onClick={() => { setShowCreate(!showCreate); setFormError(''); setFormSuccess('') }}
            className="px-6 py-2.5 rounded bg-[#D4AF37] text-black text-[10px] font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300"
          >
            {showCreate ? 'Cancel' : '+ Provision Account'}
          </button>
        </div>

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--border-color)] overflow-hidden"
            >
              <div className="p-6">
                <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Full Name</label>
                    <input
                      id="new-admin-name"
                      type="text"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="e.g. John Smith"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Email Address</label>
                    <input
                      id="new-admin-email"
                      type="email"
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="admin@company.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Password</label>
                    <input
                      id="new-admin-password"
                      type="password"
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Confirm Password</label>
                    <input
                      id="new-admin-confirm-password"
                      type="password"
                      required
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="Repeat password"
                      value={form.confirmPassword}
                      onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="new-admin-role" className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Role</label>
                    <select
                      id="new-admin-role"
                      aria-label="Role"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D4AF37] transition-all"
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="admin">Administrator</option>
                      <option value="user">Client User</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      id="create-admin-submit"
                      type="submit"
                      disabled={creating}
                      className="w-full py-3 rounded bg-[#D4AF37] text-black text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all duration-300 disabled:opacity-50"
                    >
                      {creating ? 'PROVISIONING...' : 'PROVISION ACCOUNT'}
                    </button>
                  </div>
                </form>

                {formError && (
                  <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold tracking-wide">
                    ✕ {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mt-4 p-3 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-bold tracking-wide">
                    ✓ {formSuccess}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      )}

      {/* Users Table */}
      {activeTab === 'overview' && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">All Accounts ({users.length})</h3>
          <button onClick={loadUsers} className="text-[10px] text-[var(--text-secondary)] hover:text-[#D4AF37] uppercase tracking-widest font-bold transition-colors">
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Email</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Role</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Status</th>
                <th className="text-left px-6 py-4 text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] bg-[var(--bg-primary)]">
              <AnimatePresence>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-[var(--text-secondary)]">
                      <div className="text-xs uppercase tracking-widest font-bold">No users found</div>
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-mono text-[var(--text-primary)] text-sm">{u.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-sm ${
                          u.role === 'admin'
                            ? 'border-[#D4AF37]/50 text-[#D4AF37] bg-[#D4AF37]/10'
                            : 'border-[var(--text-secondary)]/30 text-[var(--text-secondary)] bg-transparent'
                        }`}>
                          {u.role === 'admin' ? 'Administrator' : 'Client'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-[var(--chart-green)]' : 'bg-red-500'}`} />
                          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">{u.isActive ? 'Active' : 'Suspended'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[var(--text-secondary)] font-mono">
                        {new Date(u.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </motion.div>
      )}
    </div>
  )
}
