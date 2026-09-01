from fastapi import FastAPI

from app.database.database import Base, engine
from app.database import models
from app.routers.auth import router as auth_router
from app.routers.meetings import router as meetings_router


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Smart AI Meeting Assistant",
    description="AI-powered meeting analysis platform",
    version="1.0.0"
)


app.include_router(auth_router)
app.include_router(meetings_router)

@app.get("/")
def root():
    return {
        "message": "Smart AI Meeting Assistant API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected"
    }