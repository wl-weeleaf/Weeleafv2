const TTS = '/leafy-tts/speak'

export async function speakWithKokoro({ text, emotion = 'curious', speed = 0.82 }) {
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
