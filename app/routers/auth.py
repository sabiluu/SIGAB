"""Router: Autentikasi (Register, Login, Me, Profile)."""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
from pydantic import BaseModel, EmailStr

from ..core.database import get_db
from ..core.security import hash_password, verify_password, create_access_token, check_secret_key_strength
from ..core.config import settings
from ..core.deps import get_current_active_user, get_current_admin_user
from ..core.rate_limiter import login_rate_limiter
from ..models.user import User
from ..schemas.user import ChangePasswordRequest, ChangePasswordResponse

router = APIRouter(tags=["Authentication"])


def get_client_ip(request: Request) -> str:
    """Ekstrak IP client, mempertimbangkan header reverse proxy / load balancer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


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

    # Mencegah pendaftaran admin secara publik
    if body.role in ("petugas", "admin") and not email.endswith("@sigab.com"):
        raise HTTPException(
            status_code=403,
            detail="Pendaftaran sebagai admin tidak diizinkan melalui jalur publik.",
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
        nik=body.nik.strip() if body.nik else None,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return create_user_auth_response(new_user)


def authenticate_user(
    email_or_username: str,
    password: str,
    role_filter: Optional[str],
    db: Session,
    client_ip: str = "127.0.0.1",
):
    clean_email = email_or_username.strip().lower()

    # 1. Cek batas kegagalan login (Rate Limiting) untuk pencegahan serangan brute-force
    allowed, retry_after = login_rate_limiter.is_allowed(client_ip, clean_email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam {retry_after} detik demi keamanan akun.",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.query(User).filter(User.email == clean_email).first()
    if not user or not verify_password(password, user.password_hash):
        login_rate_limiter.record_failure(client_ip, clean_email)
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

    # Catat login sukses dan bersihkan kegagalan sebelumnya
    login_rate_limiter.record_success(client_ip, clean_email)
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
@router.post("/api/auth/login")
async def login_auth(
    request: Request,
    db: Session = Depends(get_db),
):
    """Mendukung Form (Swagger UI) dan JSON body dengan proteksi brute-force."""
    client_ip = get_client_ip(request)
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        username = str(form.get("username") or form.get("email") or "").strip()
        password = str(form.get("password") or "")
        role = form.get("role")
        if role is not None:
            role = str(role).strip()
            if not role:
                role = None
        if not username or not password:
            raise HTTPException(status_code=400, detail="Email dan kata sandi wajib diisi.")
        return authenticate_user(username, password, role, db, client_ip=client_ip)

    # JSON Body
    try:
        data = await request.json()
    except Exception:
        data = {}
    email = data.get("email") or data.get("username")
    password = data.get("password")
    role = data.get("role")
    if role is not None:
        role = str(role).strip()
        if not role:
            role = None
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email dan kata sandi wajib diisi.")
    return authenticate_user(email, password, role, db, client_ip=client_ip)


@router.post("/api/login")
def login_api(
    user_in: LoginBody,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    email = user_in.email or user_in.username
    if not email or not user_in.password:
        raise HTTPException(status_code=400, detail="Email dan kata sandi wajib diisi.")
    return authenticate_user(email, user_in.password, user_in.role, db, client_ip=client_ip)


class UpdateProfileBody(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    village_id: Optional[int] = None
    nik: Optional[str] = None
    address: Optional[str] = None
    family_count: Optional[int] = None
    elderly_count: Optional[int] = None
    toddler_count: Optional[int] = None
    pregnant_count: Optional[int] = None
    disabled_count: Optional[int] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None


def format_user_profile(user: User):
    role_str = "petugas" if user.role == "admin" else "warga"
    return {
        "id": user.id,
        "full_name": user.full_name,
        "name": user.full_name,
        "email": user.email,
        "role": role_str,
        "raw_role": user.role,
        "phone": user.phone,
        "village_id": user.village_id,
        "nik": user.nik or "",
        "address": user.address or "",
        "family_count": user.family_count if user.family_count is not None else 4,
        "elderly_count": user.elderly_count if user.elderly_count is not None else 0,
        "toddler_count": user.toddler_count if user.toddler_count is not None else 0,
        "pregnant_count": user.pregnant_count if user.pregnant_count is not None else 0,
        "disabled_count": user.disabled_count if user.disabled_count is not None else 0,
        "notes": user.notes or "",
        "avatar_url": user.avatar_url or "",
        "is_active": user.is_active,
    }


# --- Profile / Me Endpoints ---
@router.get("/auth/me")
def get_me(current_user: User = Depends(get_current_active_user)):
    return format_user_profile(current_user)


@router.put("/auth/me")
def update_me(
    body: UpdateProfileBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if body.name is not None and body.name.strip():
        current_user.full_name = body.name.strip()
    elif body.full_name is not None and body.full_name.strip():
        current_user.full_name = body.full_name.strip()

    if body.phone is not None:
        current_user.phone = body.phone.strip()
    if body.village_id is not None:
        current_user.village_id = body.village_id
    if body.nik is not None:
        current_user.nik = body.nik.strip()
    if body.address is not None:
        current_user.address = body.address.strip()
    if body.family_count is not None:
        current_user.family_count = max(1, body.family_count)
    if body.elderly_count is not None:
        current_user.elderly_count = max(0, body.elderly_count)
    if body.toddler_count is not None:
        current_user.toddler_count = max(0, body.toddler_count)
    if body.pregnant_count is not None:
        current_user.pregnant_count = max(0, body.pregnant_count)
    if body.disabled_count is not None:
        current_user.disabled_count = max(0, body.disabled_count)
    if body.notes is not None:
        current_user.notes = body.notes.strip()
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url.strip()

    db.commit()
    db.refresh(current_user)
    return format_user_profile(current_user)


@router.get("/api/profile")
def get_profile(current_user: User = Depends(get_current_active_user)):
    return format_user_profile(current_user)


@router.put("/api/profile")
def update_profile(
    body: UpdateProfileBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return update_me(body, current_user, db)


# --- Change Password Endpoints ---
@router.post("/auth/change-password", response_model=ChangePasswordResponse)
def change_password_auth(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    (Warga / Admin) Mengubah kata sandi akun pengguna yang sedang aktif.
    Validasi:
    1. Kata sandi saat ini wajib diisi dan sesuai dengan data tersimpan.
    2. Kata sandi baru minimal 6 karakter.
    3. Konfirmasi kata sandi baru harus identik (jika disertakan).
    4. Kata sandi baru tidak boleh sama dengan kata sandi saat ini.
    """
    curr_pwd = body.current_password or body.old_password
    if not curr_pwd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi saat ini wajib diisi.",
        )

    if not verify_password(curr_pwd, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi saat ini tidak sesuai.",
        )

    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi baru minimal 6 karakter.",
        )

    if body.confirm_password is not None and body.new_password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Konfirmasi kata sandi baru tidak cocok.",
        )

    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi baru tidak boleh sama dengan kata sandi saat ini.",
        )

    current_user.password_hash = hash_password(body.new_password)

    # Catat audit log jika admin mengubah kata sandi
    if current_user.role == "admin":
        try:
            from ..services.audit_service import record_user_action
            client_ip = request.client.host if request.client else None
            record_user_action(
                db=db,
                admin=current_user,
                target_user=current_user,
                action_type="change_password",
                notes=f"Admin {current_user.full_name} memperbarui kata sandi akun.",
                ip_address=client_ip,
            )
        except Exception as e:
            # Audit log tidak boleh menggagalkan proses ganti password utama
            pass

    db.commit()
    db.refresh(current_user)

    return ChangePasswordResponse(
        status="success",
        message="Kata sandi berhasil diperbarui. Silakan gunakan kata sandi baru untuk login berikutnya.",
    )


@router.post("/api/change-password", response_model=ChangePasswordResponse)
def change_password_api(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Alias endpoint ganti password untuk keselarasan dengan prefix /api."""
    return change_password_auth(body, request, current_user, db)


@router.get("/auth/security-check")
def get_security_check(current_admin: User = Depends(get_current_admin_user)):
    """(Admin) Audit status keamanan backend (CORS policy & validasi kekuatan JWT Secret Key)."""
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "is_production": settings.is_production,
        "jwt_security": check_secret_key_strength(),
        "cors_policy": {
            "allowed_origins": settings.get_cors_origins(),
            "allow_credentials": settings.CORS_ALLOW_CREDENTIALS,
            "allowed_methods": settings.CORS_ALLOW_METHODS,
            "allowed_headers": settings.CORS_ALLOW_HEADERS,
            "max_age_seconds": settings.CORS_MAX_AGE,
        },
    }
