from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import tokens, ratings, analytics, revenue, super_admin, advertisements, loyalty, salons, services, workers, notifications, subscriptions, billing, webhooks
from .config import settings

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter

app = FastAPI(title="Men's Salon Queue API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # Set FRONTEND_URL in .env for production (SEC-004)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(salons.router)
app.include_router(services.router)
app.include_router(workers.router)
app.include_router(tokens.router)
app.include_router(ratings.router)
app.include_router(analytics.router)
app.include_router(revenue.router)
app.include_router(super_admin.router)
app.include_router(advertisements.router)
app.include_router(loyalty.router)
app.include_router(notifications.router)
app.include_router(subscriptions.router)
app.include_router(billing.router)
app.include_router(webhooks.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running!"}
