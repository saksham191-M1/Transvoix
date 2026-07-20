import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import settings
from engine.database import init_db
from routes import (
    user_routes,
    session_routes,
    translation_routes,
    websocket_routes,
    page_routes,
    analytics_routes,
    dictionary_routes,
    recording_routes,
    tts_routes
)

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include Routers
app.include_router(user_routes.router)
app.include_router(session_routes.router)
app.include_router(translation_routes.router)
app.include_router(websocket_routes.router)
app.include_router(analytics_routes.router)
app.include_router(dictionary_routes.router)
app.include_router(recording_routes.router)
app.include_router(tts_routes.router)
app.include_router(page_routes.router)

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite database
    await init_db()

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
