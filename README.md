# SCHEDULORD â€” Autonomous Distributed Resource Orchestration & Decision Intelligence Platform

A production-grade, enterprise-level distributed system that continuously processes allocation events in real time, simulates multiple decision scenarios, automatically resolves conflicts, and predicts future demand.

## Architecture

```
Frontend (React Control Interface)
       â†“
Node.js API Gateway (Request Handling Layer)
       â†“
Apache Kafka (Event Streaming Backbone)
       â†“
Golang Core Engine (Concurrent Processing System)
       â†“
MongoDB (Persistent Storage) + Redis (Cache Layer)
       â†“
WebSocket Layer â†’ Real-time UI Updates
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript, Tailwind CSS, Framer Motion, Recharts, Socket.IO Client, Redux Toolkit |
| API Gateway | Node.js, Express.js, JWT + RBAC, Socket.IO, Kafka Producer |
| Core Engine | Go (Gin), Goroutines, Channels, Kafka Consumer |
| Event Streaming | Apache Kafka |
| Database | MongoDB (Mongoose) |
| Cache | Redis |
| Monitoring | Prometheus, Grafana |
| DevOps | Docker, Docker Compose |

## Folder Structure

```
schedulord/
├── frontend/          # React TypeScript control interface
├── backend/
│   ├── api-gateway/   # Node.js Express API layer
│   ├── go-engine/     # Golang concurrent processing engine
│   ├── kafka/         # Kafka configuration
│   └── monitoring/    # Prometheus, Grafana, alerts
├── docker/            # Dockerfiles
├── docker-compose.yml # Full orchestration
└── README.md
```

## Quick Start

```bash
# Start all services
docker-compose up --build

# Access points
# Frontend:    http://localhost:3001
# API Gateway: http://localhost:8080
# Grafana:     http://localhost:3000 (admin/admin)
# Prometheus:  http://localhost:9091
```

## Default Credentials

- **Admin**: admin@schedulord.local / ChangeMe123!
- **Grafana**: admin / admin

## Core Modules

1. **Authentication System** â€” JWT-based auth with RBAC (Admin/User)
2. **Resource Management** â€” CRUD with availability tracking
3. **Event-Driven Allocation** â€” Kafka-powered event streaming
4. **Intelligent Allocation Engine** â€” Priority-based scoring with confidence
5. **Conflict Resolution Engine** â€” Queue-based scheduling
6. **Simulation Engine** â€” Multi-strategy scenario comparison
7. **Prediction Engine** â€” EMA-based demand forecasting
8. **Adaptive Learning Module** â€” Feedback-driven optimization

## Event Flow

1. User submits allocation request â†’ Node API
2. API publishes event to Kafka topic `schedulord.allocation.requests`
3. Go engine consumes event asynchronously
4. Engine processes allocation, simulation, conflict resolution
5. Go engine publishes result to Kafka topic `schedulord.allocation.results`
6. Node API consumes result, updates database, emits WebSocket for real-time UI updates

## Current Status: Working vs In Progress

### âœ… Working Features
- **Sovereign Gateway Authentication Portal**: High-end responsive UI with obsidian aesthetic.
- **Secure Identity Management**: JWT-based auth with RBAC (Admin/User) and strict multi-tenant data isolation.
- **Event-Driven Orchestration**: Kafka-powered event streaming and asynchronous processing using the Golang core engine.
- **Allocation Queuing**: Requests persist in a "pending" queue when capacity is insufficient instead of auto-rejecting.
- **Tenant-scoped Analytics**: API Gateway controllers and Kafka consumers correctly filter data based on user identity.

### âš™ï¸ In Progress / Known Issues
- **Administrative Global Analytics**: Global system charts for authorized administrative users may experience population issues due to strict multi-tenant isolation.
- **Build-Time Memory Failures**: Addressing orchestration build-time resource limits during heavy concurrent loads.
- **Advanced Decision Intelligence Simulation**: Some simulation and prediction scenarios require further refinement for scale.
