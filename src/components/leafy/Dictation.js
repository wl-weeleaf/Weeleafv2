import useLeafyUi from '../../store/leafyUi'
import { detectLanguage } from '../../lib/i18n'

const LANG = { da: 'da-DK', en: 'en-GB' }

export function startDictation(onText, onEnd, onError) {
  const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Constructor) throw Error('Diktering er ikke understøttet i denne browser. Skriv din besked i feltet.')
  const recognition = new Constructor()
  const language = useLeafyUi.getState().language || 'da'
  recognition.lang = LANG[language] || 'da-DK'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.onresult = (e) => {
    let text = ''
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
    const heard = detectLanguage(text)
    if (heard) useLeafyUi.getState().setLanguage(heard)
    onText(text)
  }
  recognition.onend = onEnd
  recognition.onerror = (e) => {
    if (e.error !== 'aborted') onError('Diktering stoppede.')
    onEnd()
  }
  recognition.start()
  return () => recognition.abort()
}
