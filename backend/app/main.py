from fastapi import FastAPI

from app.database.database import Base, engine
from app.database import models


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Smart AI Meeting Assistant",
    description="AI-powered meeting analysis platform",
    version="1.0.0"
)


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