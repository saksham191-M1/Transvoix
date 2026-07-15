from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter(tags=["pages"])

@router.get("/")
async def get_index():
    # Serve static main index
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "TransVoix is running. Setup static/index.html to view frontend."}

@router.get("/app")
async def get_app_shell():
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "TransVoix client shell."}
