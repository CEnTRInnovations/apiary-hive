from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import validate, bundles

app = FastAPI(title="Apiary Hive API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validate.router, prefix="/api")
app.include_router(bundles.router, prefix="/api")


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
