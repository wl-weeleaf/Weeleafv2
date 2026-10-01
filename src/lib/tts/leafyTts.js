import useLeafyUi from '../../store/leafyUi'
import { detectLanguage } from '../i18n'

export async function speakWithKokoro({ text, emotion = 'curious', speed = 0.96 }) {
  const heard = detectLanguage(text)
  const language = heard || useLeafyUi.getState().language || 'da'
  if (heard) useLeafyUi.getState().setLanguage(heard)
  const response = await fetch('/api/leafy/speak', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language, emotion, speed }),
  })
  if (!response.ok) throw new Error('tts unavailable')
  const spoken = response.headers.get('x-leafy-language')
  if (spoken) useLeafyUi.getState().setLanguage(spoken)
  return await response.blob()
}
