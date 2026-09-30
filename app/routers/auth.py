"""Router: Autentikasi (Register, Login, Me, Profile)."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr

from ..core.database import get_db
from ..core.security import hash_password, verify_password, create_access_token
from ..core.config import settings
from ..core.deps import get_current_active_user
from ..models.user import User

router = APIRouter(tags=["Authentication"])


class RegisterBody(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = "081234567890"
    password: str
    role: Optional[str] = "user"
    village_id: Optional[int] = None
    nik: Optional[str] = None


class LoginBody(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str
    role: Optional[str] = None


def create_user_auth_response(user: User):
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    role_str = "petugas" if user.role == "admin" else "warga"
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": role_str,
            "raw_role": user.role,
            "phone": user.phone,
            "village_id": user.village_id,
        },
    }


def handle_register(body: RegisterBody, db: Session):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="Email sudah terdaftar. Silakan masuk.",
        )

    full_name = (body.name or body.full_name or email.split("@")[0]).strip()
    if len(body.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Kata sandi minimal 6 karakter.",
        )

    norm_role = "admin" if body.role in ("petugas", "admin") else "user"
    phone = (body.phone or "081234567890").strip()

    new_user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=hash_password(body.password),
        role=norm_role,
        village_id=body.village_id,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return create_user_auth_response(new_user)


def authenticate_user(email_or_username: str, password: str, role_filter: Optional[str], db: Session):
    clean_email = email_or_username.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email atau kata sandi salah.",
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Akun dinonaktifkan.")

    if role_filter:
        expected_role = "admin" if role_filter in ("petugas", "admin") else "user"
        if user.role != expected_role:
            label = "Petugas BPBD" if role_filter in ("petugas", "admin") else "Warga"
            raise HTTPException(
                status_code=400,
                detail=f"Akun ini bukan terdaftar sebagai {label}.",
            )

    return create_user_auth_response(user)


# --- Register Endpoints ---
@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register_auth(user_in: RegisterBody, db: Session = Depends(get_db)):
    return handle_register(user_in, db)


@router.post("/api/register", status_code=status.HTTP_201_CREATED)
def register_api(user_in: RegisterBody, db: Session = Depends(get_db)):
    return handle_register(user_in, db)


# --- Login Endpoints ---
@router.post("/auth/login")
async def login_auth(
    request: Request,
    db: Session = Depends(get_db),
):
    """Mendukung Form (Swagger UI) dan JSON body."""
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form = await request.form()
        username = form.get("username", "")
        password = form.get("password", "")
        return authenticate_user(username, password, None, db)

    # JSON Body
    try:
        data = await request.json()
    except Exception:
        data = {}
    email = data.get("email") or data.get("username")
    password = data.get("password")
    role = data.get("role")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email dan kata sandi wajib diisi.")
    return authenticate_user(email, password, role, db)


@router.post("/api/login")
def login_api(
    user_in: LoginBody,
    db: Session = Depends(get_db),
):
    email = user_in.email or user_in.username
    if not email or not user_in.password:
        raise HTTPException(status_code=400, detail="Email dan kata sandi wajib diisi.")
    return authenticate_user(email, user_in.password, user_in.role, db)


# --- Profile / Me Endpoints ---
@router.get("/auth/me")
def get_me(current_user: User = Depends(get_current_active_user)):
    role_str = "petugas" if current_user.role == "admin" else "warga"
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": role_str,
        "raw_role": current_user.role,
        "phone": current_user.phone,
        "village_id": current_user.village_id,
        "is_active": current_user.is_active,
    }


@router.get("/api/profile")
def get_profile(current_user: User = Depends(get_current_active_user)):
    role_str = "petugas" if current_user.role == "admin" else "warga"
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": role_str,
        "village_id": current_user.village_id,
        "is_active": current_user.is_active,
    }
