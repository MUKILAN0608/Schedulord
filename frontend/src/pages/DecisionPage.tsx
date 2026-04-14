import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'

interface SimScenario {
  name: string
  strategy: string
  score: number
  latency: string
  risk: string
  description: string
}

interface SimData {
  scenarios: SimScenario[]
  recommendedStrategy: string
  confidence: number
}

interface PredictionData {
  demandSignal: number
  trend: string
  velocity: number
  spikeProbability: number
  method: string
}

export default function DecisionPage() {
  const [sim, setSim] = useState<SimData | null>(null)
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [allocMetrics, setAllocMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resourceType, setResourceType] = useState('all')

  useEffect(() => { loadData() }, [resourceType])

  const loadData = async () => {
    setLoading(true)
    try {
      const [simData, predData, allocData] = await Promise.all([
        analyticsApi.simulate(resourceType),
        analyticsApi.predict(resourceType),
        analyticsApi.allocations(),
      ])
      setSim(simData)
      setPrediction(predData)
      setAllocMetrics(allocData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const radarData = sim?.scenarios?.map(s => ({
    strategy: s.name,
    score: +(s.score * 100).toFixed(0),
    risk: s.risk === 'low' ? 90 : s.risk === 'medium' ? 50 : 20,
  })) || []

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Analyzing Decisions...</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Decision Intelligence</h1>
          <p className="text-sm text-[#636380] mt-1">AI-driven allocation strategies, simulation, and predictions</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="input-field w-48"
            placeholder="Resource type..."
            value={resourceType}
            onChange={e => setResourceType(e.target.value)}
          />
          <button onClick={loadData} className="btn-secondary">Refresh</button>
        </div>
      </div>

      {/* Simulation Scenarios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {sim?.scenarios?.map((sc, i) => (
          <motion.div
            key={sc.strategy}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card-sm stat-card p-5 ${sc.strategy === sim.recommendedStrategy ? 'glow-border ring-1 ring-[var(--color-accent-primary)]' : ''}`}
          >
            {sc.strategy === sim.recommendedStrategy && (
              <div className="text-xs text-[var(--color-neon-green)] font-mono mb-2 uppercase">✦ Recommended</div>
            )}
            <h3 className="text-base font-semibold text-white mb-1">{sc.name}</h3>
            <p className="text-xs text-[#636380] mb-4">{sc.description}</p>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-2xl font-bold text-[var(--color-accent-secondary)]">{(sc.score * 100).toFixed(0)}%</p>
                <p className="text-xs text-[#636380]">Score</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{sc.latency}</p>
                <p className="text-xs text-[#636380]">Latency</p>
              </div>
              <div>
                <p className={`text-lg font-semibold ${sc.risk === 'low' ? 'text-[var(--color-neon-green)]' : sc.risk === 'medium' ? 'text-[var(--color-neon-amber)]' : 'text-[var(--color-neon-red)]'}`}>
                  {sc.risk}
                </p>
                <p className="text-xs text-[#636380]">Risk</p>
              </div>
            </div>

            <div className="h-2 bg-[var(--color-dark-700)] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${sc.score * 100}%` }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                className="h-full rounded-full"
                style={{ background: sc.strategy === sim.recommendedStrategy ? 'linear-gradient(90deg, #6c5ce7, #00e5ff)' : 'linear-gradient(90deg, #636380, #8888a0)' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Prediction & Strategy Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prediction Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Demand Prediction</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-3xl font-bold text-[var(--color-neon-cyan)]">{prediction?.demandSignal?.toFixed(2) || '—'}</p>
              <p className="text-xs text-[#636380]">Demand Signal</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${prediction?.trend === 'increasing' ? 'text-[var(--color-neon-red)]' : prediction?.trend === 'decreasing' ? 'text-[var(--color-neon-green)]' : 'text-[var(--color-accent-secondary)]'}`}>
                {prediction?.trend === 'increasing' ? '↑' : prediction?.trend === 'decreasing' ? '↓' : '→'} {prediction?.trend || '—'}
              </p>
              <p className="text-xs text-[#636380]">Trend</p>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-neon-amber)]">{((prediction?.spikeProbability || 0) * 100).toFixed(0)}%</p>
              <p className="text-xs text-[#636380]">Spike Probability</p>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-accent-secondary)]">{prediction?.velocity?.toFixed(3) || '—'}</p>
              <p className="text-xs text-[#636380]">Velocity</p>
            </div>
          </div>
          <p className="text-xs text-[#4a4a60] font-mono">Method: {prediction?.method || 'ema-with-trend'}</p>
        </motion.div>

        {/* Strategy Radar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Strategy Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(108,92,231,0.2)" />
              <PolarAngleAxis dataKey="strategy" tick={{ fill: '#8888a0', fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: '#636380', fontSize: 10 }} domain={[0, 100]} />
              <Radar name="Score" dataKey="score" stroke="#6c5ce7" fill="#6c5ce7" fillOpacity={0.3} />
              <Radar name="Reliability" dataKey="risk" stroke="#00e676" fill="#00e676" fillOpacity={0.15} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Allocation Performance */}
      {allocMetrics && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Allocation Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-2xl font-bold text-white">{allocMetrics.totalAllocations}</p>
              <p className="text-xs text-[#636380]">Total Decisions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-neon-green)]">{(allocMetrics.averageScore * 100).toFixed(0)}%</p>
              <p className="text-xs text-[#636380]">Avg Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-neon-cyan)]">{(allocMetrics.averageConfidence * 100).toFixed(0)}%</p>
              <p className="text-xs text-[#636380]">Avg Confidence</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-accent-secondary)]">{Object.keys(allocMetrics.byStrategy || {}).length}</p>
              <p className="text-xs text-[#636380]">Strategies Used</p>
            </div>
          </div>

          {allocMetrics.byStrategy && Object.keys(allocMetrics.byStrategy).length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={Object.entries(allocMetrics.byStrategy).map(([k, v]: any) => ({ strategy: k, count: v.count, avgScore: (v.totalScore / v.count * 100).toFixed(0) }))}>
                <XAxis dataKey="strategy" tick={{ fill: '#636380', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(108,92,231,0.3)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }} />
                <Bar dataKey="count" fill="#6c5ce7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      )}
    </div>
  )
}
