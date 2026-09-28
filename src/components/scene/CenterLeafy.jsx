import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { orbitState } from '../../data/orbitState'

const GLB_URL = '/leafy-npc.glb'
const PNG_URL = '/leafy-center.png'
const LEAFY_ASPECT = 553 / 705

function shouldHide(name) {
  if (!name) return false
  return /hand|shoe|foot|hemp|ivory_sole|green_collar|green_strap/i.test(name)
}

class IdleLife {
  wait = 3.5
  elapsed = 0
  duration = 0
  side = 1
  choice = 0
  update(dt, blocked) {
    if (blocked) {
      this.wait = 3.5
      this.elapsed = 0
      this.duration = 0
      return { x: 0, y: 0, turn: 0 }
    }
    if (this.duration === 0) {
      this.wait -= dt
      if (this.wait > 0) return { x: 0, y: 0, turn: 0 }
      this.duration = 3 + Math.random() * 2
      this.elapsed = 0
      this.side = Math.random() < 0.5 ? -1 : 1
    }
    this.elapsed += dt
    const progress = Math.min(1, this.elapsed / this.duration)
    const envelope = Math.sin(progress * Math.PI)
    if (progress === 1) {
      this.duration = 0
      this.wait = 5 + Math.random() * 8
    }
    return {
      x: this.side * envelope * 0.9,
      y: Math.sin(progress * Math.PI * 2) * 0.3,
      turn: this.side * envelope * 0.42,
    }
  }
}

function prepareModel(scene) {
  const root = scene.clone(true)
  const parts = { eyes: null, brows: null, mouth: null, torso: root }

  root.traverse((obj) => {
    obj.raycast = () => {}
    obj.frustumCulled = false
    if (shouldHide(obj.name)) {
      obj.visible = false
      return
    }
    if (obj.name === 'Eyes_sprite') parts.eyes = obj
    if (obj.name === 'Brows_sprite') parts.brows = obj
    if (obj.name === 'Mouth_sprite') parts.mouth = obj
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => {
        m.side = THREE.DoubleSide
        m.toneMapped = false
      })
    }
  })

  if (parts.mouth) {
    parts.mouth.visible = true
    parts.mouth.scale.y = 1.45
    if (parts.mouth.material) {
      parts.mouth.material = parts.mouth.material.clone()
      parts.mouth.material.transparent = true
      parts.mouth.material.depthWrite = false
    }
  }

  const box = new THREE.Box3()
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (obj.isMesh && obj.visible) box.expandByObject(obj)
  })
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.y -= center.y
    root.position.z -= center.z
  }

  if (parts.eyes) parts.eyes.userData.baseScale = parts.eyes.scale.clone()
  if (parts.brows) parts.brows.userData.baseY = parts.brows.position.y
  if (parts.eyes) parts.eyes.userData.basePos = parts.eyes.position.clone()

  return { root, parts }
}

function PngFallback() {
  const { size, gl } = useThree()
  const mobile = size.width < 768
  const texture = useTexture(PNG_URL)

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    texture.needsUpdate = true
  }, [texture, gl])

  const height = (mobile ? 6.5 : 7.4) * 0.25
  const width = height * LEAFY_ASPECT

  return (
    <Billboard follow position={[0, 0.15, 0]}>
      <mesh raycast={() => null}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.08} depthWrite toneMapped={false} />
      </mesh>
    </Billboard>
  )
}

export default function CenterLeafy() {
  const { size } = useThree()
  const mobile = size.width < 768
  const group = useRef()
  const life = useRef(new IdleLife())
  const gaze = useRef(new THREE.Vector2())
  const head = useRef(new THREE.Vector2())
  const blink = useRef({ at: 2.2, time: -1, elapsed: 0 })
  const lastOrbit = useRef(orbitState.angle)
  const [bundle, setBundle] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      GLB_URL,
      (gltf) => {
        if (!cancelled) setBundle(prepareModel(gltf.scene))
      },
      undefined,
      (err) => {
        console.warn('[CenterLeafy] GLB kunne ikke loades:', err)
        if (!cancelled) setFailed(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, rawDt) => {
    if (!group.current || !bundle) return
    const dt = Math.min(rawDt, 0.05)
    const t = (blink.current.elapsed += dt)
    const { parts } = bundle

    const pointerActive = state.pointer.x !== 0 || state.pointer.y !== 0
    const dragging = Math.abs(orbitState.angle - lastOrbit.current) > 0.08
    lastOrbit.current = orbitState.angle

    const idle = life.current.update(dt, pointerActive || dragging)
    const desired = pointerActive
      ? new THREE.Vector2(state.pointer.x, state.pointer.y)
      : new THREE.Vector2(
          idle.x || Math.sin(t * 0.47) * 0.17,
          idle.y || Math.sin(t * 0.31) * 0.09
        )

    gaze.current.lerp(desired, 1 - Math.exp(-dt * 12))
    head.current.lerp(desired, 1 - Math.exp(-dt * 3))

    const model = group.current
    model.rotation.y = head.current.x * 0.22 + idle.turn * 0.15
    model.rotation.x = -head.current.y * 0.1
    model.rotation.z = Math.sin(t * 0.8) * 0.015

    const hopPhase = t % 19
    const hop = hopPhase < 1.3 ? Math.sin((hopPhase / 1.3) * Math.PI) * 0.075 : 0
    model.position.y = 0.35 + Math.sin(t * 1.35) * 0.035 + hop

    const stretch = t % 47
    if (stretch > 36 && stretch < 39) {
      const a = Math.sin(((stretch - 36) / 3) * Math.PI) * 0.018
      model.scale.set(model.userData.baseScale * (1 - a * 0.35), model.userData.baseScale * (1 + a), model.userData.baseScale)
    } else {
      const s = model.userData.baseScale
      const breath = Math.sin(t * 1.3) * 0.006
      model.scale.set(s * (1 - breath * 0.4), s * (1 + breath), s)
    }

    if (t > blink.current.at && blink.current.time < 0) {
      blink.current.time = 0
      blink.current.at = t + (Math.random() < 0.16 ? 0.34 : 2.7 + Math.random() * 3)
    }
    let openness = 1
    if (blink.current.time >= 0) {
      blink.current.time += dt
      openness = 1 - Math.sin(Math.min(1, blink.current.time / 0.19) * Math.PI)
      if (blink.current.time > 0.19) blink.current.time = -1
    }

    if (parts.eyes) {
      const base = parts.eyes.userData.baseScale || new THREE.Vector3(1, 1, 1)
      parts.eyes.scale.set(base.x, Math.max(0.08, base.y * openness), base.z)
      const bp = parts.eyes.userData.basePos || parts.eyes.position
      parts.eyes.position.x = bp.x + gaze.current.x * 0.04
      parts.eyes.position.y = bp.y + gaze.current.y * 0.03
    }
    if (parts.brows && parts.brows.userData.baseY != null) {
      parts.brows.position.y = parts.brows.userData.baseY + gaze.current.y * 0.02
      parts.brows.rotation.z = gaze.current.x * 0.08
    }
    if (parts.mouth) {
      parts.mouth.scale.y = 1.45 + Math.sin(t * 2.2) * 0.06
    }
  })

  if (failed) return <PngFallback />
  if (!bundle) return null

  const scale = (mobile ? 3.2 : 3.8) * 0.25

  return (
    <group
      ref={(node) => {
        group.current = node
        if (node) node.userData.baseScale = scale
      }}
      position={[0, 0.35, 0]}
      scale={scale}
    >
      <primitive object={bundle.root} />
    </group>
  )
}
