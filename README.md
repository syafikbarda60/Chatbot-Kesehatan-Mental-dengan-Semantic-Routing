# Sanctuary 🌿

> An AI-powered mental health support system for students and counselors.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat&logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?style=flat&logo=react)](https://reactnative.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Local-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)

## Features

### For Students (Mobile App)

- **AI Chatbot**: Intelligent mental health companion using Semantic Router + RAG for context-aware support.
- **Automatic Stress Detection**: Real-time analysis of chat messages to detect emotional distress.
- **Clinical Assessments**: Self-service PHQ-9, GAD-7, and SRQ tests with immediate results.
- **Self-Journaling**: Private mood tracking and daily reflections.
- **Secure Auth**: OTP-based password recovery and secure authentication.

### For Counselors & Admins (Dashboard)

- **Risk Monitoring**: Real-time tracking of users with severe assessment scores.
- **Analytics Distribution**: Visualize mental health trends and severity across the student population.
- **Booking Management**: Manage counseling sessions and schedules.
- **Account Control**: Role-based access control (RBAC) for university administrators.

### Technical Highlights

- **Monorepo Architecture**: Shared logic and UI components across web and mobile platforms.
- **RAG Integration**: Retrieval-Augmented Generation for accurate mental health information.
- **Hybrid Storage**: Local storage wrappers for seamless cross-platform data persistence.
- **Semantic Routing**: Intent-based message routing for guardrails and specialized responses.

## Tech Stack

### Monorepo Structure

- **`apps/mobile`**: Expo React Native application.
- **`apps/dashboard`**: Next.js web application.
- **`apps/backend`**: FastAPI (Python 3.12) services.
- **`packages/api-client`**: Shared TypeScript SDK for API communication.
- **`packages/ui-shared`**: Shared hooks, context, and Sanctuary Design System.
- **`packages/utils`**: Common logic, stress detection, and response parsers.

### Backend & AI

- **FastAPI**: High-performance Python web framework.
- **Supabase**: PostgreSQL database, Auth, and Vector storage.
- **Semantic Router**: Decision layer for LLM message routing.
- **LiteLLM**: Unified interface for various LLM providers.
- **Ollama**: Local embedding generation.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [Python](https://www.python.org/) (v3.12 or higher)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Required for local Supabase)
- [Ollama](https://ollama.com/) (For local embeddings)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/prototype.git
cd prototype
```

### 2. Infrastructure Setup (Supabase Local)

```bash
npx supabase start
```
*Note: Make sure Docker is running. This will provide your local `API_URL` and `SERVICE_ROLE_KEY`.*

### 3. Backend Setup

```bash
cd apps/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
*Configure `.env` with the keys from step 2.*

### 4. Application Setup

```bash
# From root
npm install
```

## Running the Application

### Start Backend
```bash
cd apps/backend
venv\Scripts\activate
uvicorn api:app --reload --port 8000
```

### Start Mobile App
```bash
cd apps/mobile
npx expo start
```

### Start Dashboard
```bash
cd apps/dashboard
npm run dev
```

## Project Structure

```
prototype/
├── apps/
│   ├── mobile/           # Expo Mobile App
│   ├── dashboard/        # Next.js Web Dashboard
│   └── backend/          # FastAPI Python Server
├── packages/
│   ├── api-client/       # Shared Fetch Wrappers
│   ├── ui-shared/        # Theme, Hooks, Components
│   └── utils/            # Helper Functions
├── supabase/             # Local Docker & Migration Config
└── package.json          # Root Workspace Config
```

## Available Scripts (Root)

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npx supabase start` | Start local development environment |
| `npx supabase stop` | Stop local services |
| `npx supabase status` | Check local service credentials |
