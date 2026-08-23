from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    # Required — set in .env (see .env.example). Never hardcode in source.
    supabase_url: str
    supabase_service_role_key: str
    # Required for verified JWT decoding. Found at: Supabase → Settings → API → JWT Secret
    supabase_jwt_secret: Optional[str] = None

    # Razorpay Billing Configuration
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_webhook_secret: Optional[str] = None

    # Platform fee per token (configurable, not hardcoded)
    platform_fee_per_token: float = 5.0

    # Comma-separated allowed frontend origins, e.g. "http://localhost:5173,https://queuecut.com"
    # Set FRONTEND_URL in .env to restrict CORS in production.
    # If left blank, defaults to localhost dev origins only.
    frontend_url: str = "http://localhost:5173,http://localhost:3000"

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
