import React, { useRef, useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { ChatStreamParser } from '../../lib/livi/protocol'
import { startDictation } from '../leafy/Dictation'
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
  const [bubble, setBubble] = useState('Hvad skal vi finde på i dag?')
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
    setBubble('Hmm…')
    let answer = ''
    let complete = false
    try {
      const res = await fetch('/api/livi/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok) throw Error(((await res.json()) as never) || 'Forbindelsen kunne ikke svare.')
      if (!res.body) throw Error('Svaret mangler.')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const parser = new ChatStreamParser()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (generation !== seq.current) return
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            if (event === '[DONE]') {
              complete = true
              continue
            }
            const data = JSON.parse(event)
            if (data.error) throw Error('Svaret blev afbrudt.')
            const delta = data.choices?.[0]?.delta?.content
            if (typeof delta === 'string') {
              answer += delta
              setBubble(answer)
            }
            if (data.choices?.[0]?.finish_reason) complete = true
          }
        }
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
      if (generation !== seq.current) return
      if (!complete || !answer.trim()) throw Error('Svaret er ufuldstændigt. Prøv igen.')
      setMessages([...history, { role: 'assistant', content: answer }])
    } catch (err) {
      if (generation === seq.current && err.name !== 'AbortError') {
        setError(err.message || 'AI-forbindelsen er ikke tilkoblet endnu.')
        setBubble(answer || 'Vi mangler forbindelse. Prøv igen om lidt.')
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
