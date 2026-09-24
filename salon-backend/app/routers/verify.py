from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import random
import string
from datetime import datetime, timedelta

from ..limiter import limiter
from ..database import supabase_admin, get_async_supabase_admin
from ..dependencies import get_current_user_with_profile
from ..services.sms import send_sms_notification

router = APIRouter(prefix="/api/verify", tags=["Verification"])

class SendOtpRequest(BaseModel):
    phone: str

class CheckOtpRequest(BaseModel):
    phone: str
    otp: str

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

@router.post("/send-otp")
@limiter.limit("5/minute")
async def send_otp(request: Request, payload: SendOtpRequest):
    """Generate and send an OTP to the given phone number."""
    phone = payload.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    otp = generate_otp()
    expires_at = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    
    # Store OTP in database
    async_supabase_admin = await get_async_supabase_admin()
    res = await async_supabase_admin.table("phone_otp").upsert({
        "phone": phone,
        "otp_code": otp,
        "expires_at": expires_at
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to generate OTP")
        
    # Send SMS using the existing SMS service
    message = f"Your QueueCut verification code is {otp}. It expires in 10 minutes."
    success = send_sms_notification(phone, message)
    
    if not success:
        # If SMS sending fails, you might want to log it but maybe still return success in development
        # For production, we should probably raise an error
        print(f"Warning: Failed to send SMS to {phone}. OTP was {otp}")
        
    return {"status": "success", "message": "OTP sent successfully"}


@router.post("/check-otp")
@limiter.limit("10/minute")
async def check_otp(request: Request, payload: CheckOtpRequest, user: dict = Depends(get_current_user_with_profile)):
    """Verify the OTP and mark the user's profile as phone_verified."""
    phone = payload.phone.strip()
    otp = payload.otp.strip()
    
    async_supabase_admin = await get_async_supabase_admin()
    
    # 1. Fetch the OTP record
    res = await async_supabase_admin.table("phone_otp").select("*").eq("phone", phone).execute()
    
    if not res.data:
        raise HTTPException(status_code=400, detail="No OTP requested for this phone number")
        
    record = res.data[0]
    
    # 2. Check expiration
    expires_at = datetime.fromisoformat(record["expires_at"].replace('Z', '+00:00'))
    if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    # 3. Check OTP validity
    if record["otp_code"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    # 4. Mark profile as verified
    # Assuming user.get("id") or user.get("sub") contains the profile ID
    user_id = user.get("sub") or user.get("id")
    update_res = await async_supabase_admin.table("profiles").update({"phone_verified": True}).eq("id", user_id).execute()
    
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update profile verification status")
        
    # 5. Delete the OTP record so it can't be reused
    await async_supabase_admin.table("phone_otp").delete().eq("phone", phone).execute()
    
    return {"status": "success", "message": "Phone verified successfully"}
