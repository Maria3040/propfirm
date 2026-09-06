from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin_routes import router as admin_router
from app.api.routes import router
from app.architecture.db import SessionLocal, init_db
from app.config import get_settings
from app.seed import seed
from app.services import wire_bus


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    wire_bus()
    with SessionLocal() as session:
        seed(session)
        session.commit()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PropFirm Python API",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(admin_router)
    return app


app = create_app()
