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
  const [bubble, setBubble] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [openThread, setOpenThread] = useState(false)

  useEffect(() => {
    speech.current = new LeafySpeech(setSpeaking, setViseme, setError)
    return () => speech.current?.cancel()
  }, [setSpeaking, setViseme])

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
    setBubble('')
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
    <>
      {bubble && (
        <button type="button" className="wl-room-bubble wl-glass wl-leafy-stack" onClick={() => setOpenThread(true)}>{bubble}</button>
      )}
      <form className="wl-chat-bar" onSubmit={send}>
        <input aria-label={t(language, 'placeholder')} placeholder={t(language, 'placeholder')} value={input} maxLength={6000} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={!input.trim() || pending} aria-label={t(language, 'send')}>{'↑'}</button>
        <button type="button" onClick={microphone} aria-pressed={listening}>{listening ? '■' : '●'}</button>
        <button type="button" onClick={closeChat} aria-label={t(language, 'close')}>{'×'}</button>
      </form>
      {error && <p className="wl-room-notice wl-chat-error">{error}</p>}
      {openThread && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: 'rgba(20,10,6,.35)' }} onClick={() => setOpenThread(false)}>
          <article className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-3xl p-5" style={{ background: 'rgba(255,253,247,.96)', color: '#163821' }} onClick={(e) => e.stopPropagation()}>
            {messages.map((m, i) => <p key={i} className="mb-3 text-sm leading-6"><strong>{m.role === 'user' ? 'Dig' : 'Leafy'}:</strong> {m.content}</p>)}
            <button className="rounded-full px-4 py-2 text-sm" style={{ background: '#163821', color: '#fffdf7' }} onClick={() => setOpenThread(false)}>Luk</button>
          </article>
        </div>
      )}
    </>
  )
}
