from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import meetings, upload, ws, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="AI Meeting Resolution API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
