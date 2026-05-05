import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, requestsApi } from '../api'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { connectSocket, getSocket } from '../socket'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar, LineChart, Line } from 'recharts'

const VIBRANT_COLORS = ['var(--chart-cyan)', 'var(--chart-magenta)', 'var(--chart-green)', 'var(--chart-gold)', 'var(--chart-purple)']

interface DashboardStats {
  resources: { total: number; available: number; utilization: string }
  requests: { total: number; pending: number; allocated: number; rejected: number }
  allocations: { total: number }
  recentEvents: any[]
}

export default function DashboardPage({ mode }: { mode?: 'admin' | 'user' }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acceptedItems, setAcceptedItems] = useState<any[]>([])

  const user = useSelector((s: RootState) => s.auth.user)
  const isClient = mode ? mode !== 'admin' : user?.role !== 'admin'

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)

    const token = localStorage.getItem('schedulord_token')
    if (token) {
      const sock = connectSocket(token)
      sock.on('request.status', (data: any) => {
        setEvents(prev => [{ ...data, createdAt: new Date().toISOString(), type: 'allocation', title: `REQ ${data.status.toUpperCase()}` }, ...prev].slice(0, 50))
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
        analyticsApi.events(50),
      ])
      setStats(dashData)
      setEvents(eventsData.events || [])
      if (!isClient) {
        const accepted = await requestsApi.listWithParams('allocated')
        setAcceptedItems((accepted.items || []).slice(0, 8))
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Data processing for 6 graphs
  const pieData = stats ? [
    { name: 'Active', value: stats.requests.allocated },
    { name: 'Queued', value: stats.requests.pending },
    { name: 'Rejected', value: stats.requests.rejected },
  ].filter(d => d.value > 0) : []

  const areaData = events.slice(0, 20).reverse().map((e, i) => ({
    time: new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    volume: e.resources?.cpus || 1, // Actual requested CPUs
  }))

  const barData = stats ? [
    { name: 'Allocated', value: stats.requests.allocated },
    { name: 'Pending', value: stats.requests.pending },
  ] : []

  const priorityData = events.slice(0, 10).map((e, i) => ({
    time: new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    priority: e.priority || 50,
  }))

  const utilizationData = [
    { name: 'Used', value: parseFloat(stats?.resources.utilization || '0') },
    { name: 'Free', value: 100 - parseFloat(stats?.resources.utilization || '0') }
  ]

  const historyData = events.slice(0, 15).reverse().map((e, i) => ({
    id: e.id ? e.id.substring(0, 6) : `evt-${i}`,
    val: e.resources?.memory || 512, // Actual requested Memory
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 border-t-2 border-b-2 border-[#D4AF37] rounded-full animate-spin"></div>
          <span className="text-[#D4AF37] font-mono text-xs tracking-widest animate-pulse">INITIATING</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10 min-h-screen">
      {/* Enterprise Title */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em] drop-shadow-sm">
          {isClient ? 'Client Operations' : 'Global Telemetry'}
        </h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">
          {isClient ? 'Resource Monitoring & Visualization' : 'System-Wide Compute Orchestration'}
        </p>
        <div className="w-16 h-[2px] bg-[var(--text-primary)] opacity-20 mt-4 rounded-full"></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 max-w-6xl mx-auto">
        {[
          { label: isClient ? 'Provisioned Compute' : 'Global Fleet Capacity', value: stats?.resources.total || 0, sub: `${stats?.resources.available || 0} nodes idle`, color: 'var(--chart-cyan)' },
          { label: 'Cluster Saturation', value: `${stats?.resources.utilization || 0}%`, sub: 'real-time load', color: 'var(--chart-magenta)' },
          { label: isClient ? 'Workload Backlog' : 'Global Queue Depth', value: stats?.requests.pending || 0, sub: 'pending workloads', color: 'var(--chart-green)' },
          { label: 'Completed Allocations', value: stats?.allocations.total || 0, sub: 'historical tasks', color: 'var(--chart-gold)' },
          { label: 'System Volatility', value: events.length || 0, sub: 'recent telemetry events', color: 'var(--chart-purple)' },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            whileHover={{ scale: 1.05, y: -5 }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1 * i, type: "spring", stiffness: 200, damping: 15 }}
            className="relative py-8 sm:py-0 sm:aspect-square overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 flex flex-col items-center justify-center text-center group cursor-default"
          >
            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.15em] mb-2 group-hover:text-[var(--text-primary)] transition-colors z-10 leading-tight">
              {metric.label}
            </p>
            
            <p className="text-4xl sm:text-4xl font-black tracking-tighter my-2 z-10 transition-transform group-hover:scale-110 duration-300" style={{ color: metric.color }}>
              {metric.value}
            </p>
            
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity z-10 mt-1" style={{ color: metric.color }}>
              {metric.sub}
            </p>
            
            {/* Solid Bottom Accent Bar */}
            <div className="absolute bottom-0 left-0 w-full h-[4px] opacity-40 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: metric.color }} />
          </motion.div>
        ))}
      </div>

      {/* 6 Graphs Below (2 rows of 3, or responsive grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Compute Demand */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Compute Demand</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">CPU Allocations Over Time</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-cyan)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <defs>
                  <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-cyan)" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="var(--chart-cyan)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-cyan)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Area type="monotone" dataKey="volume" stroke="var(--chart-cyan)" strokeWidth={3} fill="url(#cyanGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Graph 2: Compute State */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Compute State</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Distribution Metrics</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-magenta)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((_entry, i) => <Cell key={`cell-${i}`} fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-magenta)', borderRadius: '4px', color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Graph 3: Allocation Comparison */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Allocation Status</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Pending vs Active Load</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-green)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-green)', borderRadius: '4px', color: 'var(--text-primary)' }} cursor={{ fill: 'var(--border-color)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--chart-green)' : 'var(--chart-magenta)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Graph 4: Priority Trend */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Priority Index</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Recent Request Tiering</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-gold)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-gold)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Line type="stepAfter" dataKey="priority" stroke="var(--chart-gold)" strokeWidth={3} dot={{ fill: 'var(--chart-gold)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Graph 5: Network Saturation Donut */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 relative">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Saturation Level</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Global System Load</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-purple)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={utilizationData} cx="50%" cy="50%" innerRadius={50} outerRadius={60} startAngle={180} endAngle={0} dataKey="value" stroke="none">
                  <Cell fill="var(--chart-purple)" />
                  <Cell fill="var(--border-color)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center mt-8 pointer-events-none">
              <span className="text-3xl font-black" style={{ color: 'var(--chart-purple)' }}>{stats?.resources.utilization || 0}%</span>
              <span className="text-[8px] text-[var(--text-primary)] uppercase tracking-widest font-bold">LOAD</span>
            </div>
          </div>
        </motion.div>

        {/* Graph 6: Memory Volatility */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <h3 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-1">Memory Volatility</h3>
            <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest font-bold opacity-70">Requested Memory (MB)</p>
            <div className="w-6 h-[2px] mt-3 rounded-full bg-[var(--chart-magenta)] opacity-60"></div>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="magentaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-magenta)" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="var(--chart-magenta)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-magenta)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Area type="monotone" dataKey="val" stroke="var(--chart-magenta)" strokeWidth={2} fill="url(#magentaGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </div>

      {!isClient && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] uppercase tracking-widest font-black text-[var(--text-primary)]">Accepted / Allocated Details</h3>
            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">Admin View Only</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Request</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Type</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Qty</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {acceptedItems.map((r) => (
                  <tr key={r._id} className="border-b border-[var(--border-color)]/40">
                    <td className="py-2 text-[var(--text-primary)] font-mono">{String(r._id).slice(-6)}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{r.resourceType}</td>
                    <td className="py-2 text-[var(--text-primary)]">{r.quantity}</td>
                    <td className="py-2 text-[var(--chart-green)] uppercase text-[10px] tracking-widest font-bold">{r.status}</td>
                  </tr>
                ))}
                {acceptedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">No allocated records yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
