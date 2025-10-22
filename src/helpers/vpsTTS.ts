const TTS_API_URL = import.meta.env.VITE_TTS_API_URL;
const TTS_API_KEY = import.meta.env.VITE_TTS_API_KEY;
const TTS_VOICE = import.meta.env.VITE_TTS_VOICE || 'default';
const TTS_SPEED = parseFloat(import.meta.env.VITE_TTS_SPEED || '1.0');

export interface TTSOptions {
  voice?: string;
  speed?: number;
}

export const generateSpeech = async (
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> => {
  if (!TTS_API_URL || !TTS_API_KEY) {
    throw new Error('TTS API not configured. Check .env file.');
  }

  const response = await fetch(`${TTS_API_URL}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': TTS_API_KEY,
    },
    body: JSON.stringify({
      text,
      voice: options.voice || TTS_VOICE,
      speed: options.speed || TTS_SPEED,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS API error: ${response.status} - ${error}`);
  }

  return await response.arrayBuffer();
};

export const isConfigured = (): boolean => {
  return !!(TTS_API_URL && TTS_API_KEY);
};
