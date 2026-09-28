import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const HIDDEN = new Set([
  'Leafy_floating_hands',
  'Left_hand',
  'Right_hand',
  'Image_hand',
  'Hand_rest_front',
  'Hand_rest_back',
  'Leafy_hemp_shoes',
  'Left_hemp_shoe',
  'Right_hemp_shoe',
])

function shouldHide(name) {
  if (!name) return false
  if (HIDDEN.has(name)) return true
  return /hand|shoe|foot|hemp/i.test(name)
}

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const group = useRef()
  const { scene } = useGLTF('/leafy-npc.glb')
  const mouthAtlas = useTexture('/leafy/mouths/atlas.png')

  const model = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((obj) => {
      obj.raycast = () => {}
      if (shouldHide(obj.name)) obj.visible = false
    })
    return root
  }, [scene])

  useEffect(() => {
    // Viseme AA = mest åben mund i 4x2-atlaset (index 2).
    mouthAtlas.colorSpace = THREE.SRGBColorSpace
    mouthAtlas.wrapS = THREE.ClampToEdgeWrapping
    mouthAtlas.wrapT = THREE.ClampToEdgeWrapping
    mouthAtlas.repeat.set(0.25, 0.5)
    mouthAtlas.offset.set(0.5, 0.5)
    mouthAtlas.needsUpdate = true

    model.traverse((obj) => {
      if (obj.name !== 'Mouth_sprite' || !obj.material) return
      obj.visible = true
      obj.material = obj.material.clone()
      obj.material.map = mouthAtlas
      obj.material.transparent = true
      obj.material.depthWrite = false
      obj.material.needsUpdate = true
    })
  }, [model, mouthAtlas])

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.position.y = 0.2 + Math.sin(t * 1.25) * 0.07
    group.current.rotation.y = Math.sin(t * 0.35) * 0.06
  })

  const scale = mobile ? 2.1 : 2.5

  return (
    <group ref={group} position={[0, 0.2, 0]} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

useGLTF.preload('/leafy-npc.glb')
