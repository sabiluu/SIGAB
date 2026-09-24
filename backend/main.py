from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Enum
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from pydantic import BaseModel
import bcrypt
import jwt
from datetime import datetime, timedelta

# Database Setup
DATABASE_URL = "mysql+pymysql://root:@localhost:3306/siagabencana"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('user', 'admin'), default='user', nullable=False)
    village_id = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

# Schemas
class UserRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: str # 'warga' atau 'petugas'
    village_id: int | None = None

class UserLogin(BaseModel):
    email: str
    password: str
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# App Init
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

@app.post("/api/register")
def register(user: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar!")
    
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db_role = 'admin' if user.role == 'petugas' else 'user'
    
    new_user = User(
        full_name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password,
        role=db_role,
        village_id=user.village_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = jwt.encode({"sub": str(new_user.id)}, SECRET_KEY, algorithm=ALGORITHM)
    return {"user": {"id": new_user.id, "full_name": new_user.full_name, "email": new_user.email, "role": user.role}, "access_token": token}

@app.post("/api/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Email tidak terdaftar.")
    
    if not bcrypt.checkpw(user.password.encode('utf-8'), db_user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=400, detail="Kata sandi salah.")
        
    expected_role = 'admin' if user.role == 'petugas' else 'user'
    if db_user.role != expected_role:
        raise HTTPException(status_code=400, detail=f"Akun ini bukan terdaftar sebagai {user.role}.")
        
    token = jwt.encode({"sub": str(db_user.id)}, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "full_name": db_user.full_name,
            "email": db_user.email,
            "role": user.role
        }
    }
