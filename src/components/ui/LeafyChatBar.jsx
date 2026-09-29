import React, { useRef, useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { startDictation } from '../leafy/Dictation'
import { streamCorti } from '../../lib/livi/corti'
import './leafyChat.css'

export default function LeafyChatBar() {
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const closeChat = useLeafyUi((s) => s.closeChat)
  const abort = useRef(null)
  const dictation = useRef(null)
  const seq = useRef(0)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [bubble, setBubble] = useState('Corti er klar. Hvad skal vi finde p\u00e5 i dag?'.replace('\\u00e5', 'å'))
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])

  function stop() {
    seq.current++
    abort.current?.abort()
    abort.current = null
    dictation.current?.()
    dictation.current = null
    setPending(false)
    setListening(false)
  }

  async function send(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    stop()
    const generation = seq.current
    const controller = new AbortController()
    abort.current = controller
    const history = [...messages.slice(-18), { role: 'user', content: text }]
    setInput('')
    setError('')
    setPending(true)
    setBubble('Corti tænker…')
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
    } catch (err) {
      if (generation === seq.current && err.name !== 'AbortError') {
        setError(err.message || 'Corti kunne ikke svare.')
        setBubble('Corti svarede ikke. Tjek weeleaf-default_client i menuen.')
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
    <div className="wl-room-bottom">
      <div className="mb-2 text-center text-xs tracking-wide text-emerald-200/80">Leafy · Corti</div>
      <div className="wl-room-bubble" aria-live="polite">
        {bubble}
      </div>
      {error && <p className="wl-room-notice">{error}</p>}
      <form className="wl-room-composer" onSubmit={send}>
        <div className="wl-room-input">
          <input
            aria-label="Skriv til Leafy"
            placeholder="Skriv til Leafy…"
            value={input}
            maxLength={6000}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={!input.trim() || pending} aria-label="Send besked">
            ↑
          </button>
        </div>
        <button className="wl-room-talk" type="button" onClick={microphone} aria-pressed={listening}>
          <i>{listening ? '■' : '●'}</i>
          <span>{listening ? 'Stop diktering' : 'Tal med Leafy'}</span>
        </button>
        <button className="wl-room-talk" type="button" onClick={closeChat}>
          <i>×</i>
          <span>Luk</span>
        </button>
      </form>
    </div>
  )
}
