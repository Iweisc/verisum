import asyncio
from typing import Optional
import wave
import io
import hashlib
import os
from pathlib import Path
from pydub import AudioSegment
from .config import settings

try:
    from piper.voice import PiperVoice
    PIPER_AVAILABLE = True
except ImportError:
    PIPER_AVAILABLE = False
    print("Warning: Piper not installed")

class PiperTTS:
    AVAILABLE_VOICES = {
        "en_US-lessac-medium": "models/piper/en_US-lessac-medium.onnx",
        "default": "models/piper/en_US-lessac-medium.onnx"
    }
    
    def __init__(self):
        if not PIPER_AVAILABLE:
            raise RuntimeError("Piper TTS not installed")
        
        self.cache_dir = Path(settings.CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model_dir = Path(settings.MODEL_CACHE_DIR)
        
        self.voice = None
        self._load_voice()
        
    def _load_voice(self):
        model_path = self.model_dir / "piper" / "en_US-lessac-medium.onnx"
        if model_path.exists():
            self.voice = PiperVoice.load(str(model_path))
            print(f"✅ Loaded Piper voice from {model_path}")
        else:
            print(f"❌ Model not found at {model_path}")
    
    def _get_cache_key(self, text: str, voice: str, speed: float) -> str:
        cache_string = f"{text}_{voice}_{speed}"
        return hashlib.md5(cache_string.encode()).hexdigest()
    
    def _get_cache_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.mp3"
    
    def _synthesize_to_wav(self, text: str) -> bytes:
        """Synchronous synthesis to WAV bytes"""
        wav_buffer = io.BytesIO()
        
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(self.voice.config.sample_rate)
            
            # Synthesize and write audio
            for audio_chunk in self.voice.synthesize(text):
                # AudioChunk has audio_int16_bytes property
                wav_file.writeframes(audio_chunk.audio_int16_bytes)
        
        wav_buffer.seek(0)
        return wav_buffer.read()
    
    async def synthesize(
        self,
        text: str,
        voice: str = "default",
        speed: float = 1.0,
        use_cache: bool = True
    ) -> bytes:
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
        
        if not self.voice:
            raise RuntimeError("Piper voice not loaded")
        
        print(f"Generating audio for: {text[:50]}...")
        
        # Generate WAV in thread
        wav_bytes = await asyncio.to_thread(self._synthesize_to_wav, text)
        
        # Convert WAV to MP3
        wav_io = io.BytesIO(wav_bytes)
        audio_segment = AudioSegment.from_wav(wav_io)
        
        # Apply speed adjustment
        if speed != 1.0:
            audio_segment = audio_segment._spawn(
                audio_segment.raw_data,
                overrides={
                    "frame_rate": int(audio_segment.frame_rate * speed)
                }
            ).set_frame_rate(audio_segment.frame_rate)
        
        # Export to MP3
        mp3_buffer = io.BytesIO()
        audio_segment.export(mp3_buffer, format="mp3", bitrate="128k")
        audio_bytes = mp3_buffer.getvalue()
        
        # Cache the result
        if use_cache:
            with open(cache_path, 'wb') as f:
                f.write(audio_bytes)
            print(f"✅ Cached audio ({len(audio_bytes)} bytes)")
        
        return audio_bytes
    
    def get_available_voices(self) -> list:
        return [
            {"id": "en_US-lessac-medium", "name": "English US (Lessac)"},
            {"id": "default", "name": "Default"}
        ]
    
    async def synthesize_streaming(
        self,
        sentences: list[str],
        voice: str = "default",
        speed: float = 1.0
    ):
        for sentence in sentences:
            if sentence.strip():
                audio = await self.synthesize(sentence, voice, speed)
                yield audio
