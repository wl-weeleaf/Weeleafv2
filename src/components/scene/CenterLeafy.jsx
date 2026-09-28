import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LeafyNPC } from '../leafy/LeafyNPC'
import useLeafyUi from '../../store/leafyUi'

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const npc = useMemo(() => LeafyNPC.create(), [])
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const look = useRef(new THREE.Vector2())
  const clickTimer = useRef(0)
  const follow = useLeafyUi((s) => s.follow)
  const blink = useLeafyUi((s) => s.blink)
  const motion = useLeafyUi((s) => s.motion)
  const openChat = useLeafyUi((s) => s.openChat)
  const openMenu = useLeafyUi((s) => s.openMenu)

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const active = follow && (Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02)
    look.current.set(state.pointer.x, state.pointer.y)
    npc.update(dt, look.current, active)
    if (!blink) {
      npc.eyes.forEach((eye) => {
        eye.scale.y = 1
        eye.visible = true
      })
    }
    if (motion === 'still') {
      npc.model.position.y = 0
      npc.model.rotation.z = 0
    }
    if (motion === 'hop') {
      npc.model.position.y = Math.max(0, Math.sin(state.clock.elapsedTime * 6)) * 0.17
    }
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

  return (
    <group position={[0, 0.35, 0]} scale={scale}>
      <primitive object={npc.model} />
      <mesh position={[0, 0, 0.55]} onPointerDown={onPointerDown}>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
