import React, { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../../store/useStore'
import useLeafyUi from '../../store/leafyUi'
import { LeafySpeech } from '../leafy/LeafySpeech'
import LeafyChatBar from './LeafyChatBar'
import './leafyChat.css'

function modalText(coin) {
  if (!coin) return ''
  const bits = [coin.content?.title, coin.content?.tagline]
  for (const section of coin.content?.sections || []) {
    if (section.heading) bits.push(section.heading)
    if (section.text) bits.push(section.text)
  }
  return bits.filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 700)
}

export default function CornerLeafy() {
  const open = useStore((s) => s.isModalOpen)
  const coin = useStore((s) => s.activeCoin)
  const openChat = useLeafyUi((s) => s.openChat)
  const setSpeaking = useLeafyUi((s) => s.setSpeaking)
  const setViseme = useLeafyUi((s) => s.setViseme)
  const speech = useRef(null)
  const [bubble, setBubble] = useState('')
  const text = useMemo(() => modalText(coin), [coin])

  useEffect(() => {
    speech.current = new LeafySpeech(setSpeaking, setViseme, () => {})
    return () => speech.current?.cancel()
  }, [setSpeaking, setViseme])

  useEffect(() => {
    if (!open) {
      setBubble('')
      speech.current?.cancel()
      return
    }
    openChat()
    const read = setTimeout(() => {
      const line = text || 'Jeg kan læse det her op for dig.'
      setBubble(line)
      speech.current?.speak(line)
    }, 700)
    return () => clearTimeout(read)
  }, [open, text, openChat])

  if (!open) return null

  return (
    <div className="wl-corner is-landed">
      <div className="wl-room-bubble wl-corner-bubble">{bubble || 'Jeg flyver derned…'}</div>
      <div className="wl-corner-chat">
        <LeafyChatBar />
      </div>
    </div>
  )
}
