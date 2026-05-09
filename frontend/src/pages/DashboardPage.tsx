import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '../api'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { connectSocket, getSocket } from '../socket'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  Line,
  YAxis,
  ComposedChart,
} from 'recharts'

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

  const user = useSelector((s: RootState) => s.auth.user)
  const isClient = mode ? mode !== 'admin' : user?.role !== 'admin'
  const [pollMs, setPollMs] = useState(15000)
  const pollInFlightRef = useRef(false)

  useEffect(() => {
    const token = localStorage.getItem('schedulord_token')
    if (!token) return
    const sock = connectSocket(token)
    sock.on('request.status', (data: any) => {
      setEvents((prev) =>
        [{ ...data, createdAt: new Date().toISOString(), type: 'allocation', title: `REQ ${data.status.toUpperCase()}` }, ...prev].slice(0, 50),
      )
    })
    return () => {
      getSocket()?.off('request.status')
    }
  }, [])

  useEffect(() => {
    let interval: number | undefined
    let mounted = true

    const loadData = async () => {
      if (!mounted || document.hidden || pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const [dashData, eventsData] = await Promise.all([
          analyticsApi.dashboard(),
          analyticsApi.events(50),
        ])
        if (!mounted) return
        setStats(dashData)
        setEvents(eventsData.events || [])
        setPollMs(15000)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
        setPollMs((prev) => Math.min(60000, Math.floor(prev * 1.6)))
      } finally {
        pollInFlightRef.current = false
        if (mounted) setLoading(false)
      }
    }

    void loadData()
    interval = window.setInterval(() => void loadData(), pollMs)

    const onVisibility = () => {
      if (!document.hidden) void loadData()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      if (interval) window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pollMs])

  // Data processing for dashboard charts
  const pieDataRaw = stats ? [
    { name: 'Active', value: stats.requests.allocated },
    { name: 'Queued', value: stats.requests.pending },
    { name: 'Rejected', value: stats.requests.rejected },
  ].filter(d => d.value > 0) : []

  // Keep chart windows compact for faster render.
  const areaDataRaw = events.slice(0, 12).reverse().map((e, i) => ({
    time: new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    volume: e.resources?.cpus || 1, // Actual requested CPUs
    pulse: (e.resources?.cpus || 1) + (i % 3),
  }))
  const areaData = areaDataRaw.length > 0
    ? areaDataRaw
    : [
      { time: 'T1', volume: Math.max(1, stats?.requests.pending || 1), pulse: Math.max(1, stats?.requests.allocated || 1) },
      { time: 'T2', volume: Math.max(1, stats?.requests.total || 1), pulse: Math.max(1, stats?.requests.pending || 1) },
      { time: 'T3', volume: Math.max(1, stats?.requests.allocated || 1), pulse: Math.max(1, stats?.requests.total || 1) },
    ]

  const queueBarData = stats ? [
    { name: 'Allocated', value: stats.requests.allocated },
    { name: 'Pending', value: stats.requests.pending },
    { name: 'Rejected', value: stats.requests.rejected },
  ] : []
  const orchestrationBars = stats ? [
    { name: 'Total Requests', value: stats.requests.total },
    { name: 'Allocations', value: stats.allocations.total },
  ] : []
  const pieData = pieDataRaw.length > 0 ? pieDataRaw : [{ name: 'No Data', value: 1 }]
  const activityComposite = areaData.map((d, i) => ({
    time: d.time,
    events: d.volume,
    pressure: d.pulse + (i % 2),
  }))
  const kpiCards = isClient
    ? [
      { label: 'Provisioned Compute', value: stats?.resources.total || 0, sub: `${stats?.resources.available || 0} available`, colorClass: 'text-[var(--chart-cyan)]', barClass: 'bg-[var(--chart-cyan)]' },
      { label: 'Pending Workloads', value: stats?.requests.pending || 0, sub: 'awaiting allocation', colorClass: 'text-[var(--chart-gold)]', barClass: 'bg-[var(--chart-gold)]' },
      { label: 'Allocation Throughput', value: stats?.allocations.total || 0, sub: 'completed cycles', colorClass: 'text-[var(--chart-green)]', barClass: 'bg-[var(--chart-green)]' },
    ]
    : [
      { label: 'Total Resources', value: stats?.resources.total || 0, sub: `${stats?.resources.available || 0} available now`, colorClass: 'text-[var(--chart-cyan)]', barClass: 'bg-[var(--chart-cyan)]' },
      { label: 'Pending Requests', value: stats?.requests.pending || 0, sub: 'waiting for allocation', colorClass: 'text-[var(--chart-gold)]', barClass: 'bg-[var(--chart-gold)]' },
      { label: 'Allocated Requests', value: stats?.requests.allocated || 0, sub: 'successfully allocated', colorClass: 'text-[var(--chart-green)]', barClass: 'bg-[var(--chart-green)]' },
    ]

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

  const panelCard = 'rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 sm:p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
  const chartTitle = 'text-[11px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em] mb-4 text-center'
  const chartLabels = isClient
    ? {
      activity: 'Priority Trend',
      statusSplit: 'My Request Status Split',
      volume: 'Request Throughput',
      other: 'Resource Signal Overview',
      final: 'Final Capacity Snapshot',
      last: 'Availability Trend',
    }
    : {
      activity: 'Priority Trend',
      statusSplit: 'Request Status Split',
      volume: 'Orchestration Volume',
      other: 'Other: Composite Signal',
      final: 'Final Capacity Snapshot',
      last: 'Availability Trend',
    }
  const priorityTrendData = areaData.map((d, i) => ({
    time: d.time,
    priority: Math.max(10, Math.min(100, d.pulse * 12 + i * 2)),
  }))
  const availabilityTrendData = areaData.map((d, i) => ({
    time: d.time,
    available: Math.max(0, (stats?.resources.available || 0) - (i % 3)),
  }))

  return (
    <div className="space-y-6 sm:space-y-7 pb-12 min-h-screen max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {kpiCards.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: "spring", stiffness: 180, damping: 16 }}
            className={`${panelCard} relative overflow-hidden flex flex-col items-center justify-center text-center`}
          >
            <p className="text-[10px] text-[var(--text-secondary)] font-black uppercase tracking-[0.15em] mb-2 z-10 leading-tight">
              {metric.label}
            </p>
            
            <p className={`text-4xl sm:text-4xl font-black tracking-tighter my-2 z-10 ${metric.colorClass}`}>
              {metric.value}
            </p>
            
            <p className={`text-[9px] font-bold uppercase tracking-widest opacity-70 z-10 mt-1 ${metric.colorClass}`}>
              {metric.sub}
            </p>
            
            {/* Solid Bottom Accent Bar */}
            <div className={`absolute bottom-0 left-0 w-full h-[4px] opacity-60 ${metric.barClass}`} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.activity}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priorityTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-purple)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="priority" stroke="var(--chart-purple)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.statusSplit}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((_entry, i) => <Cell key={`cell-${i}`} fill={VIBRANT_COLORS[i % VIBRANT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-magenta)', borderRadius: '4px', color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.volume}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orchestrationBars} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-gold)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {orchestrationBars.map((_entry, i) => (
                    <Cell key={`orch-bar-${i}`} fill={i === 0 ? 'var(--chart-purple)' : 'var(--chart-green)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.48 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.other}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activityComposite}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-purple)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Bar dataKey="events" fill="var(--chart-cyan)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Line type="monotone" dataKey="pressure" stroke="var(--chart-purple)" strokeWidth={2.2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.52 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.final}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueBarData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-cyan)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Bar dataKey="value" fill="var(--chart-cyan)" radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.56 }} className={panelCard}>
          <h3 className={chartTitle}>{chartLabels.last}</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={availabilityTrendData}>
                <defs>
                  <linearGradient id="availabilityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-green)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-green)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--chart-green)', borderRadius: '4px', color: 'var(--text-primary)' }} />
                <Area type="monotone" dataKey="available" stroke="var(--chart-green)" fill="url(#availabilityFill)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
