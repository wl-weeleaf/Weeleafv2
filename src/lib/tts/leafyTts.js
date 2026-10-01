async function postSpeak(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text() || response.statusText)
  return await response.blob()
}

export async function speakWithKokoro({ text, emotion = 'curious', speed = 0.82 }) {
  const body = { text, language: 'da', emotion, speed }
  try {
    return await postSpeak('/leafy-tts/speak', body)
  } catch (first) {
    try {
      return await postSpeak('http://127.0.0.1:8787/api/leafy/speak', body)
    } catch (second) {
      throw new Error(second.message || first.message || 'Dansk stemme svarede ikke')
    }
  }
}
