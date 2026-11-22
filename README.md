# Therapy-Chatbot

> An AI-powered mental health support system for students and counselors.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat&logo=react)](https://reactnative.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)

## Features

### For Students (Mobile App)

- **AI Chatbot**: Intelligent mental health companion using Semantic Router + RAG for context-aware support. Answers about the corpus cite their source document; questions about the assistant itself are answered by a fixed reply, never generated.
- **Automatic Stress Detection**: Real-time analysis of chat messages to detect emotional distress.
- **Clinical Assessments**: Self-service PHQ-9, GAD-7, and SRQ assessments with immediate results.
- **Self-Journaling**: Private mood tracking and daily reflections.
- **Secure Auth**: OTP-based password recovery and secure authentication.

### For Counselors & Admins (Dashboard)

- **Risk Monitoring**: Real-time tracking of users with severe assessment scores.
- **Analytics Distribution**: Visualize mental health trends and severity across the student population.
- **Booking Management**: Manage counseling sessions and schedules.
- **Account Control**: Role-based access control (RBAC) for university administrators.

### Technical Highlights

- **Separate Frontends**: Mobile and the standalone dashboard communicate through the same FastAPI backend.
- **RAG Integration**: Retrieval-Augmented Generation for accurate mental health information.
- **Hybrid Storage**: Local storage wrappers for seamless cross-platform data persistence.
- **Semantic Routing**: Intent-based message routing for guardrails and specialized responses.

## Tech Stack

### Monorepo Structure

- **`apps/mobile`**: Expo React Native application.
- **[sajiwa-dashboard](https://github.com/melakhaa/sajiwa-dashboard)**: Next.js administrator/counselor dashboard (separate repository).
- **`apps/backend`**: FastAPI (Python 3.12) services.
- **`packages/api-client`**: Shared TypeScript SDK for API communication.
- **`packages/ui-shared`**: Shared hooks, context, and Sajiwa Design System.
- **`packages/utils`**: Common logic, stress detection, and response parsers.

### Backend & AI

- **FastAPI**: High-performance Python web framework.
- **PostgreSQL 17 + pgvector**: Database, row-level security, and vector storage (Docker).
- **psycopg 3**: Parameterized SQL access, no ORM.
- **Semantic Router**: Decision layer for LLM message routing.
- **Ollama**: Local LLM generation and embeddings.

## Prerequisites

- [Node.js](https://nodejs.org/) (v24 LTS)
- [Python](https://www.python.org/) (v3.12 — required, the AI stack has no 3.13/3.14 wheels)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Required for local PostgreSQL)
- [Ollama](https://ollama.com/) (For local LLM + embeddings)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/melakhaa/Therapy-Chatbot.git
cd Therapy-Chatbot
```

### 2. Infrastructure Setup (Local PostgreSQL)

```bash
docker compose up -d
```
*Note: Make sure Docker is running. This starts PostgreSQL 17 + pgvector and applies
`db/init/*.sql` on first boot. pgAdmin is at http://localhost:5050.*

### 3. Backend Setup

```bash
cd apps/backend
# Python 3.12 required — semantic-router has no 3.13/3.14 wheels
uv venv --python 3.12 venv && source venv/bin/activate   # or: python3.12 -m venv venv
pip install -r requirements.txt
cp .env.example .env
```
*Fill `JWT_SECRET` and `ENCRYPTION_KEY` in `.env` (generation commands are in the file).*

Seed local dev accounts (idempotent — the first admin can't be created through the API):

```bash
venv/bin/python scripts/seed_dev_users.py
```
*Log in as `admin@example.com` / `admin1234`, `konselor@example.com` / `konselor1234`, or
`mahasiswa@example.com` / `mahasiswa1234`.*

### 4. Application Setup

```bash
# From root
npm install
```

## Running the Application

### Start Backend
```bash
cd apps/backend
venv/bin/uvicorn main:app --reload --port 8000
```

### Start Mobile App
```bash
cd apps/mobile
npx expo start
```

### Start Dashboard
```bash
# In a separate checkout (not an npm workspace here)
cd ../sajiwa-dashboard
npm ci
cp .env.example .env.local
npm run dev
```

Clone [sajiwa-dashboard](https://github.com/melakhaa/sajiwa-dashboard) alongside this repository first.
Set its `NEXT_PUBLIC_API_URL` in `.env.local` and mobile's `EXPO_PUBLIC_API_URL` in
`apps/mobile/.env` to the same FastAPI environment. A physical phone needs a reachable LAN
address, not `localhost`. Set backend `ALLOWED_ORIGINS` to the actual browser origins.
The shared backend/database and staff-only `/realtime` notices keep both apps connected;
mobile does not call the dashboard server directly. Preview mode uses synthetic data and
must be off for communication checks.

## Project Structure

```
Therapy-Chatbot/
├── apps/
│   ├── mobile/           # Expo Mobile App
│   └── backend/          # FastAPI Python Server (routes/, services/, tests/)
├── packages/
│   ├── api-client/       # Shared Fetch Wrappers
│   ├── ui-shared/        # Theme, Hooks, Components
│   └── utils/            # Helper Functions
├── e2e/                  # Browser journeys (betterwright) for the dashboard
├── db/                   # Schema, auth SQL, RLS self-check
├── docs/                 # Per-stack convention docs
├── docker-compose.yml    # PostgreSQL 17 + pgvector + pgAdmin
└── package.json          # Root Workspace Config
```

## Available Scripts (Root)

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm test` | Unit tier: every workspace + backend, no stack required |
| `npm run test:integration` | Integration tier: live API, Postgres, RLS self-check |
| `npm run test:e2e` | E2E tier: betterwright drives the dashboard in a browser |
| `docker compose up -d` | Start local PostgreSQL + pgAdmin |
| `docker compose down` | Stop local services |
| `docker compose down -v` | Stop and wipe local data (re-applies `db/init`) |
| `venv/bin/uvicorn main:app --reload` | Run the backend (from `apps/backend`) |

Dashboard commands (`npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run build`, `npm start`) run in its own repository. Root browser tests still target
that dashboard at `http://localhost:3000` and this backend at `http://localhost:8000`.

Tests run in three tiers. `npm test` needs nothing running and is the one command that must
always be green; the other two skip loudly when their stack is down. **Write the test first** —
the `tdd` skill (`.agents/skills/tdd/`) is mandatory here. Tiers and the
red → green loop: [docs/testing-conventions.md](docs/testing-conventions.md).
