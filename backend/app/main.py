from fastapi import FastAPI

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
        "status": "healthy"
    }