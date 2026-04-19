import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, requestsApi } from '../api'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { connectSocket, getSocket } from '../socket'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#6c5ce7', '#00e676', '#ff5252', '#ffab40', '#00e5ff']

interface DashboardStats {
  resources: { total: number; available: number; utilization: string }
  requests: { total: number; pending: number; allocated: number; rejected: number }
  allocations: { total: number }
  recentEvents: any[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [requestForm, setRequestForm] = useState({ resourceType: '', quantity: '1', priority: '50' })
  const [submitting, setSubmitting] = useState(false)

  const user = useSelector((s: RootState) => s.auth.user)
  const isClient = user?.role !== 'admin'

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)

    // WebSocket for live events
    const token = localStorage.getItem('schedulord_token')
    if (token) {
      const sock = connectSocket(token)
      sock.on('request.status', (data: any) => {
        setEvents(prev => [{ ...data, createdAt: new Date().toISOString(), type: 'allocation', title: `Request ${data.status}` }, ...prev].slice(0, 50))
      })
    }

    return () => {
      clearInterval(interval)
      getSocket()?.off('request.status')
    }
  }, [])

  const loadData = async () => {
    try {
      const [dashData, eventsData] = await Promise.all([
        analyticsApi.dashboard(),
        analyticsApi.events(20),
      ])
      setStats(dashData)
      setEvents(eventsData.events || [])
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await requestsApi.create({
        resourceType: requestForm.resourceType,
        quantity: Number(requestForm.quantity),
        priority: Number(requestForm.priority),
      })
      setRequestForm({ resourceType: '', quantity: '1', priority: '50' })
      alert('Request Submitted Successfully to Sovereign Engine')
      loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const pieData = stats ? [
    { name: 'Allocated', value: stats.requests.allocated },
    { name: 'Pending', value: stats.requests.pending },
    { name: 'Rejected', value: stats.requests.rejected },
  ].filter(d => d.value > 0) : []

  const areaData = events.slice(0, 20).reverse().map((e, i) => ({
    idx: i,
    time: new Date(e.createdAt).toLocaleTimeString(),
    events: 1,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Loading Command Center...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-[#636380] mt-1">Real-time system overview and event monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="pulse-dot bg-[var(--color-neon-green)]" />
          <span className="text-xs text-[var(--color-neon-green)] font-mono">SYSTEM ONLINE</span>
        </div>
      </div>

      {isClient && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 border border-gold/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gold to-transparent"></div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-widest text-gold-gradient">Request Allocation</h3>
          <p className="text-xs text-[#636380] mb-6">Submit a direct compute request to the Engine.</p>
          <form onSubmit={handleCreateRequest} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-widest">Resource Matrix</label>
              <input className="w-full bg-white/5 border border-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/30 font-light" placeholder="e.g. GPU, Node" value={requestForm.resourceType} onChange={e => setRequestForm({...requestForm, resourceType: e.target.value})} required />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-widest">Cycle Quantity</label>
              <input className="w-full bg-white/5 border border-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/30 font-light" type="number" min="1" value={requestForm.quantity} onChange={e => setRequestForm({...requestForm, quantity: e.target.value})} required />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-widest">Priority Weight ({requestForm.priority})</label>
              <input className="w-full mt-2" type="range" min="0" max="100" value={requestForm.priority} onChange={e => setRequestForm({...requestForm, priority: e.target.value})} />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3 gold-button text-xs disabled:opacity-50 h-[46px]">
              {submitting ? 'Authenticating...' : 'Engage Engine'}
            </button>
          </form>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Resources', value: stats?.resources.total || 0, sub: `${stats?.resources.available || 0} available`, color: 'var(--color-accent-primary)' },
          { label: 'Utilization', value: `${stats?.resources.utilization || 0}%`, sub: 'resource usage', color: 'var(--color-neon-cyan)' },
          { label: 'Active Requests', value: stats?.requests.pending || 0, sub: `${stats?.requests.total || 0} total`, color: 'var(--color-neon-amber)' },
          { label: 'Allocations', value: stats?.allocations.total || 0, sub: `${stats?.requests.allocated || 0} completed`, color: 'var(--color-neon-green)' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card-sm stat-card p-5"
          >
            <p className="text-xs text-[#636380] uppercase tracking-wider font-medium mb-2">{card.label}</p>
            <p className="text-3xl font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-xs text-[#8888a0] mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Event Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Event Activity</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="events" stroke="#6c5ce7" fillOpacity={1} fill="url(#colorEvents)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Request Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">Request Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((_entry, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-[#636380] text-sm">No request data</div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                <span className="text-xs text-[#8888a0]">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Live Event Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Live Activity Stream</h3>
          <div className="flex items-center gap-2">
            <div className="pulse-dot bg-[var(--color-neon-green)]" />
            <span className="text-xs text-[#636380] font-mono">LIVE</span>
          </div>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-[#636380] text-center py-8">No events yet. Submit an allocation request to see activity.</p>
          ) : (
            events.map((ev, i) => (
              <motion.div
                key={`${ev._id || i}-${ev.createdAt}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[rgba(26,26,46,0.5)] border border-[rgba(108,92,231,0.08)]"
              >
                <div className={`w-2 h-2 rounded-full ${
                  ev.severity === 'error' || ev.severity === 'critical' ? 'bg-[var(--color-neon-red)]' :
                  ev.severity === 'warning' ? 'bg-[var(--color-neon-amber)]' :
                  'bg-[var(--color-neon-green)]'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{ev.title || ev.type}</p>
                  <p className="text-xs text-[#636380] truncate">{ev.message || JSON.stringify(ev)}</p>
                </div>
                <span className="text-xs text-[#4a4a60] font-mono whitespace-nowrap">
                  {new Date(ev.createdAt).toLocaleTimeString()}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  )
}
