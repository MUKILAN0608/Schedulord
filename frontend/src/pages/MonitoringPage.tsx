import { motion } from 'framer-motion'

const grafanaBase = (import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000').replace(/\/$/, '')
const prometheusBase = (import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9091').replace(/\/$/, '')

const links = {
  grafanaHome: grafanaBase,
  grafanaDashboard: `${grafanaBase}/d/schedulord-overview/schedulord-enterprise-observability`,
  prometheusHome: prometheusBase,
  prometheusTargets: `${prometheusBase}/targets`,
  prometheusGraph: `${prometheusBase}/graph`,
}

const panel =
  'rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 sm:p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)]'

export default function MonitoringPage() {
  return (
    <div className="max-w-5xl mx-auto pb-12 min-h-screen space-y-8">
      <div className="text-center border-b border-[var(--border-color)] pb-8">
        <p className="text-[10px] font-semibold text-[#D4AF37] tracking-[0.2em] uppercase mb-2">Operations</p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
          Prometheus &amp; Grafana
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-xl mx-auto leading-relaxed">
          Open your metrics stack in a new tab. Ensure Docker services are running{' '}
          <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
            prometheus
          </code>{' '}
          and{' '}
          <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
            grafana
          </code>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={panel}
        >
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em] mb-4">
            Grafana
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">
            Dashboards folder <span className="text-[var(--text-primary)] font-medium">Schedulord</span> —{' '}
            <span className="text-[var(--text-primary)] font-medium">Schedulord Enterprise Observability</span>.
            Default login is often <span className="font-mono text-xs">admin</span> /{' '}
            <span className="font-mono text-xs">admin</span> unless you changed it in compose.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={links.grafanaDashboard}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center px-4 py-3 rounded-lg bg-[#D4AF37] text-neutral-900 text-sm font-semibold hover:bg-[#e5c04a] transition-colors"
            >
              Open main dashboard
            </a>
            <a
              href={links.grafanaHome}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center px-4 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors"
            >
              Grafana home
            </a>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-4 font-mono break-all opacity-80">
            {links.grafanaDashboard}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06 }}
          className={panel}
        >
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em] mb-4">
            Prometheus
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5 leading-relaxed">
            Check scrape targets (API gateway and Go engine) and run ad-hoc queries. Mapped host port is usually{' '}
            <span className="font-mono text-xs">9091</span> → container <span className="font-mono text-xs">9090</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={links.prometheusTargets}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center px-4 py-3 rounded-lg bg-[#D4AF37] text-neutral-900 text-sm font-semibold hover:bg-[#e5c04a] transition-colors"
            >
              Targets status
            </a>
            <a
              href={links.prometheusGraph}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center items-center px-4 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--bg-primary)] transition-colors"
            >
              Expression browser
            </a>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-4 font-mono break-all opacity-80">
            {prometheusBase}
          </p>
        </motion.section>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
        className={`${panel} text-sm text-[var(--text-secondary)]`}
      >
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em] mb-3">
          Configure URLs (optional)
        </h3>
        <p className="leading-relaxed mb-2">
          For deployments where Grafana or Prometheus are not on localhost, set in{' '}
          <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
            frontend/.env
          </code>
          :
        </p>
        <ul className="list-disc pl-5 space-y-1 font-mono text-[12px] text-[var(--text-primary)]/90">
          <li>VITE_GRAFANA_URL={grafanaBase}</li>
          <li>VITE_PROMETHEUS_URL={prometheusBase}</li>
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
        className={`${panel} text-sm text-[var(--text-secondary)] space-y-3`}
      >
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-[0.15em]">
          If panels show “No data” or never change
        </h3>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>
            Run the full stack so Prometheus can scrape:{' '}
            <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)]">
              docker compose up -d api-gateway go-engine prometheus grafana
            </code>
          </li>
          <li>
            Open <strong className="text-[var(--text-primary)]">Targets</strong> and confirm both jobs are{' '}
            <strong className="text-[var(--text-primary)]">UP</strong> (fix config, then{' '}
            <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
              docker compose up -d --force-recreate prometheus
            </code>
            ).
          </li>
          <li>
            In Grafana, set time range to <strong className="text-[var(--text-primary)]">Last 15 minutes</strong> and use{' '}
            <strong className="text-[var(--text-primary)]">Refresh 10s</strong>. After changing dashboard JSON, restart Grafana:{' '}
            <code className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
              docker compose restart grafana
            </code>
          </li>
        </ol>
      </motion.div>
    </div>
  )
}
