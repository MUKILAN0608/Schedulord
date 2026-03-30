## NeuroAlloc OS++ – Autonomous Resource Intelligence System (Backend)

Production-grade, microservice-inspired backend:

- **API Gateway**: Node.js + Express (JWT, RBAC, CRUD, WebSockets, Prometheus metrics)
- **Core Engine**: Go + Gin (event-driven processing, allocation/conflict/prediction/simulation/learning, Prometheus metrics)
- **Database**: MongoDB
- **Monitoring**: Prometheus + Grafana

### Repo layout

This repository follows the required folder structure:

- `api-gateway/`
- `go-engine/`
- `monitoring/`
- `docker/`
- `docker-compose.yml`

### Quick start (Docker)

1. Ensure Docker Desktop is running.
2. From `neuroalloc-backend/`:

```bash
docker compose up --build
```

### Services (defaults)

- **API Gateway**: `http://localhost:8080`
- **Go Engine**: `http://localhost:9090`
- **MongoDB**: `mongodb://localhost:27017/neuroalloc`
- **Prometheus**: `http://localhost:9091`
- **Grafana**: `http://localhost:3000` (admin/admin on first run)

### API docs (high level)

- Node Gateway health: `GET /health`
- Node metrics: `GET /metrics`
- Go Engine health: `GET /healthz`
- Go metrics: `GET /metrics`

### Notes

- This backend is intentionally built in phases (Node → Mongo → Go → wiring → intelligence → monitoring).
- Environment variables: copy `api-gateway/.env.example` → `api-gateway/.env`.

