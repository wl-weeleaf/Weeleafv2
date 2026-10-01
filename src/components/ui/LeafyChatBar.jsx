import React, { useEffect, useRef, useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { startDictation } from '../leafy/Dictation'
import { LeafySpeech } from '../leafy/LeafySpeech'
import { streamCorti } from '../../lib/livi/corti'
import { detectLanguage, t } from '../../lib/i18n'
import './leafyChat.css'

export default function LeafyChatBar() {
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const closeChat = useLeafyUi((s) => s.closeChat)
  const setSpeaking = useLeafyUi((s) => s.setSpeaking)
  const setViseme = useLeafyUi((s) => s.setViseme)
  const setLanguage = useLeafyUi((s) => s.setLanguage)
  const language = useLeafyUi((s) => s.language)
  const abort = useRef(null)
  const dictation = useRef(null)
  const speech = useRef(null)
  const seq = useRef(0)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [bubble, setBubble] = useState(t('da', 'bubble'))
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    speech.current = new LeafySpeech(setSpeaking, setViseme, setError)
    return () => speech.current?.cancel()
  }, [setSpeaking, setViseme])

  useEffect(() => {
    if (!messages.length) setBubble(t(language, 'bubble'))
  }, [language, messages.length])

  function stop() {
    seq.current++
    abort.current?.abort()
    abort.current = null
    dictation.current?.()
    dictation.current = null
    speech.current?.cancel()
    setPending(false)
    setListening(false)
  }

  async function send(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    const heard = detectLanguage(text)
    if (heard) setLanguage(heard)
    stop()
    const generation = seq.current
    const controller = new AbortController()
    abort.current = controller
    const history = [...messages.slice(-18), { role: 'user', content: text }]
    setInput('')
    setError('')
    setPending(true)
    setMessages(history)
    setBubble(t(heard || language, 'thinking'))
    try {
      const answer = await streamCorti({
        messages: history,
        signal: controller.signal,
        onDelta: (partial) => {
          if (generation === seq.current) setBubble(partial)
        },
      })
      if (generation !== seq.current) return
      setMessages([...history, { role: 'assistant', content: answer }])
      setBubble(answer)
      speech.current?.speak(answer)
    } catch (err) {
      if (generation === seq.current && err.name !== 'AbortError') {
        setError(err.message || 'Corti kunne ikke svare.')
        setBubble(t(language, 'read'))
      }
    } finally {
      if (generation === seq.current) setPending(false)
    }
  }

  function microphone() {
    if (listening || pending) {
      stop()
      return
    }
    stop()
    setError('')
    try {
      setListening(true)
      dictation.current = startDictation(setInput, () => setListening(false), setError)
    } catch (err) {
      setListening(false)
      setError(err.message)
    }
  }

  if (!chatOpen) return null

  return (
    <div className="wl-leafy-stack">
      <div className="wl-room-bottom">
        <div className="wl-room-thread">
          {messages.map((m, i) => (
            <div key={i} className={`wl-room-line wl-glass ${m.role}`}>{m.content}</div>
          ))}
        </div>
        <div className="wl-room-bubble wl-glass" aria-live="polite">{bubble}</div>
        {error && <p className="wl-room-notice">{error}</p>}
        <form className="wl-room-composer" onSubmit={send}>
          <div className="wl-room-input wl-glass">
            <input aria-label={t(language, 'placeholder')} placeholder={t(language, 'placeholder')} value={input} maxLength={6000} onChange={(e) => setInput(e.target.value)} />
            <button type="submit" disabled={!input.trim() || pending} aria-label={t(language, 'send')}>{'↑'}</button>
          </div>
          <button className="wl-room-talk" type="button" onClick={microphone} aria-pressed={listening}>
            <i>{listening ? '■' : '●'}</i>
            <span>{listening ? t(language, 'stop') : t(language, 'talk')}</span>
          </button>
          <button className="wl-room-talk" type="button" onClick={closeChat}>
            <i>{'×'}</i>
            <span>{t(language, 'close')}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
