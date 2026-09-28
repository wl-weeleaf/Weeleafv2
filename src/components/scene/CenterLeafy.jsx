import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import useLeafyUi from '../../store/leafyUi'

const GLB_CANDIDATES = ['/leafy/leafy.glb', '/leafy-npc.glb']

function hideExtras(root) {
  root.traverse((obj) => {
    if (/hand|shoe|foot|hemp|ivory_sole|green_collar|green_strap/i.test(obj.name || '')) {
      obj.visible = false
    }
    if (obj.isMesh) {
      obj.frustumCulled = false
      if (obj.material) obj.material.side = THREE.DoubleSide
    }
  })
  const box = new THREE.Box3()
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (obj.isMesh && obj.visible) box.expandByObject(obj)
  })
  if (!box.isEmpty()) root.position.sub(box.getCenter(new THREE.Vector3()))
  return root
}

function loadFirstGltf(urls) {
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    const next = (i) => {
      if (i >= urls.length) {
        reject(new Error('Ingen Leafy-GLB fundet'))
        return
      }
      loader.load(
        urls[i],
        (gltf) => resolve(gltf),
        undefined,
        () => next(i + 1)
      )
    }
    next(0)
  })
}

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const group = useRef()
  const clickTimer = useRef(0)
  const gaze = useRef(new THREE.Vector2())
  const head = useRef(new THREE.Vector2())
  const [model, setModel] = useState(null)
  const follow = useLeafyUi((s) => s.follow)
  const blink = useLeafyUi((s) => s.blink)
  const motion = useLeafyUi((s) => s.motion)
  const openChat = useLeafyUi((s) => s.openChat)
  const openMenu = useLeafyUi((s) => s.openMenu)

  useEffect(() => {
    let cancelled = false
    loadFirstGltf(GLB_CANDIDATES)
      .then((gltf) => {
        if (cancelled) return
        setModel(hideExtras(gltf.scene.clone(true)))
      })
      .catch((err) => console.warn('[CenterLeafy]', err))
    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, rawDt) => {
    if (!group.current) return
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const active = follow && (Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02)
    const desired = active
      ? new THREE.Vector2(state.pointer.x, state.pointer.y)
      : new THREE.Vector2(Math.sin(t * 0.47) * 0.17, Math.sin(t * 0.31) * 0.09)
    gaze.current.lerp(desired, 1 - Math.exp(-dt * 12))
    head.current.lerp(desired, 1 - Math.exp(-dt * 3))

    const g = group.current
    g.rotation.y = head.current.x * 0.22
    g.rotation.x = -head.current.y * 0.1
    g.rotation.z = motion === 'still' ? 0 : Math.sin(t * 0.8) * 0.015
    if (motion === 'hop') g.position.y = 0.35 + Math.max(0, Math.sin(t * 6)) * 0.17
    else if (motion === 'still') g.position.y = 0.35
    else g.position.y = 0.35 + Math.sin(t * 1.35) * 0.035

    const eyes = []
    g.traverse((o) => {
      if (o.name === 'Eyes_sprite') eyes.push(o)
    })
    const open = blink ? 0.82 + Math.sin(t * 0.4) * 0.02 : 1
    const blinkNow = blink && Math.sin(t * 3.1) > 0.97
    eyes.forEach((eye) => {
      eye.scale.y = blinkNow ? 0.08 : open
      eye.position.x = gaze.current.x * 0.03
      eye.position.y = gaze.current.y * 0.02
    })
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

  if (!model) return null

  return (
    <group ref={group} position={[0, 0.35, 0]} scale={scale}>
      <primitive object={model} />
      <mesh position={[0, 0, 0.55]} onPointerDown={onPointerDown}>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
