import asyncio
from typing import Optional
import numpy as np
from io import BytesIO
from pydub import AudioSegment
import hashlib
import os
from pathlib import Path
from .config import settings

try:
    from kokoro import generate
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False
    print("Warning: Kokoro not installed. Install with: pip install git+https://github.com/remsky/Kokoro-FastAPI.git")

class KokoroTTS:
    AVAILABLE_VOICES = [
        "af_sarah", "af_nicole", "af_sky", "af",
        "am_adam", "am_michael", "am",
        "bf_emma", "bf_isabella", "bf",
        "bm_george", "bm_lewis", "bm"
    ]
    
    def __init__(self):
        if not KOKORO_AVAILABLE:
            raise RuntimeError("Kokoro TTS not installed")
        
        self.cache_dir = Path(settings.CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
    def _get_cache_key(self, text: str, voice: str, speed: float) -> str:
        cache_string = f"{text}_{voice}_{speed}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cache_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.mp3"
    
    async def synthesize(
        self,
        text: str,
        voice: str = "af_sarah",
        speed: float = 1.0,
        use_cache: bool = True
    ) -> bytes:
        if voice not in self.AVAILABLE_VOICES:
            voice = "af_sarah"
        
        if speed < 0.5:
            speed = 0.5
        elif speed > 2.0:
            speed = 2.0
        
        cache_key = self._get_cache_key(text, voice, speed)
        cache_path = self._get_cache_path(cache_key)
        
        if use_cache and cache_path.exists():
            print(f"Using cached audio for: {text[:50]}...")
            with open(cache_path, 'rb') as f:
                return f.read()
        
        audio_array, sample_rate = await asyncio.to_thread(
            generate,
            text,
            voice=voice,
            speed=speed
        )
        
        audio_array_int16 = (audio_array * 32767).astype(np.int16)
        
        audio_segment = AudioSegment(
            audio_array_int16.tobytes(),
            frame_rate=sample_rate,
            sample_width=2,
            channels=1
        )
        
        buffer = BytesIO()
        audio_segment.export(buffer, format="mp3", bitrate="128k")
        audio_bytes = buffer.getvalue()
        
        if use_cache:
            with open(cache_path, 'wb') as f:
                f.write(audio_bytes)
        
        return audio_bytes
    
    def get_available_voices(self) -> list:
        return [
            {"id": voice, "name": voice.replace("_", " ").title()}
            for voice in self.AVAILABLE_VOICES
        ]
    
    async def synthesize_streaming(
        self,
        sentences: list[str],
        voice: str = "af_sarah",
        speed: float = 1.0
    ):
        for sentence in sentences:
            if sentence.strip():
                audio = await self.synthesize(sentence, voice, speed)
                yield audio
