<div align="center">
  <img src="salon-frontend/public/favicon.svg" alt="QueueCut Logo" width="80" height="80">
  <h1 align="center">QueueCut</h1>
  <p align="center">
    <strong>The Elite Men's Salon Queue Management Platform</strong>
    <br />
    <br />
    <a href="https://saloon-website-ashen.vercel.app">View Demo</a>
    ·
    <a href="https://github.com/ajith2921/Saloon_website/issues">Report Bug</a>
  </p>
</div>

---

## 📖 Overview

QueueCut is an enterprise-grade digital queue management and booking platform built specifically for premium men's salons. It eliminates physical waiting times by allowing customers to join a virtual queue, track their position in real-time, and arrive exactly when their barber is ready.

### 🌟 Key Features

*   **⚡ Real-Time Digital Queue:** Live synchronization of queue positions and estimated wait times (ETA) using Supabase Realtime and WebSockets.
*   **🔒 Role-Based Access Control:** Secure multi-tenant architecture with distinct roles for `Customer`, `Salon Owner`, and `Super Admin`, enforced via PostgreSQL Row Level Security (RLS).
*   **💳 Subscription Billing:** Integrated Razorpay billing for salon owners to upgrade plans and manage their workforce limit.
*   **📱 Progressive Web App (PWA):** Near-native mobile experience with offline caching, fast chunk loading, and add-to-homescreen capabilities.
*   **🛡️ Production Resiliency:** Comprehensive rate limiting (SlowAPI), React Error Boundaries, and Sentry observability for global error tracking.
*   **🚀 High-Performance Async I/O:** Backend entirely refactored to `async/await` handling 500+ concurrent connections gracefully.

---

## 🛠️ Technology Stack

**Frontend (Client)**
*   [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
*   [Tailwind CSS](https://tailwindcss.com/) (Custom Design System & Dark Mode)
*   [React Router v6](https://reactrouter.com/) (Routing)
*   [Vite PWA](https://vite-pwa-org.netlify.app/) (Service Workers)

**Backend (API Server)**
*   [FastAPI](https://fastapi.tiangolo.com/) (High-performance Python Web Framework)
*   [Uvicorn](https://www.uvicorn.org/) (ASGI Server)
*   [Sentry](https://sentry.io/) (Error Tracking)

**Database & Auth**
*   [Supabase](https://supabase.com/) (PostgreSQL + GoTrue Auth)
*   Heavy reliance on highly optimized PL/pgSQL RPCs for transactional safety.

---

## 🚀 Local Development Setup

Follow these steps to run the QueueCut stack locally.

### Prerequisites
*   Node.js (v18+)
*   Python (3.9+)
*   A Supabase project (for Auth and Database)

### 1. Database Setup
Execute the SQL migrations found in `supabase_migrations/` in your Supabase SQL editor to initialize tables, RLS policies, and RPC functions.

### 2. Backend Setup
```bash
cd salon-backend

# Create virtual environment
python -m venv venv
source venv/Scripts/activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Fill in your SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.

# Run the API server
uvicorn app.main:app --reload --port 10000
```

### 3. Frontend Setup
```bash
cd salon-frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Fill in your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run the Vite dev server
npm run dev
```
The frontend will be available at `http://localhost:5173`.

---

## 🚢 Deployment

*   **Frontend**: Automatically deployed via **Vercel**. Push to the `main` branch to trigger a build.
*   **Backend**: Automatically deployed via **Render**. Render builds the Python environment and runs the Uvicorn web server dynamically handling `WEB_CONCURRENCY`.

---

## 🧪 Testing

The repository maintains an extensive test suite verifying RLS rules, data minimization, and role-based permissions.

```bash
# Run Backend Tests
cd salon-backend
pytest

# Run Frontend Tests
cd salon-frontend
npm run test
```

---
<div align="center">
  <i>Built for premium grooming.</i>
</div>
