import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '../api'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'

function normalizeTypeLabel(raw: string): string {
  const v = String(raw || '').trim().toLowerCase().replace(/[_\s-]+/g, '')
  if (!v) return ''
  if (['compute', 'cpu', 'cpus', 'generalcompute'].includes(v)) return 'Compute'
  if (['gpu', 'gpus', 'accelerated', 'accelerator', 'tpu', 'tpus'].includes(v)) return 'GPU'
  return String(raw || '').trim()
}

function compactNumber(value: unknown): string {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function safeUtilizationPercent(item: any): number {
  const totalCapacity = Number(item?.totalCapacity || 0)
  const usedCapacity = Number(item?.usedCapacity || 0)
  const allocated = Number(item?.allocated || 0)
  const available = Number(item?.available || 0)
  const totalUnits = allocated + available

  const capacityPct = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : NaN
  if (Number.isFinite(capacityPct) && capacityPct >= 0 && capacityPct <= 100) {
    return clampPercent(capacityPct)
  }

  // Fallback to unit utilization when capacity fields are in incompatible scale.
  if (totalUnits > 0) {
    return clampPercent((allocated / totalUnits) * 100)
  }

  return 0
}

export default function AnalyticsPage() {
  const [utilization, setUtilization] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'capacity' | 'demand'>('overview')
  const [selectedType, setSelectedType] = useState<string>('all')
  const utilizationByType = Object.values(
    utilization.reduce((acc: Record<string, any>, u: any) => {
      const key = normalizeTypeLabel(u.type)
      if (!key) return acc
      if (!acc[key]) acc[key] = { type: key, total: 0, allocated: 0, available: 0, totalCapacity: 0, usedCapacity: 0, availableCapacity: 0 }
      acc[key].total += Number(u.total || 0)
      acc[key].allocated += Number(u.allocated || 0)
      acc[key].available += Number(u.available || 0)
      acc[key].totalCapacity += Number(u.totalCapacity || 0)
      acc[key].usedCapacity += Number(u.usedCapacity || 0)
      acc[key].availableCapacity += Number(u.availableCapacity || 0)
      return acc
    }, {})
  )
  const resourceTypeOptions = ['all', ...utilizationByType.map((u: any) => u.type)]
  const scopedUtilizationByType = selectedType === 'all'
    ? utilizationByType
    : utilizationByType.filter((u: any) => u.type === selectedType)
  const totalResources = scopedUtilizationByType.reduce((sum: number, u: any) => sum + Number(u.total || 0), 0)
  const totalAllocated = scopedUtilizationByType.reduce((sum: number, u: any) => sum + Number(u.allocated || 0), 0)
  const totalAvailable = scopedUtilizationByType.reduce((sum: number, u: any) => sum + Number(u.available || 0), 0)
  const utilizationPercents = scopedUtilizationByType.map((u: any) => safeUtilizationPercent(u))
  const avgUtilization = utilizationPercents.length > 0
    ? Math.round(utilizationPercents.reduce((sum: number, v: number) => sum + v, 0) / utilizationPercents.length)
    : 0
  const peakUtilization = utilizationPercents.length > 0
    ? Math.round(Math.max(...utilizationPercents))
    : 0
  const latestTrend = trends.length > 0 ? trends[trends.length - 1] : null
  const weeklyRequests = trends.reduce((sum, t) => sum + Number(t.requests || 0), 0)
  const avgPriority7d = trends.length > 0
    ? Math.round(trends.reduce((sum, t) => sum + Number(t.avgPriority || 0), 0) / trends.length)
    : 0
  const usageByType = scopedUtilizationByType.map((u: any) => ({
    type: u.type,
    usagePct: Number(safeUtilizationPercent(u).toFixed(0)),
    availablePct: Number((100 - safeUtilizationPercent(u)).toFixed(0)),
  }))
  const capacityRadarData = usageByType.map((u) => ({
    metric: u.type,
    used: u.usagePct,
    free: u.availablePct,
  }))
  const trendIntensity = trends.map((t: any) => ({
    date: t.date,
    requests: Number(t.requests || 0),
    qty: Number(t.totalQty || 0),
    priority: Number(t.avgPriority || 0),
  }))
  const maxReqTrend = Math.max(1, ...trendIntensity.map((t) => t.requests))
  const maxQtyTrend = Math.max(1, ...trendIntensity.map((t) => t.qty))
  const overviewCompositeData = trendIntensity.map((t) => ({
    date: t.date,
    reqNorm: Number(((t.requests / maxReqTrend) * 100).toFixed(0)),
    qtyNorm: Number(((t.qty / maxQtyTrend) * 100).toFixed(0)),
  }))
  const demandScatterData = trendIntensity.map((t) => ({
    requests: t.requests,
    qty: t.qty,
    priority: t.priority,
    date: t.date,
  }))
  const allocSplit = scopedUtilizationByType.map((u: any) => ({
    type: u.type,
    allocated: Number(u.allocated || 0),
    available: Number(u.available || 0),
  }))
  const capacityShareData = scopedUtilizationByType.map((u: any) => ({
    name: u.type,
    value: Number(u.allocated || 0),
  }))
  const demandShareData = trendIntensity
    .slice(-6)
    .map((t) => ({ name: t.date, value: t.qty }))
    .filter((t) => t.value > 0)
  const loadTrendData = trends.map((t: any) => ({
    date: t.date,
    requests: Number(t.requests || 0),
    qty: Number(t.totalQty || 0),
    priority: Number(t.avgPriority || 0),
  }))
  const maxReq = Math.max(1, ...loadTrendData.map((d) => d.requests))
  const maxQty = Math.max(1, ...loadTrendData.map((d) => d.qty))
  const demandSignalData = loadTrendData.map((d) => ({
    date: d.date,
    signal: Number((((d.requests / maxReq) * 55) + ((d.qty / maxQty) * 35) + ((d.priority / 5) * 10)).toFixed(0)),
  }))
  const allocationCountByType = scopedUtilizationByType.map((u: any) => ({
    type: u.type,
    count: Number(u.allocated || 0),
  }))
  const availabilityCountByType = scopedUtilizationByType.map((u: any) => ({
    type: u.type,
    count: Number(u.available || 0),
  }))
  const utilizationPercentArea = scopedUtilizationByType.map((u: any) => ({
    type: u.type,
    usedPct: Number(safeUtilizationPercent(u).toFixed(0)),
  }))
  const overviewMixData = [
    { name: 'Allocated', value: totalAllocated },
    { name: 'Available', value: totalAvailable },
  ]
  const PIE_COLORS = ['var(--chart-cyan)', 'var(--chart-gold)', 'var(--chart-purple)', 'var(--chart-green)', 'var(--text-secondary)', '#D4AF37']
  const graphCard = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
  const graphTitle = 'text-xs md:text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)] text-center mb-3'

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [utilData, trendData] = await Promise.all([
        analyticsApi.utilization(),
        analyticsApi.demandTrends().catch(() => ({ trends: [] })),
      ])
      setUtilization(utilData.utilization || [])

      // Aggregate trend data by date
      const byDate: Record<string, any> = {}
      for (const t of (trendData.trends || [])) {
        const date = t._id?.date || 'unknown'
        if (!byDate[date]) byDate[date] = { date, requests: 0, avgPriority: 0, totalQty: 0, count: 0 }
        byDate[date].requests += t.count
        byDate[date].avgPriority += t.avgPriority * t.count
        byDate[date].totalQty += t.totalQuantity
        byDate[date].count += t.count
      }
      const trendArr = Object.values(byDate).map((d: any) => ({
        ...d,
        avgPriority: d.count > 0 ? (d.avgPriority / d.count).toFixed(0) : 0,
      }))
      setTrends(trendArr)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Loading Analytics...</div></div>
  }

  return (
    <div className="space-y-7 pb-12">
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-7 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Analytics Dashboard</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">Resource utilization, demand trends, and system insights</p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 md:p-5 shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-3">
          <div className="grid grid-cols-3 gap-3 w-full max-w-[620px]">
            <button onClick={() => setActiveTab('overview')} className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-150 ${activeTab === 'overview' ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.35)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Overview</button>
            <button onClick={() => setActiveTab('capacity')} className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-150 ${activeTab === 'capacity' ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.35)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Capacity</button>
            <button onClick={() => setActiveTab('demand')} className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-150 ${activeTab === 'demand' ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.35)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Demand</button>
          </div>
          <select
            aria-label="Resource Type Filter"
            title="Resource Type Filter"
            className="input-field w-full lg:w-52 rounded-xl text-sm font-semibold"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {resourceTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Resources' : type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 md:gap-5">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-black">Total Resources</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-cyan)] mt-2">{totalResources}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-black">Allocated Units</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-gold)] mt-2">{totalAllocated}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-black">Average Utilization</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-purple)] mt-2">{avgUtilization}%</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-black">Available Units</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-green)] mt-2">{totalAvailable}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] font-black">Peak Utilization</p>
          <p className="text-3xl md:text-4xl font-black text-[var(--chart-cyan)] mt-2">{peakUtilization}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {activeTab === 'overview' && (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Allocation Overview</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={allocationCountByType} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-gold)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Demand Composite</h3>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={overviewCompositeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="qtyNorm" fill="var(--chart-purple)" radius={[6, 6, 0, 0]} maxBarSize={24} />
                  <Line type="monotone" dataKey="reqNorm" stroke="var(--chart-cyan)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Resource Mix</h3>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Pie data={overviewMixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} innerRadius={42} paddingAngle={2}>
                    {overviewMixData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Demand Signal</h3>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={demandSignalData}>
                  <defs>
                    <linearGradient id="demandSignalOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-purple)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-purple)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="signal" stroke="var(--chart-purple)" fill="url(#demandSignalOverview)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}

        {activeTab === 'capacity' && (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Allocated by Type</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={allocationCountByType} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v)} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-gold)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Available by Type</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={availabilityCountByType} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v)} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-green)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Capacity Balance Radar</h3>
              <ResponsiveContainer width="100%" height={190}>
                <RadarChart data={capacityRadarData}>
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Radar dataKey="used" stroke="var(--chart-purple)" fill="var(--chart-purple)" fillOpacity={0.25} />
                  <Radar dataKey="free" stroke="var(--chart-green)" fill="var(--chart-green)" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Capacity Share</h3>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Pie data={capacityShareData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} innerRadius={42} paddingAngle={2}>
                    {capacityShareData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}

        {activeTab === 'demand' && (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Requests by Day</h3>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={trendIntensity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v)} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="requests" stroke="var(--chart-cyan)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Load Signal</h3>
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={demandSignalData}>
                  <defs>
                    <linearGradient id="loadSignalDemand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-cyan)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-cyan)" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Area type="monotone" dataKey="signal" stroke="var(--chart-cyan)" fill="url(#loadSignalDemand)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Quantity by Day</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={trendIntensity} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => compactNumber(v)} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="qty" fill="var(--chart-gold)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={graphCard}>
              <h3 className={graphTitle}>Demand Correlation</h3>
              <ResponsiveContainer width="100%" height={190}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" dataKey="requests" name="Requests" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="qty" name="Quantity" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => compactNumber(v)} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Scatter data={demandScatterData} fill="var(--chart-gold)" />
                </ScatterChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${graphCard} xl:col-span-1`}>
            <h3 className={graphTitle}>Demand Composite Trend (Large)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={demandSignalData}>
                <defs>
                  <linearGradient id="overviewLargeSignal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-cyan)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-cyan)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                <Area type="monotone" dataKey="signal" stroke="var(--chart-cyan)" fill="url(#overviewLargeSignal)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${graphCard} xl:col-span-1`}>
            <h3 className={graphTitle}>Resource Utilization Comparison (Large)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={usageByType} barCategoryGap="26%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                <Bar dataKey="usagePct" name="Used %" fill="var(--chart-purple)" radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="availablePct" name="Available %" fill="var(--chart-green)" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  )
}
