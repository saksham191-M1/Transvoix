import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from engine.database import get_db
from engine.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from engine.adaptive_learner import adaptive_learner

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    native_language: str = "en"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    async for db in get_db():
        # Check if email exists
        async with db.execute("SELECT id FROM users WHERE email = ?", (user_data.email,)) as cursor:
            row = await cursor.fetchone()
            if row:
                raise HTTPException(status_code=400, detail="Email already registered")
                
        user_id = str(uuid.uuid4())
        pwd_hash = hash_password(user_data.password)
        
        # Insert user
        await db.execute(
            """INSERT INTO users (id, email, password_hash, display_name, native_language, preferred_language)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, user_data.email, pwd_hash, user_data.display_name, user_data.native_language, user_data.native_language)
        )
        
        # Initialize default language profile
        profile_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO language_profiles (id, user_id, native_language, preferred_listening_language, spoken_languages, understood_languages)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (profile_id, user_id, user_data.native_language, user_data.native_language, '[]', '[]')
        )
        
        await db.commit()
        return {"id": user_id, "email": user_data.email, "display_name": user_data.display_name}
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    async for db in get_db():
        async with db.execute(
            "SELECT id, email, password_hash, display_name FROM users WHERE email = ?", 
            (credentials.email,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Invalid credentials")
                
        user_id, email, password_hash, display_name = row
        if not verify_password(credentials.password, password_hash):
            raise HTTPException(status_code=400, detail="Invalid credentials")
            
        access_token = create_access_token(subject=user_id)
        refresh_token = create_refresh_token(subject=user_id)
        
        # Save refresh token hash
        token_id = str(uuid.uuid4())
        from hashlib import sha256
        token_hash = sha256(refresh_token.encode()).hexdigest()
        
        await db.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+7 days'))",
            (token_id, user_id, token_hash)
        )
        await db.commit()
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token
        }
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("/me")
async def get_current_user(token: str):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("sub")
    
    async for db in get_db():
        async with db.execute(
            "SELECT id, email, display_name, native_language, preferred_language FROM users WHERE id = ?",
            (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            return {
                "id": row[0],
                "email": row[1],
                "display_name": row[2],
                "native_language": row[3],
                "preferred_language": row[4]
            }
    raise HTTPException(status_code=500, detail="Database connection failed")

@router.get("/preferences")
async def get_user_preferences(user_id: str):
    return await adaptive_learner.get_learned_preferences(user_id)

