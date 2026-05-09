import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, resourcesApi } from '../api'
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

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
  trained?: boolean
  dataPoints?: number
  recommendation?: string
  recommendationScore?: number
  aiScore?: number
  feasibilityScore?: number
  predictedLoad?: number
  priorityScore?: number
  decisionLog?: string[]
  error?: {
    code?: string
    message?: string
    details?: string
  }
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message
  if (typeof reason === 'string' && reason.trim()) return reason
  return 'Unknown error'
}

function parseLatencyMs(latency: string): number {
  const n = Number(String(latency || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normalizeResourceTypeLabel(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/[_\s-]+/g, '')
  if (['compute', 'cpu', 'cpus', 'generalcompute'].includes(v)) return 'Compute'
  if (['gpu', 'gpus', 'accelerated', 'accelerator', 'tpu', 'tpus'].includes(v)) return 'GPU'
  if (!raw.trim()) return ''
  return raw.trim()
}

export default function DecisionPage() {
  const [sim, setSim] = useState<SimData | null>(null)
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [allocMetrics, setAllocMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [topError, setTopError] = useState('')
  const [resourceType, setResourceType] = useState('all')
  const [resourceTypes, setResourceTypes] = useState<string[]>(['all'])
  const [activeTab, setActiveTab] = useState<'prediction' | 'simulation'>('prediction')

  useEffect(() => {
    loadResourceTypes()
  }, [])

  useEffect(() => { loadData(false) }, [resourceType])

  const loadResourceTypes = async () => {
    try {
      const data = await resourcesApi.list()
      const types = Array.from(
        new Set<string>(
          (data.items || [])
            .map((r: any) => normalizeResourceTypeLabel(String(r.type || '')))
            .filter(Boolean)
        )
      )
      setResourceTypes(['all', ...types])
    } catch (_err) {
      setResourceTypes(['all'])
    }
  }

  const loadData = async (forceBlocking = false) => {
    const shouldBlock = forceBlocking || !hasLoadedOnce
    if (shouldBlock) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setTopError('')
    try {
      const [simResult, predResult, allocResult] = await Promise.allSettled([
        analyticsApi.simulate(resourceType),
        analyticsApi.predict(resourceType),
        analyticsApi.allocations(),
      ])

      const unavailableParts: string[] = []
      const unavailableDetails: string[] = []

      if (simResult.status === 'fulfilled') {
        setSim(simResult.value)
      } else {
        console.error('Simulation API failed', simResult.reason)
        setSim(null)
        unavailableParts.push('simulation')
        unavailableDetails.push(`Simulation: ${getErrorMessage(simResult.reason)}`)
      }

      if (predResult.status === 'fulfilled') {
        setPrediction(predResult.value)
        if (predResult.value?.error?.message) {
          console.error('Prediction output warning', predResult.value.error)
          unavailableParts.push('prediction quality')
          unavailableDetails.push(`Prediction: ${predResult.value.error.message}${predResult.value.error.details ? ` (${predResult.value.error.details})` : ''}`)
        }
      } else {
        console.error('Prediction API failed', predResult.reason)
        setPrediction(null)
        unavailableParts.push('prediction')
        unavailableDetails.push(`Prediction: ${getErrorMessage(predResult.reason)}`)
      }

      if (allocResult.status === 'fulfilled') {
        setAllocMetrics(allocResult.value)
      } else {
        console.error('Allocation metrics API failed', allocResult.reason)
        setAllocMetrics(null)
        unavailableParts.push('allocation metrics')
        unavailableDetails.push(`Allocation Metrics: ${getErrorMessage(allocResult.reason)}`)
      }

      if (unavailableParts.length > 0) {
        const sectionSummary = `Live AI ${unavailableParts.join(', ')} data is currently unavailable.`
        const reasonSummary = unavailableDetails.join(' | ')
        setTopError(`${sectionSummary} ${reasonSummary}`)
      }
      setHasLoadedOnce(true)
    } catch (err) {
      console.error('Unexpected decision page load error', err)
      setTopError('Failed to load AI decision data due to an unexpected error.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const radarData = sim?.scenarios?.map(s => ({
    strategy: s.name,
    score: +(s.score * 100).toFixed(0),
    risk: s.risk === 'low' ? 90 : s.risk === 'medium' ? 50 : 20,
  })) || []

  const avgConfidence = Math.round(((allocMetrics?.averageConfidence || 0) * 100))
  const avgScore = Math.round(((allocMetrics?.averageScore || 0) * 100))
  const recommendationScore = typeof prediction?.recommendationScore === 'number'
    ? Math.round(prediction.recommendationScore * 100)
    : null
  const aiScore = typeof prediction?.aiScore === 'number'
    ? Math.round(prediction.aiScore * 100)
    : null
  const simulationConfidence = Math.round((sim?.confidence || 0) * 100)
  const demandAndRiskData = [
    { metric: 'Demand', value: Number(((prediction?.demandSignal || 0) * 100).toFixed(0)) },
    { metric: 'Spike Risk', value: Number(((prediction?.spikeProbability || 0) * 100).toFixed(0)) },
  ]
  const modelComponentData = [
    { metric: 'Feasibility', value: Number(((prediction?.feasibilityScore || 0) * 100).toFixed(0)) },
    { metric: 'Predicted Load', value: Number(((prediction?.predictedLoad || 0) * 100).toFixed(0)) },
    { metric: 'Priority', value: Number(((prediction?.priorityScore || 0) * 100).toFixed(0)) },
  ]
  const trendTimelineData = Array.from({ length: 7 }).map((_, i) => {
    const normalized = i / 6
    const baseline = prediction?.demandSignal || 0
    const velocity = prediction?.velocity || 0
    const value = Math.max(0, Math.min(1, baseline + velocity * (normalized - 0.5)))
    return {
      step: `T${i + 1}`,
      value: Number((value * 100).toFixed(0)),
    }
  })
  const simulationScoreData = (sim?.scenarios || []).map((s) => ({
    strategy: s.name,
    score: Number((s.score * 100).toFixed(0)),
  }))
  const simulationLatencyData = (sim?.scenarios || []).map((s) => ({
    strategy: s.name,
    latency: parseLatencyMs(s.latency),
  }))
  const simulationRiskData = (sim?.scenarios || []).map((s) => ({
    strategy: s.name,
    riskValue: s.risk === 'low' ? 20 : s.risk === 'medium' ? 55 : 85,
  }))
  const predictionSignalsLineData = Array.from({ length: 8 }).map((_, i) => {
    const t = i / 7
    const demand = Math.max(0, Math.min(100, ((prediction?.demandSignal || 0) * 100) + ((prediction?.velocity || 0) * 120 * (t - 0.5))))
    const risk = Math.max(0, Math.min(100, ((prediction?.spikeProbability || 0) * 100) + ((prediction?.trend === 'increasing' ? 8 : prediction?.trend === 'decreasing' ? -8 : 0) * (t - 0.5))))
    return { step: `S${i + 1}`, demand: Number(demand.toFixed(0)), risk: Number(risk.toFixed(0)) }
  })
  const predictionDonutData = [
    { name: 'AI Score', value: aiScore ?? 0, color: 'var(--chart-cyan)' },
    { name: 'Recommendation', value: recommendationScore ?? 0, color: 'var(--chart-gold)' },
    { name: 'Remaining', value: Math.max(0, 100 - (recommendationScore ?? 0)), color: 'var(--border-color)' },
  ]
  const resourcePressureData = [
    {
      metric: 'Utilization',
      value: Number(((prediction?.predictedLoad || 0) * 100).toFixed(0)),
    },
    {
      metric: 'Headroom',
      value: Number((Math.max(0, 1 - (prediction?.predictedLoad || 0)) * 100).toFixed(0)),
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Analyzing Decisions...</div></div>
  }

  const panelCard = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 md:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
  const chartCard = 'rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 md:p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
  const sectionTitle = 'text-xs md:text-sm font-black tracking-[0.14em] text-[var(--text-primary)] text-center uppercase'
  const microLabel = 'text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)] text-center font-black'

  return (
    <div className="space-y-7 md:space-y-8 pb-12">
      {/* Enterprise Title */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-7 mb-9">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Decision Intelligence</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">AI-driven allocation strategies, simulation, and predictions</p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      <div className={`${panelCard} py-4 md:py-5`}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
          <div className="grid grid-cols-2 gap-2.5 w-full max-w-[440px]">
            <button onClick={() => setActiveTab('prediction')} className={`w-full px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-150 ${activeTab === 'prediction' ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.4)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Prediction</button>
            <button onClick={() => setActiveTab('simulation')} className={`w-full px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-150 ${activeTab === 'simulation' ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_2px_10px_rgba(212,175,55,0.4)]' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Simulation</button>
          </div>
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-start lg:justify-end gap-2.5">
            <select aria-label="Resource Type" title="Resource Type" className="input-field w-full sm:w-56 text-sm rounded-xl font-semibold" value={resourceType} onChange={e => setResourceType(e.target.value)}>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button onClick={() => loadData(true)} className="btn-secondary min-w-24">Refresh</button>
            {refreshing && <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Updating...</span>}
          </div>
        </div>
      </div>
      {topError && (
        <div className="rounded border border-red-500/50 bg-red-950/60 px-4 py-3 text-sm text-red-200">{topError}</div>
      )}

      {activeTab === 'prediction' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-5 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
            <div className={panelCard}>
              <p className={microLabel}>Average Confidence</p>
              <p className="text-3xl md:text-4xl font-black text-[var(--chart-green)] mt-1 text-center leading-none">{avgConfidence}%</p>
            </div>
            <div className={panelCard}>
              <p className={microLabel}>Average Decision Score</p>
              <p className="text-3xl md:text-4xl font-black text-[var(--chart-purple)] mt-1 text-center leading-none">{avgScore}%</p>
            </div>
            <div className={panelCard}>
              <p className={microLabel}>AI Score</p>
              <p className={`text-3xl md:text-4xl font-black mt-1 text-center leading-none ${aiScore == null ? 'text-[var(--text-secondary)]' : 'text-[var(--chart-cyan)]'}`}>
                {aiScore == null ? '—' : `${aiScore}%`}
              </p>
            </div>
            <div className={panelCard}>
              <p className={microLabel}>Recommendation Score</p>
              <p className={`text-3xl md:text-4xl font-black mt-1 text-center leading-none ${recommendationScore == null ? 'text-[var(--text-secondary)]' : 'text-[var(--chart-gold)]'}`}>
                {recommendationScore == null ? '—' : `${recommendationScore}%`}
              </p>
            </div>
          </div>

          <div className={panelCard}>
            <h3 className={`${sectionTitle} mb-6`}>Demand Prediction Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
              <div className="text-center"><p className="text-3xl md:text-4xl font-black text-[var(--chart-cyan)] leading-none">{prediction?.demandSignal?.toFixed(2) || '—'}</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Demand Signal</p></div>
              <div className="text-center"><p className={`text-3xl md:text-4xl font-black leading-none ${prediction?.trend === 'increasing' ? 'text-[var(--chart-gold)]' : prediction?.trend === 'decreasing' ? 'text-[var(--chart-green)]' : 'text-[var(--chart-purple)]'}`}>{prediction?.trend || '—'}</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Trend</p></div>
              <div className="text-center"><p className="text-3xl md:text-4xl font-black text-[var(--chart-gold)] leading-none">{((prediction?.spikeProbability || 0) * 100).toFixed(0)}%</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Spike Probability</p></div>
              <div className="text-center"><p className="text-3xl md:text-4xl font-black text-[var(--chart-purple)] leading-none">{prediction?.velocity?.toFixed(3) || '—'}</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Velocity</p></div>
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center"><p className="text-2xl md:text-3xl font-black text-[var(--chart-green)] leading-none">{((prediction?.feasibilityScore || 0) * 100).toFixed(0)}%</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Feasibility</p></div>
              <div className="text-center"><p className="text-2xl md:text-3xl font-black text-[var(--chart-cyan)] leading-none">{((prediction?.predictedLoad || 0) * 100).toFixed(0)}%</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Predicted Load</p></div>
              <div className="text-center"><p className="text-2xl md:text-3xl font-black text-[var(--chart-gold)] leading-none">{((prediction?.priorityScore || 0) * 100).toFixed(0)}%</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] mt-1">Priority Score</p></div>
            </div>
          </div>

          <div className={panelCard}>
            <h3 className={`${sectionTitle} mb-6`}>Demand Prediction Graphs</h3>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
            <div className={chartCard}>
              <p className={`${microLabel} mb-2`}>Demand vs Spike Risk</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={demandAndRiskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--chart-cyan)" radius={[6, 6, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={chartCard}>
              <p className={`${microLabel} mb-2`}>Model Components</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={modelComponentData} barCategoryGap="24%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--chart-gold)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={chartCard}>
              <p className={`${microLabel} mb-2`}>Trend Timeline</p>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={trendTimelineData}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-purple)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--chart-purple)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="step" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="value" stroke="var(--chart-purple)" fill="url(#trendFill)" strokeWidth={2} />
                  <Line type="monotone" dataKey="value" stroke="var(--chart-purple)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </div>
            <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
              <div className={chartCard}>
                <p className={`${microLabel} mb-2`}>Signal Blend Area</p>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={predictionSignalsLineData}>
                    <defs>
                      <linearGradient id="demandBlend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-cyan)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--chart-cyan)" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="riskBlend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-gold)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-gold)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="step" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="demand" stroke="var(--chart-cyan)" fill="url(#demandBlend)" strokeWidth={2} />
                    <Area type="monotone" dataKey="risk" stroke="var(--chart-gold)" fill="url(#riskBlend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className={chartCard}>
                <p className={`${microLabel} mb-2`}>AI Recommendation Ring</p>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                    <Pie
                      data={predictionDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={66}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {predictionDonutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={chartCard}>
                <p className={`${microLabel} mb-2`}>Resource Pressure Bars</p>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={resourcePressureData} layout="vertical" margin={{ left: 12, right: 12, top: 4, bottom: 4 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                    <Bar dataKey="value" fill="var(--chart-purple)" radius={[0, 6, 6, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'simulation' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            <div className={panelCard}>
              <p className={microLabel}>Recommended Strategy</p>
              <p className="text-2xl md:text-3xl font-black text-[var(--chart-green)] mt-1 text-center">{sim?.recommendedStrategy || '—'}</p>
            </div>
            <div className={panelCard}>
              <p className={microLabel}>Simulation Confidence</p>
              <p className="text-2xl md:text-3xl font-black text-[var(--chart-cyan)] mt-1 text-center">{simulationConfidence}%</p>
            </div>
            <div className={panelCard}>
              <p className={microLabel}>Scenarios Evaluated</p>
              <p className="text-2xl md:text-3xl font-black text-[var(--chart-gold)] mt-1 text-center">{sim?.scenarios?.length || 0}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
            {sim?.scenarios?.map((sc, i) => (
              <motion.div key={sc.strategy} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, delay: i * 0.02 }} className={`${panelCard} ${sc.strategy === sim.recommendedStrategy ? 'ring-1 ring-[#D4AF37]/60 shadow-[0_0_0_1px_rgba(212,175,55,0.35)]' : ''}`}>
                {sc.strategy === sim.recommendedStrategy && (
                  <div className="text-xs text-[var(--chart-green)] font-mono mb-2 uppercase">Recommended Strategy</div>
                )}
                <h3 className="text-base font-black tracking-wide text-[var(--text-primary)] mb-1 text-center">{sc.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-4 text-center">{sc.description}</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center"><p className="text-2xl font-black text-[var(--chart-cyan)]">{(sc.score * 100).toFixed(0)}%</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Score</p></div>
                  <div className="text-center"><p className="text-lg font-black text-[var(--text-primary)]">{sc.latency}</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Latency</p></div>
                  <div className="text-center"><p className={`text-lg font-black ${sc.risk === 'low' ? 'text-[var(--chart-green)]' : sc.risk === 'medium' ? 'text-[var(--chart-gold)]' : 'text-[var(--text-primary)]'}`}>{sc.risk}</p><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Risk</p></div>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className={panelCard}>
            <h3 className={`${sectionTitle} mb-2`}>Strategy Comparison</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4 text-center">Score and reliability balance across simulated strategies.</p>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="strategy" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} domain={[0, 100]} />
                <Radar name="Score" dataKey="score" stroke="var(--chart-purple)" fill="var(--chart-purple)" fillOpacity={0.3} />
                <Radar name="Reliability" dataKey="risk" stroke="var(--chart-green)" fill="var(--chart-green)" fillOpacity={0.15} />
                <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={panelCard}>
              <h3 className={`${sectionTitle} mb-3`}>Score Ranking</h3>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={simulationScoreData} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="strategy" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="score" fill="var(--chart-purple)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={panelCard}>
              <h3 className={`${sectionTitle} mb-3`}>Latency Comparison</h3>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={simulationLatencyData} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="strategy" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => `${Number(v || 0)} ms`} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="latency" fill="var(--chart-cyan)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className={panelCard}>
              <h3 className={`${sectionTitle} mb-3`}>Risk Profile</h3>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={simulationRiskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="strategy" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => {
                    const n = Number(v || 0)
                    return n <= 35 ? 'low' : n <= 70 ? 'medium' : 'high'
                  }} contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="riskValue" stroke="var(--chart-green)" strokeWidth={2} dot={{ fill: 'var(--chart-green)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </>
      )}

    </div>
  )
}
