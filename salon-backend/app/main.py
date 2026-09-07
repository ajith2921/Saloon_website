from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .routers import tokens, ratings, analytics, revenue, super_admin, advertisements, loyalty, salons, services, workers, notifications, subscriptions, billing, webhooks
from .config import settings

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter

import sentry_sdk

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        traces_sample_rate=1.0,
        # Set profiles_sample_rate to 1.0 to profile 100%
        # of sampled transactions.
        profiles_sample_rate=1.0,
    )

app = FastAPI(
    title="Men's Salon Queue API",
    version="1.0.0",
    docs_url=None,   # Disable Swagger UI in production
    redoc_url=None,  # Disable ReDoc in production
)
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

from .database import supabase_admin

from fastapi import Response
from fastapi.responses import RedirectResponse
from .database import get_async_supabase_admin

@app.get("/")
async def root():
    return RedirectResponse(url="/docs" if not app.docs_url else app.docs_url, status_code=302) if app.docs_url else {"status": "ok", "message": "Welcome to Men's Salon Queue API. The API is running."}

@app.get("/health")
async def health_check(response: Response):
    # Prevent CDNs (like Cloudflare used by Render) from caching this response
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    # Ping the database to keep Supabase from pausing due to inactivity
    try:
        async_supabase_admin = await get_async_supabase_admin()
        await async_supabase_admin.table("salons").select("id").limit(1).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {
        "status": "ok", 
        "message": "Backend is running!",
        "database": db_status
    }

@app.get("/api/settings")
@limiter.limit("60/minute")
async def get_public_settings(request: Request):
    """Expose global settings like subscriptions_enabled to the frontend."""
    async_supabase_admin = await get_async_supabase_admin()
    try:
        res = await async_supabase_admin.table("app_settings").select("key, value").execute()
        settings_dict = {row["key"]: row["value"] for row in res.data} if res.data else {}
        
        # Default fallback if not found
        if "subscriptions_enabled" not in settings_dict:
            settings_dict["subscriptions_enabled"] = False
            
        return {"settings": settings_dict}
    except Exception as e:
        # Fallback if table doesn't exist yet
        return {"settings": {"subscriptions_enabled": False}}

