export function startDictation(onText, onEnd, onError) {
  const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Constructor) throw Error('Diktering er ikke understøttet i denne browser. Skriv din besked i feltet.')
  const recognition = new Constructor()
  recognition.lang = 'da-DK'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.onresult = (e) => {
    let text = ''
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
    onText(text)
  }
  recognition.onend = onEnd
  recognition.onerror = (e) => {
    if (e.error !== 'aborted') {
      onError(
        'Diktering stoppede: ' +
          (e.error === 'not-allowed' ? 'mikrofonadgang blev ikke givet.' : 'prøv igen eller skriv din besked.')
      )
    }
    onEnd()
  }
  recognition.start()
  return () => {
    recognition.onresult = null
    recognition.onend = null
    recognition.onerror = null
    recognition.abort()
    onEnd()
  }
}
