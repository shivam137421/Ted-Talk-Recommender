"""FastAPI/Starlette ML microservice for TalkWise recommendation engine."""

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

# Ensure ml/src is in pythonpath
CURRENT_FILE = Path(__file__).resolve()
PROJECT_ROOT = CURRENT_FILE.parents[2]
SRC_DIR = PROJECT_ROOT / "ml" / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.service.loader import ModelManager
from ml.service.schemas import RecommendationRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("talkwise_ml_service")

ML_INTERNAL_KEY = os.environ.get("ML_INTERNAL_KEY", "4yr1FDncao9YNu1npB1CfEqDRw2B2q1LZoxpg1jspuA")

# Initialize model manager singleton
model_manager = ModelManager.get_instance(root_dir=PROJECT_ROOT)


def verify_internal_key(request: Request) -> bool:
    """Verify shared secret header from Express gateway."""
    key = request.headers.get("x-internal-key") or request.headers.get("X-Internal-Key")
    return bool(key and key == ML_INTERNAL_KEY)


async def health(request: Request) -> JSONResponse:
    """Service health check and status."""
    return JSONResponse({
        "status": "healthy",
        "service": "talkwise-ml",
        "version": "1.0.0",
        "catalog_size": len(model_manager.slug_to_idx),
        "models_loaded": model_manager.is_loaded
    })


async def recommend(request: Request) -> JSONResponse:
    """Generate personalized or cold-start hybrid recommendations.
    
    Protected by X-Internal-Key shared secret.
    """
    if not verify_internal_key(request):
        return JSONResponse(
            {"detail": "Unauthorized: invalid or missing X-Internal-Key header"},
            status_code=401
        )

    try:
        body = await request.json()
    except Exception:
        body = {}

    try:
        req = RecommendationRequest.from_dict(body)
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, status_code=400)

    try:
        recs = model_manager.recommend(
            favorite_slugs=req.favorite_slugs,
            preferred_tags=req.preferred_tags,
            k=req.k,
            exclude_slugs=req.exclude_slugs,
            include_favorites=req.include_favorites
        )
        return JSONResponse({
            "recommendations": recs,
            "count": len(recs),
            "model_strategy": "hybrid"
        })
    except Exception as e:
        logger.exception("Error generating recommendations: %s", e)
        return JSONResponse({"detail": f"Internal ML error: {str(e)}"}, status_code=500)


async def similar_talks(request: Request) -> JSONResponse:
    """Return top-k content-based similar talks for a given talk slug."""
    slug = request.path_params.get("slug", "").strip()
    if not slug:
        return JSONResponse({"detail": "Talk slug is required"}, status_code=400)

    try:
        k = int(request.query_params.get("k", 10))
    except (ValueError, TypeError):
        k = 10
    k = max(1, min(k, 50))

    if slug not in model_manager.slug_to_idx:
        return JSONResponse({"detail": f"Talk slug '{slug}' not found in catalog"}, status_code=404)

    results = model_manager.get_similar(slug, k=k)
    return JSONResponse({
        "slug": slug,
        "similar_talks": results,
        "count": len(results)
    })


async def popular_talks(request: Request) -> JSONResponse:
    """Return top-k popular talks by view count snapshot."""
    try:
        k = int(request.query_params.get("k", 10))
    except (ValueError, TypeError):
        k = 10
    k = max(1, min(k, 50))

    results = model_manager.get_popular(k=k)
    return JSONResponse({
        "popular_talks": results,
        "count": len(results)
    })


async def search_talks(request: Request) -> JSONResponse:
    """Natural-language semantic search using TF-IDF cosine similarity."""
    q = request.query_params.get("q", "").strip()
    if not q:
        return JSONResponse({"results": [], "count": 0})
    try:
        k = int(request.query_params.get("k", 20))
    except (ValueError, TypeError):
        k = 20
    k = max(1, min(k, 100))
    results = model_manager.search(q, k=k)
    return JSONResponse({
        "query": q,
        "results": results,
        "count": len(results)
    })


routes = [
    Route("/health", health, methods=["GET"]),
    Route("/recommend", recommend, methods=["POST"]),
    Route("/similar/{slug}", similar_talks, methods=["GET"]),
    Route("/popular", popular_talks, methods=["GET"]),
    Route("/search", search_talks, methods=["GET"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"]
    )
]

app = Starlette(debug=False, routes=routes, middleware=middleware)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ML_PORT", 8000))
    uvicorn.run("ml.service.main:app", host="0.0.0.0", port=port, log_level="info")

