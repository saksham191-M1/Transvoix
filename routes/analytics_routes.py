from fastapi import APIRouter
from engine.analytics import analytics_engine

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_overview():
    stats = await analytics_engine.get_overview_stats()
    return stats

@router.get("/languages")
async def get_languages():
    usage = await analytics_engine.get_language_usage()
    return usage
