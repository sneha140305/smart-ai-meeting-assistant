import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine
from app.database import models

from app.routers.auth import router as auth_router
from app.routers.meetings import router as meetings_router

load_dotenv()


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Smart AI Meeting Assistant",
    description="AI-powered meeting intelligence platform",
    version="1.0.0",
)

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    auth_router,
    tags=["Authentication"],
)

app.include_router(
    meetings_router,
    tags=["Meetings"],
)

@app.get("/")
def root():
    return {
        "message": "Smart AI Meeting Assistant API",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
    }