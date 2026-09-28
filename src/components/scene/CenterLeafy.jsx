import React, { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LeafyNPC } from '../leafy/LeafyNPC'

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const npc = useMemo(() => LeafyNPC.create(), [])
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const look = useRef(new THREE.Vector2())

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const active = Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02
    look.current.set(state.pointer.x, state.pointer.y)
    npc.update(dt, look.current, active)
  })

  return (
    <group position={[0, 0.35, 0]} scale={scale}>
      <primitive object={npc.model} />
    </group>
  )
}
