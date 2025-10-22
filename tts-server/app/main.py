from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from typing import Optional
import io
import re
from .config import settings

try:
    from .tts_piper import PiperTTS as TTSEngine
    TTS_ENGINE_NAME = "piper"
except ImportError:
    try:
        from .tts import KokoroTTS as TTSEngine
        TTS_ENGINE_NAME = "kokoro"
    except ImportError:
        TTSEngine = None
        TTS_ENGINE_NAME = None

app = FastAPI(
    title="Verisum TTS API",
    description="Self-hosted TTS service using Piper/Kokoro for voice synthesis",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    tts_engine = TTSEngine() if TTSEngine else None
except Exception as e:
    print(f"Failed to initialize TTS engine: {e}")
    tts_engine = None

class TTSRequest(BaseModel):
    text: str
    voice: str = "af_sarah"
    speed: float = 1.0
    language: str = "en"

class TTSStreamRequest(BaseModel):
    text: str
    voice: str = "af_sarah"
    speed: float = 1.0

def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

def split_sentences(text: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

@app.get("/")
async def root():
    return {
        "service": "Verisum TTS API",
        "status": "online" if tts_engine else "tts_unavailable",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy" if tts_engine else "unhealthy",
        "tts_engine": TTS_ENGINE_NAME if tts_engine else None
    }

@app.post("/api/tts")
async def generate_speech(
    request: TTSRequest,
    api_key: str = Depends(verify_api_key)
):
    if not tts_engine:
        raise HTTPException(status_code=503, detail="TTS engine not available")
    
    try:
        audio_bytes = await tts_engine.synthesize(
            text=request.text,
            voice=request.voice,
            speed=request.speed
        )
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": 'attachment; filename="speech.mp3"',
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/api/tts/stream")
async def stream_speech(
    request: TTSStreamRequest,
    api_key: str = Depends(verify_api_key)
):
    if not tts_engine:
        raise HTTPException(status_code=503, detail="TTS engine not available")
    
    sentences = split_sentences(request.text)
    
    async def audio_generator():
        async for audio_chunk in tts_engine.synthesize_streaming(
            sentences,
            voice=request.voice,
            speed=request.speed
        ):
            yield audio_chunk
    
    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff"
        }
    )

@app.get("/api/voices")
async def list_voices(api_key: str = Depends(verify_api_key)):
    if not tts_engine:
        raise HTTPException(status_code=503, detail="TTS engine not available")
    
    return {
        "voices": tts_engine.get_available_voices(),
        "default": "af_sarah"
    }

@app.post("/api/tts/preview")
async def preview_voice(
    voice: str,
    api_key: str = Depends(verify_api_key)
):
    if not tts_engine:
        raise HTTPException(status_code=503, detail="TTS engine not available")
    
    preview_text = "Hello, this is a preview of my voice. I can help answer questions about web pages."
    
    try:
        audio_bytes = await tts_engine.synthesize(
            text=preview_text,
            voice=voice,
            speed=1.0
        )
        
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
