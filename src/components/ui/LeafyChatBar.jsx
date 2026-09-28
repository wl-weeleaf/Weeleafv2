import React, { useCallback, useEffect, useRef, useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { askLeafy } from '../leafy/leafyBrain'
import './leafyChat.css'

export default function LeafyChatBar() {
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const closeChat = useLeafyUi((s) => s.closeChat)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [bubble, setBubble] = useState('Hvad skal vi finde på i dag?')
  const [history, setHistory] = useState([])
  const inputRef = useRef()
  const recRef = useRef(null)

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus()
  }, [chatOpen])

  const send = useCallback(
    async (e) => {
      e?.preventDefault()
      const text = input.trim()
      if (!text || pending) return
      setInput('')
      setPending(true)
      setBubble('Hmm…')
      const nextHistory = [...history, { role: 'user', content: text }]
      const answer = await askLeafy(text, nextHistory)
      setHistory([...nextHistory, { role: 'assistant', content: answer }])
      setBubble(answer)
      setPending(false)
    },
    [input, pending, history]
  )

  const microphone = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Speech) {
      setBubble('Din browser understøtter ikke diktering endnu.')
      return
    }
    if (listening && recRef.current) {
      recRef.current.stop()
      setListening(false)
      return
    }
    const rec = new Speech()
    rec.lang = 'da-DK'
    rec.onresult = (ev) => {
      const said = ev.results[0]?.[0]?.transcript || ''
      setInput(said)
      setListening(false)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  if (!chatOpen) return null

  return (
    <div className="wl-room-bottom">
      <div className="wl-room-bubble" aria-live="polite">
        {bubble}
      </div>
      <form className="wl-room-composer" onSubmit={send}>
        <div className="wl-room-input">
          <input
            ref={inputRef}
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
