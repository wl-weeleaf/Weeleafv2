import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LayeredLeafyNPC } from '../leafy/LayeredLeafyNPC'
import useLeafyUi from '../../store/leafyUi'

export default function CenterLeafy() {
  const { size, camera } = useThree()
  const mobile = size.width < 768
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const holder = useRef()
  const npcRef = useRef(null)
  const clickTimer = useRef(0)
  const pointer = useRef(new THREE.Vector2())
  const [ready, setReady] = useState(false)
  const follow = useLeafyUi((s) => s.follow)
  const blink = useLeafyUi((s) => s.blink)
  const motion = useLeafyUi((s) => s.motion)
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const openChat = useLeafyUi((s) => s.openChat)
  const openMenu = useLeafyUi((s) => s.openMenu)
  const baseY = 0.35 + 3.4 * scale * 0.25

  useEffect(() => {
    let cancelled = false
    LayeredLeafyNPC.load('/leafy')
      .then((npc) => {
        if (cancelled) return
        npc.setAccessories(false, false)
        npc.setMouth('AA')
        npc.setLayers(true, true)
        npcRef.current = npc
        setReady(true)
      })
      .catch((err) => console.warn('[LayeredLeafyNPC]', err))
    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, rawDt) => {
    const npc = npcRef.current
    if (!npc) return
    const dt = Math.min(rawDt, 0.05)
    const active = follow && (Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02)
    pointer.current.set(state.pointer.x, state.pointer.y)
    const poseState = chatOpen ? 'attentive' : 'idle'
    npc.update(dt, pointer.current, active, 'idle', poseState, blink, follow, motion)
    npc.setMouth('AA')
    npc.setAccessories(false, false)
    npc.orientAccessories(camera.position)
  })

  const onPointerDown = (e) => {
    e.stopPropagation()
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = 0
      openMenu()
      return
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = 0
      openChat()
    }, 260)
  }

  if (!ready || !npcRef.current) return null

  return (
    <group ref={holder} position={[0, baseY, 0]} scale={scale}>
      <primitive object={npcRef.current.model} />
      <mesh position={[0, 0, 0.55]} onPointerDown={onPointerDown}>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
