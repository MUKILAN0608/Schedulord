# Schedulord Monitoring Runbook

This monitoring stack is production-oriented and includes:

- Prometheus scrape + alerting rules
- Grafana auto-provisioned datasource and dashboard
- Enterprise dashboard: `Schedulord Enterprise Observability`

## What You Get

- **Service health**: API gateway and Go engine availability
- **Performance**: API p95, Go `/process` p95
- **Traffic**: request rate by method/endpoint
- **Reliability**: Kafka fallback rate, API 5xx ratio
- **Business outcomes**: allocation status/strategy mix

## Start Monitoring

1. Start Docker Desktop.
2. Run (Prometheus must reach **api-gateway** and **go-engine** — use the full set if dashboards stay empty):

```bash
docker compose up -d api-gateway go-engine prometheus grafana
```

After editing `prometheus.yml`, dashboard JSON, or Grafana provisioning, reload configs:

```bash
docker compose up -d --force-recreate prometheus
docker compose restart grafana
```

3. Open:
   - Prometheus: `http://localhost:9091`
   - Grafana: `http://localhost:3000`

## Grafana Login

- User: `admin`
- Password: `admin`

## Dashboard Location

In Grafana, open folder **Schedulord** and select:

- `Schedulord Enterprise Observability`

## Prometheus Targets Quick Check

Prometheus should show these targets as **UP**:

- `api-gateway:8081/metrics`
- `go-engine:9090/metrics`

## Alerts Included

From `backend/monitoring/alerts/alert.rules.yml`:

- API Gateway high p95 latency
- Go Engine `/process` high p95 latency
- High allocation rejection rate
- Kafka publish fallback events

## Final Deployment Checklist

- [ ] Prometheus UI opens on `:9091`
- [ ] Grafana UI opens on `:3000`
- [ ] Both scrape targets are UP
- [ ] Dashboard panels render data (no "N/A")
- [ ] Alerts evaluate without rule errors
- [ ] Kafka fallback panel remains near zero during stable operation
