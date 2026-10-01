import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { LayeredLeafyNPC } from '../leafy/LayeredLeafyNPC'
import useStore from '../../store/useStore'
import useLeafyUi from '../../store/leafyUi'
import { LeafySpeech } from '../leafy/LeafySpeech'
import './leafyChat.css'

const mouse = { x: 0, y: 0 }

function SameLeafy() {
  const npcRef = useRef(null)
  const [ready, setReady] = useState(false)
  const follow = useLeafyUi((s) => s.follow)
  const blink = useLeafyUi((s) => s.blink)
  const motion = useLeafyUi((s) => s.motion)
  const speaking = useLeafyUi((s) => s.speaking)
  const viseme = useLeafyUi((s) => s.viseme)

  useEffect(() => {
    let cancelled = false
    LayeredLeafyNPC.load('/leafy').then((npc) => {
      if (cancelled) return
      npc.setAccessories(false, false)
      npc.setMouth('AA')
      npc.setLayers(true, true)
      npcRef.current = npc
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  useFrame((_, dt) => {
    const npc = npcRef.current
    if (!npc) return
    npc.update(Math.min(dt, 0.05), mouse, true, 'idle', speaking ? 'speaking' : 'attentive', blink, follow, motion)
    npc.setMouth(speaking ? viseme : 'AA')
  })

  if (!ready || !npcRef.current) return null
  return (
    <group position={[0, -0.05, 0]} scale={0.34}>
      <primitive object={npcRef.current.model} />
    </group>
  )
}

function modalText(coin) {
  if (!coin) return ''
  const bits = [coin.content?.title, coin.content?.tagline]
  for (const section of coin.content?.sections || []) {
    if (section.heading) bits.push(section.heading)
    if (section.text) bits.push(section.text)
  }
  return bits.filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 420)
}

export default function CornerLeafy() {
  const open = useStore((s) => s.isModalOpen)
  const coin = useStore((s) => s.activeCoin)
  const openChat = useLeafyUi((s) => s.openChat)
  const openMenu = useLeafyUi((s) => s.openMenu)
  const setSpeaking = useLeafyUi((s) => s.setSpeaking)
  const setViseme = useLeafyUi((s) => s.setViseme)
  const speech = useRef(null)
  const [bubble, setBubble] = useState('')
  const [landed, setLanded] = useState(false)
  const text = useMemo(() => modalText(coin), [coin])

  useEffect(() => {
    const onMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    speech.current = new LeafySpeech(setSpeaking, setViseme, () => {})
    return () => speech.current?.cancel()
  }, [setSpeaking, setViseme])

  useEffect(() => {
    if (!open) {
      setLanded(false)
      setBubble('')
      speech.current?.cancel()
      return
    }
    openChat()
    const line = text || 'Jeg kan læse det her op for dig.'
    setBubble(line)
    const fly = setTimeout(() => setLanded(true), 1800)
    const read = setTimeout(() => speech.current?.speak(line), 1800)
    return () => {
      clearTimeout(fly)
      clearTimeout(read)
    }
  }, [open, text, openChat])

  if (!open) return null

  return (
    <>
      {bubble && <div className="wl-room-bubble wl-glass wl-readout">{bubble}</div>}
      <div className={landed ? 'wl-corner is-landed' : 'wl-corner'}>
        <div className="wl-corner-stage" onClick={openChat} onDoubleClick={openMenu}>
          <Canvas camera={{ position: [0, 0.2, 3.6], fov: 32 }} gl={{ alpha: true, antialias: true }} style={{ width: 220, height: 240, background: 'transparent' }}>
            <ambientLight intensity={1.1} />
            <SameLeafy />
          </Canvas>
        </div>
      </div>
    </>
  )
}
