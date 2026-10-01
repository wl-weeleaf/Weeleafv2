import useLeafyUi from '../../store/leafyUi'

const TTS = 'http://127.0.0.1:8787/api/leafy/speak'

export async function speakWithKokoro({ text, emotion = 'curious', speed = 0.96 }) {
  const language = useLeafyUi.getState().language || 'da'
  const response = await fetch(TTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language, emotion, speed }),
  })
  if (!response.ok) throw new Error('tts unavailable')
  return await response.blob()
}
