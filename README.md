# Schedulord — Enterprise Resource Allocation & Decision Intelligence Platform

Distributed, admin-gated GPU/CPU (and broader) allocation with an event-driven backbone, Redis-backed caching, a Go core engine that runs a **dataset-trained** AI support pipeline end-to-end in Go (no Python), and operational monitoring via Prometheus and Grafana.

## Architecture

```
Frontend (React + TypeScript)
       ↓
Node.js API Gateway (REST, JWT/RBAC, WebSockets, Kafka producer)
       ↓
Apache Kafka (allocation request / result topics)
       ↓
Go Core Engine (Kafka consumer + allocation + aisupport ML pipeline)
       ↓
MongoDB (persistent state) + Redis (cache layer)
       ↓
WebSocket broadcasts → realtime UI updates
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind CSS, Framer Motion, Recharts, Socket.IO client, Redux Toolkit, Zod (client validation where used), Three.js (@react-three/fiber, drei) |
| API Gateway | Node.js, Express, JWT + RBAC, Mongoose, KafkaJS (non-fatal producer failures with fallback paths), Redis (ioredis), Zod validation, Morgan request logging |
| Core Engine | Go (Gin), Kafka consumer/producer patterns, aisupport ML (trained on repo CSV), greedy allocation orchestration |
| Streaming | Apache Kafka |
| Database | MongoDB |
| Cache | Redis |
| Monitoring | Prometheus, Grafana (`backend/monitoring/`) |
| Delivery | Docker, Docker Compose |

## Repository layout

```
schedulord/
├── frontend/                   # Operator & client UI
├── backend/
│   ├── api-gateway/           # Express API, Kafka producer, sockets
│   ├── go-engine/             # Allocation engine + aisupport package
│   ├── kafka/                 # Broker-oriented config/scripts (as applicable)
│   └── monitoring/            # Prometheus, Grafana dashboards, alerts, runbook
├── docker/
├── docker-compose.yml
├── schedulord_research_dataset_12000.csv   # Training/eval dataset for Go aisupport models
└── README.md
```

## Quick start (Docker Compose)

```bash
docker compose up --build
```

Typical local URLs (see `docker-compose.yml` if ports differ in your overlay):

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| API Gateway | http://localhost:8080 |
| Go engine metrics/health | (host port mapped in compose — often 9090) |
| Grafana | http://localhost:3000 (`admin` / `admin` unless overridden) |
| Prometheus | http://localhost:9091 |

## Features — completed vs pending

Below is an honest rollup of **what ships in this repository today** versus **remaining gaps / operational caveats**.

### ✅ Completed / implemented (repository)

**Platform & workflows**

- **Microservices topology**: Separate Node API Gateway and Go allocation engine wired through Kafka (`schedulord` topics) with Mongo persistence and Redis cache usage for hot read paths (e.g. resources).
- **Strict admin gate on allocation automation**: Allocation engine processing targets **admin-approved** work items; Kafka publish occurs on explicit approval pathways (requests are **not** auto-streamed into the engine as approvals).
- **Client resource catalog**: Operators can inspect available inventory and associate a **preferred resource** when creating a request.
- **Approver routing**: Clients designate the **reviewing admin** (`reviewerAdminId`) for a request lifecycle.
- **Admin-only destructive actions**: Reject semantics are constrained to privilege rules (assigned admin rejects; non-admin impersonation prevented by RBAC on routes).
- **Rejection reasons**: Persisted rejection reasons surfaced in the UI with deliberate placement (**reason above the rejection bar** on relevant request views).

**Isolation & tenancy**

- **Role-scoped dashboards and navigation**: Admin vs client navigation and pages are differentiated (examples: Admin Resources, Admin Request Decisions, dedicated admin tooling vs client flows).
- **Request visibility controls**: Listing routes align with reviewer assignment for admin-facing queues/history variants; owning users see appropriate scopes for “my requests” patterns.

**API quality**

- **Zod request validation**: Request creation and related payloads validated via Zod (replacing Joi in the audited paths).
- **Morgan visibility**: Structured HTTP visibility via Morgan (`combined` style) integrated at the gateway.
- **Resilient Kafka producer behavior**: Producer errors are handled so transient broker issues degrade gracefully with operational logging (does not intentionally hard-crash the entire gateway process solely on producer failure classes that are caught by the integration layer).

**Go engine — Decision support (AISupport)**

- **In-process ML pipeline in Go**: Feasibility (logistic regression), load model (ensemble / tree-style stack per implementation), neural priority scorer (Gorgonia-based pathway in module), fused with **deterministic greedy allocation** ensuring conflict avoidance and pragmatic utilization posture.
- **Training strictly tied to dataset**: AISupport initializes from **`schedulord_research_dataset_12000.csv`**; heuristic/random “fake AI” shortcuts have been deliberately removed — **startup requires the CSV and successful training hydrate path** (`NewTrainedPipelineFromDataset`), otherwise the binary panics loudly (fail-fast to avoid silently serving nonsense).
- **Dataset shipping**: CSV is tracked in-repo for reproducible builds and onboarding (see Dockerfile copy steps for containers).

**Operational monitoring**

- **Prometheus scraping** (gateway + Go metrics exporters as exposed in codebases).
- **Grafana dashboards**: Enterprise-oriented “Schedulord Enterprise Observability” style dashboard JSON under `backend/monitoring/grafana/dashboards/`.
- **Runbook**: `backend/monitoring/README.md` outlines how to validate targets, Grafana entry, checklist items pre-production.

**Frontend UX**

- **Analytics redesign**: KPI-style overview with tabbed sub-areas (“internal decision box” motif) separating utilization vs demand vs insights narratives.
- **Decision Intelligence UX**: Dedicated tabs for Prediction / Simulation / Verification; resource-type **dropdown** derives from backend resource inventory; centered page titles across admin-heavy surfaces where refactored; top-of-page banners for upstream AI errors instead of pop-up-only patterns.
- **Landing / hero**: Sovereign Three.js viewport with HEAD check for **`/dream_computer_setup.glb`** and explicit messaging if asset missing.

**Operational convenience**

- **Admin database maintenance endpoint**: Capability to purge all requests collections via protected API route class patterns (paired with authenticated admin workflows in gateway — see controllers/routes for exact permissioning).

---

### ⚠️ Incomplete / pending / environment-dependent caveats

These items are either **explicitly unfinished**, **outside repo control**, or **known to fluctuate per machine**:

- **Landing 3D asset**: `/dream_computer_setup.glb` must physically exist under `frontend/public/`; the UI will render a graceful error panel when absent (asset not bundled if you omit it locally).
- **Atlas / Mongo network reachability**: Some developer networks block SRV lookups or egress to Atlas; gateways fail fast with Mongo connection errors unrelated to Schedulord business logic correctness.
- **Front-end production build intermittency**: Rare low-memory allocations during `vite build`/TS-heavy compilation have been observed on constrained Windows hosts — prefer CI or raise Node heap if you hit sporadic allocator failures locally.
- **Docker Desktop friction (Windows host)**: Long-running Compose sessions can sporadically hang if the daemon is unhealthy; restarting Docker Desktop clears many classes of stuck pulls/up cycles.
- **Go dependency / runtime nuance**: Some transitive ML stacks flagged `assume-no-moving-gc` ergonomics historically; mitigation may require explicit env toggles documented in engine runtime notes (`ASSUME_NO_MOVING_GC_UNSAFE_RISK_IT_WITH`-style escapes) until dependency trees fully align with bleeding-edge Go toolchain moves—**confirm in CI with your pinned Go toolchain**.
- **Full end-to-end test harness**: Dedicated cross-service integration tests covering Kafka-brownout timings, deterministic ML scoring drift thresholds, and WebSocket reconciliation under partition leadership changes are aspirational—not yet committed as exhaustive CI gates.
- **Global admin analytics fidelity**: Extremely strict tenant carve-outs occasionally leave partial chart population scenarios that should be iterated with richer synthetic fixtures.

## Default credentials / secrets

⚠️ **Rotate before any real deployment.**

- Bootstrap admin seeds (adjust in your infra story): historically `admin@schedulord.local` / `ChangeMe123!` (see provisioning scripts/controllers).
- Grafana defaults often `admin` / `admin` — bind behind OAuth/reverse-proxy in prod.

## High-level lifecycle (conceptual)

1. Client submits a request with metadata + reviewer admin + preferred resource.
2. Request enters **pending** admin queue for the assigned reviewer.
3. Approved items become eligible for **engine-side processing** streams (Kafka + background processors align on flags like `adminApproved`).
4. Go engine merges **rules + greedy posture + AISupport artifacts** → publishes outcomes / persists via Kafka → gateway reconciles Mongo + broadcasts UI signals.

See service-specific README fragments under `backend/monitoring/README.md` and inline code comments near `requestProcessor.js` / `allocation.go`.

## Contributing / shipping workflow

Branch, open PRs, run unit-level checks locally when possible (`go test ./...`, `npm test`/lint fronts), and compose-smoke infra slices before tagging releases.

## License / academic use

Clarify your licensing intent before redistributing the dataset amalgamation or pretrained numeric artifacts externally.
