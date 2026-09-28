import React, { useCallback, useEffect, useRef, useState } from 'react'
import useLeafyUi from '../../store/leafyUi'

const SYSTEM = `You are Leafy, WeeLeaf guide. Short warm answers in Danish unless the user writes English.`

export default function LeafyChatBar() {
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const closeChat = useLeafyUi((s) => s.closeChat)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [bubble, setBubble] = useState('Hvad skal vi finde på i dag?')
  const inputRef = useRef()

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
      try {
        const res = await fetch('/api/livi/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: text },
            ],
          }),
        })
        if (!res.ok) throw new Error('offline')
        const data = await res.json().catch(() => ({}))
        const answer =
          data.reply || data.content || data.choices?.[0]?.message?.content || ''
        setBubble(answer || 'Jeg er her. AI er ikke tilkoblet endnu — prøv igen senere.')
      } catch {
        setBubble('Jeg hørte dig. AI er endnu ikke tilkoblet, men chatten er klar.')
      } finally {
        setPending(false)
      }
    },
    [input, pending]
  )

  if (!chatOpen) return null

  return (
    <div className="fixed bottom-8 left-1/2 z-40 w-[min(640px,calc(100vw-24px))] -translate-x-1/2">
      <div className="mb-2 text-center text-sm text-emerald-200/90">{bubble}</div>
      <form
        onSubmit={send}
        className="flex items-center gap-2 rounded-full px-3 py-2"
        style={{
          background: 'rgba(20,10,6,0.72)',
          border: '1px solid rgba(200,140,80,0.28)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <input
          ref={inputRef}
          aria-label="Skriv til Leafy"
          placeholder="Skriv til Leafy…"
          value={input}
          maxLength={6000}
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={!input.trim() || pending}
          className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'rgba(74,222,128,0.22)', color: '#bbf7d0', border: '1px solid rgba(74,222,128,0.35)' }}
        >
          Send
        </button>
        <button type="button" onClick={closeChat} className="px-2 text-white/45 hover:text-white">
          ×
        </button>
      </form>
    </div>
  )
}
