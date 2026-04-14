import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'

export default function AnalyticsPage() {
  const [utilization, setUtilization] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <p className="text-sm text-[#636380] mt-1">Resource utilization, demand trends, and system insights</p>
      </div>

      {/* Resource Utilization */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Resource Utilization by Type</h3>
        {utilization.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilization} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,92,231,0.1)" />
                <XAxis dataKey="type" tick={{ fill: '#636380', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8888a0' }} />
                <Bar dataKey="total" name="Total" fill="#6c5ce7" radius={[6, 6, 0, 0]} />
                <Bar dataKey="available" name="Available" fill="#00e676" radius={[6, 6, 0, 0]} />
                <Bar dataKey="allocated" name="Allocated" fill="#ffab40" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
              {utilization.map((u, i) => (
                <motion.div
                  key={u.type}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="glass-card-sm p-4 text-center"
                >
                  <p className="text-xs text-[#636380] uppercase font-mono mb-1">{u.type}</p>
                  <p className="text-2xl font-bold text-[var(--color-accent-secondary)]">
                    {u.totalCapacity > 0 ? ((u.usedCapacity / u.totalCapacity) * 100).toFixed(0) : 0}%
                  </p>
                  <p className="text-xs text-[#636380] mt-1">Capacity Usage</p>
                  <div className="h-1.5 bg-[var(--color-dark-700)] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${u.totalCapacity > 0 ? (u.usedCapacity / u.totalCapacity) * 100 : 0}%`,
                        background: 'linear-gradient(90deg, #6c5ce7, #00e5ff)',
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-[#636380]">No utilization data available. Create resources and submit requests first.</div>
        )}
      </motion.div>

      {/* Demand Trends */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Demand Trends (Last 7 Days)</h3>
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(108,92,231,0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#8888a0' }} />
              <Line type="monotone" dataKey="requests" name="Requests" stroke="#6c5ce7" strokeWidth={2} dot={{ fill: '#6c5ce7', r: 4 }} />
              <Line type="monotone" dataKey="totalQty" name="Total Quantity" stroke="#00e5ff" strokeWidth={2} dot={{ fill: '#00e5ff', r: 4 }} />
              <Line type="monotone" dataKey="avgPriority" name="Avg Priority" stroke="#ffab40" strokeWidth={2} dot={{ fill: '#ffab40', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-[#636380]">No trend data available. Requests from the last 7 days will appear here.</div>
        )}
      </motion.div>

      {/* System Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">System Architecture</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API Gateway', status: 'active', tech: 'Node.js + Express' },
            { label: 'Processing Engine', status: 'active', tech: 'Golang + Gin' },
            { label: 'Event Stream', status: 'active', tech: 'Apache Kafka' },
            { label: 'Database', status: 'active', tech: 'MongoDB' },
            { label: 'Cache Layer', status: 'active', tech: 'Redis' },
            { label: 'Metrics', status: 'active', tech: 'Prometheus' },
            { label: 'Dashboards', status: 'active', tech: 'Grafana' },
            { label: 'Real-time', status: 'active', tech: 'Socket.IO' },
          ].map((svc, i) => (
            <motion.div
              key={svc.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              className="glass-card-sm p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[var(--color-neon-green)]" />
                <span className="text-sm font-medium text-white">{svc.label}</span>
              </div>
              <p className="text-xs text-[#636380] font-mono">{svc.tech}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
