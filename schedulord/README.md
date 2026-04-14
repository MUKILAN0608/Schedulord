# SCHEDULORD — Autonomous Distributed Resource Orchestration & Decision Intelligence Platform

A production-grade, enterprise-level distributed system that continuously processes allocation events in real time, simulates multiple decision scenarios, automatically resolves conflicts, and predicts future demand.

## Architecture

```
Frontend (React Control Interface)
       ↓
Node.js API Gateway (Request Handling Layer)
       ↓
Apache Kafka (Event Streaming Backbone)
       ↓
Golang Core Engine (Concurrent Processing System)
       ↓
MongoDB (Persistent Storage) + Redis (Cache Layer)
       ↓
WebSocket Layer → Real-time UI Updates
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
| Monitoring | Prometheus, Grafana, OpenTelemetry |
| DevOps | Docker, Docker Compose |

## Folder Structure

```
schedulord/
├── frontend/          # React TypeScript control interface
├── api-gateway/       # Node.js Express API layer
├── go-engine/         # Golang concurrent processing engine
├── kafka/             # Kafka configuration
├── monitoring/        # Prometheus, Grafana, alerts
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

1. **Authentication System** — JWT-based auth with RBAC (Admin/User)
2. **Resource Management** — CRUD with availability tracking
3. **Event-Driven Allocation** — Kafka-powered event streaming
4. **Intelligent Allocation Engine** — Priority-based scoring with confidence
5. **Conflict Resolution Engine** — Queue-based scheduling
6. **Simulation Engine** — Multi-strategy scenario comparison
7. **Prediction Engine** — EMA-based demand forecasting
8. **Adaptive Learning Module** — Feedback-driven optimization

## Event Flow

1. User submits allocation request → Node API
2. API publishes event to Kafka topic `schedulord.requests`
3. Go engine consumes event asynchronously
4. Engine processes allocation, simulation, conflict resolution
5. Results emitted back via WebSocket for real-time UI updates
