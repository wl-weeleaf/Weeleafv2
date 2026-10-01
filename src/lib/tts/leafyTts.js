export async function speakWithKokoro({ text, language = 'da', emotion = 'curious', speed = 0.96 }) {
  const response = await fetch('/api/leafy/speak', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language, emotion, speed }),
  })
  if (!response.ok) throw new Error('tts unavailable')
  return await response.blob()
}
