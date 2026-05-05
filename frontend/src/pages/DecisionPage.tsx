import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { analyticsApi, resourcesApi } from '../api'
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
  const [topError, setTopError] = useState('')
  const [resourceType, setResourceType] = useState('all')
  const [resourceTypes, setResourceTypes] = useState<string[]>(['all'])
  const [activeTab, setActiveTab] = useState<'prediction' | 'simulation' | 'verification'>('prediction')

  useEffect(() => {
    loadResourceTypes()
  }, [])

  useEffect(() => { loadData() }, [resourceType])

  const loadResourceTypes = async () => {
    try {
      const data = await resourcesApi.list()
      const types = Array.from(new Set((data.items || []).map((r: any) => String(r.type || '').trim()).filter(Boolean)))
      setResourceTypes(['all', ...types])
    } catch (_err) {
      setResourceTypes(['all'])
    }
  }

  const loadData = async () => {
    setLoading(true)
    setTopError('')
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
      setTopError('AI decision data is currently unavailable. Please refresh in a few seconds.')
      setPrediction({ demandSignal: 0, trend: 'stable', velocity: 0, spikeProbability: 0, method: 'fallback' })
      setSim({ scenarios: [], recommendedStrategy: 'policy-default', confidence: 0 })
    } finally {
      setLoading(false)
    }
  }

  const radarData = sim?.scenarios?.map(s => ({
    strategy: s.name,
    score: +(s.score * 100).toFixed(0),
    risk: s.risk === 'low' ? 90 : s.risk === 'medium' ? 50 : 20,
  })) || []

  const verificationChecks = [
    {
      label: 'Confidence Threshold',
      status: (allocMetrics?.averageConfidence || 0) >= 0.7,
      value: `${Math.round((allocMetrics?.averageConfidence || 0) * 100)}%`,
      target: '>= 70%',
    },
    {
      label: 'Decision Score Quality',
      status: (allocMetrics?.averageScore || 0) >= 0.65,
      value: `${Math.round((allocMetrics?.averageScore || 0) * 100)}%`,
      target: '>= 65%',
    },
    {
      label: 'Prediction Stability',
      status: (prediction?.spikeProbability || 0) <= 0.45,
      value: `${Math.round((prediction?.spikeProbability || 0) * 100)}% spike`,
      target: '<= 45%',
    },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--color-accent-secondary)] font-mono animate-pulse">Analyzing Decisions...</div></div>
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Enterprise Title */}
      <div className="flex flex-col items-center justify-center text-center border-b border-[var(--border-color)] pb-6 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] uppercase tracking-[0.15em]">Decision Intelligence</h1>
        <p className="text-[10px] md:text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.25em] font-bold mt-3">AI-driven allocation strategies, simulation, and predictions</p>
        <div className="w-16 h-[2px] bg-[#D4AF37] opacity-30 mt-4 rounded-full" />
      </div>

      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('prediction')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${activeTab === 'prediction' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>Prediction</button>
            <button onClick={() => setActiveTab('simulation')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${activeTab === 'simulation' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>Simulation</button>
            <button onClick={() => setActiveTab('verification')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border ${activeTab === 'verification' ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>Verification</button>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Resource Type" title="Resource Type" className="input-field w-56 text-sm" value={resourceType} onChange={e => setResourceType(e.target.value)}>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <button onClick={loadData} className="btn-secondary">Refresh</button>
          </div>
        </div>
      </div>
      {topError && (
        <div className="rounded border border-red-500/50 bg-red-950/60 px-4 py-3 text-sm text-red-200">{topError}</div>
      )}

      {activeTab === 'prediction' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Demand Prediction</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><p className="text-3xl font-bold text-[var(--chart-cyan)]">{prediction?.demandSignal?.toFixed(2) || '—'}</p><p className="text-xs text-[var(--text-secondary)]">Demand Signal</p></div>
            <div><p className={`text-3xl font-bold ${prediction?.trend === 'increasing' ? 'text-red-400' : prediction?.trend === 'decreasing' ? 'text-[var(--chart-green)]' : 'text-[var(--chart-purple)]'}`}>{prediction?.trend || '—'}</p><p className="text-xs text-[var(--text-secondary)]">Trend</p></div>
            <div><p className="text-xl font-bold text-[var(--chart-gold)]">{((prediction?.spikeProbability || 0) * 100).toFixed(0)}%</p><p className="text-xs text-[var(--text-secondary)]">Spike Probability</p></div>
            <div><p className="text-xl font-bold text-[var(--chart-purple)]">{prediction?.velocity?.toFixed(3) || '—'}</p><p className="text-xs text-[var(--text-secondary)]">Velocity</p></div>
          </div>
        </motion.div>
      )}

      {activeTab === 'simulation' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {sim?.scenarios?.map((sc, i) => (
              <motion.div key={sc.strategy} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 ${sc.strategy === sim.recommendedStrategy ? 'ring-1 ring-[#D4AF37]/60' : ''}`}>
                {sc.strategy === sim.recommendedStrategy && (
                  <div className="text-xs text-[var(--chart-green)] font-mono mb-2 uppercase">Recommended Strategy</div>
                )}
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{sc.name}</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-4">{sc.description}</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div><p className="text-2xl font-bold text-[var(--chart-cyan)]">{(sc.score * 100).toFixed(0)}%</p><p className="text-xs text-[var(--text-secondary)]">Score</p></div>
                  <div><p className="text-lg font-semibold text-[var(--text-primary)]">{sc.latency}</p><p className="text-xs text-[var(--text-secondary)]">Latency</p></div>
                  <div><p className={`text-lg font-semibold ${sc.risk === 'low' ? 'text-[var(--chart-green)]' : sc.risk === 'medium' ? 'text-[var(--chart-gold)]' : 'text-red-400'}`}>{sc.risk}</p><p className="text-xs text-[var(--text-secondary)]">Risk</p></div>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Strategy Comparison</h3>
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
        </>
      )}

      {activeTab === 'verification' && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Recommendation Engine Verification Box</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-5">Use this internal checklist to verify the engine is producing reliable recommendations in production.</p>
          <div className="space-y-3">
            {verificationChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between rounded border border-[var(--border-color)] px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--text-primary)] font-semibold">{check.label}</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Target {check.target}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--text-primary)] font-bold">{check.value}</p>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${check.status ? 'text-green-400' : 'text-red-400'}`}>{check.status ? 'PASS' : 'REVIEW'}</p>
                </div>
              </div>
            ))}
          </div>
          {allocMetrics && Object.keys(allocMetrics.byStrategy || {}).length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-2">Strategy Distribution</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(allocMetrics.byStrategy).map(([k, v]: any) => ({ strategy: k, count: v.count }))}>
                  <XAxis dataKey="strategy" tick={{ fill: '#636380', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#636380', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--chart-purple)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
