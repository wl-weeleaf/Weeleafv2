import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { LeafyNPC } from '../leafy/LeafyNPC'

const PNG_URL = '/leafy-center.png'
const LEAFY_ASPECT = 553 / 705

function PngFallback() {
  const { size } = useThree()
  const mobile = size.width < 768
  const texture = useTexture(PNG_URL)
  const height = (mobile ? 6.5 : 7.4) * 0.25
  return (
    <Billboard follow position={[0, 0.15, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[height * LEAFY_ASPECT, height]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.08} depthWrite toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const holder = useRef()
  const npcRef = useRef(null)
  const [model, setModel] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    LeafyNPC.load('/leafy')
      .then((npc) => {
        if (cancelled) {
          npc.dispose()
          return
        }
        npc.setMouth('AA')
        npcRef.current = npc
        setModel(npc.model)
      })
      .catch((err) => {
        console.warn('[CenterLeafy]', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      npcRef.current?.dispose()
      npcRef.current = null
    }
  }, [])

  useFrame((state, rawDt) => {
    const npc = npcRef.current
    if (!npc) return
    const dt = Math.min(rawDt, 0.05)
    const active = Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02
    npc.update(dt, new THREE.Vector2(state.pointer.x, state.pointer.y), active, 'idle', 'idle', true, true, 'idle')
    npc.setMouth('AA')
  })

  if (failed) return <PngFallback />
  if (!model) return null

  const scale = (mobile ? 3.2 : 3.8) * 0.25

  return (
    <group ref={holder} position={[0, 0.35, 0]} scale={scale}>
      <primitive object={model} />
    </group>
  )
}
