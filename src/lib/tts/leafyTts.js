const TTS = 'http://127.0.0.1:8787/api/leafy/speak'

export async function speakWithKokoro({ text, emotion = 'curious', speed = 0.96 }) {
  const response = await fetch(TTS, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language: 'da', emotion, speed }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || 'Dansk stemme svarede ikke')
  }
  return await response.blob()
}
