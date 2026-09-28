import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { orbitState } from '../../data/orbitState'
import { FaceSpriteLayers } from './FaceSpriteLayers'

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

function bindFace(root, face) {
  root.traverse((obj) => {
    obj.raycast = () => {}
    obj.frustumCulled = false
    if (shouldHide(obj.name)) {
      obj.visible = false
      return
    }
    if (!obj.isMesh || !obj.material) return
    const mat = obj.material.clone()
    mat.side = THREE.DoubleSide
    mat.toneMapped = false
    if (obj.name === 'Eyes_sprite') {
      mat.map = face.eyes
      mat.transparent = true
      mat.depthWrite = false
      mat.alphaTest = 0.015
      obj.visible = true
    }
    if (obj.name === 'Mouth_sprite') {
      mat.map = face.mouth
      mat.transparent = true
      mat.depthWrite = false
      mat.alphaTest = 0.015
      obj.visible = true
    }
    obj.material = mat
  })
  face.setMouth('AA')
  return root
}

function PngFallback() {
  const { size, gl } = useThree()
  const mobile = size.width < 768
  const texture = useTexture(PNG_URL)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture, gl])
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
  const group = useRef()
  const faceRef = useRef(null)
  const life = useRef(new IdleLife())
  const gaze = useRef(new THREE.Vector2())
  const head = useRef(new THREE.Vector2())
  const blink = useRef({ at: 2.2, time: -1, elapsed: 0 })
  const lastOrbit = useRef(orbitState.angle)
  const [model, setModel] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const imageLoader = new THREE.ImageLoader()
    const gltfLoader = new GLTFLoader()

    Promise.all([
      new Promise((resolve, reject) => gltfLoader.load(GLB_URL, resolve, undefined, reject)),
      imageLoader.loadAsync('/leafy/original-torso.png'),
      imageLoader.loadAsync('/leafy/npc-base.png'),
    ])
      .then(([gltf, original, clean]) => {
        if (cancelled) return
        const face = new FaceSpriteLayers(original, clean)
        faceRef.current = face
        const root = gltf.scene.clone(true)
        bindFace(root, face)

        const box = new THREE.Box3()
        root.updateMatrixWorld(true)
        root.traverse((obj) => {
          if (obj.isMesh && obj.visible) box.expandByObject(obj)
        })
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          root.position.sub(center)
        }
        setModel(root)
      })
      .catch((err) => {
        console.warn('[CenterLeafy] kunne ikke loade torso-assets:', err)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useFrame((state, rawDt) => {
    if (!group.current || !faceRef.current) return
    const dt = Math.min(rawDt, 0.05)
    const t = (blink.current.elapsed += dt)
    const face = faceRef.current

    const pointerActive = Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02
    const dragging = Math.abs(orbitState.angle - lastOrbit.current) > 0.08
    lastOrbit.current = orbitState.angle

    const idle = life.current.update(dt, pointerActive || dragging)
    const desired = pointerActive
      ? new THREE.Vector2(THREE.MathUtils.clamp(state.pointer.x, -1, 1), THREE.MathUtils.clamp(state.pointer.y, -1, 1))
      : new THREE.Vector2(idle.x || Math.sin(t * 0.47) * 0.17, idle.y || Math.sin(t * 0.31) * 0.09)

    gaze.current.lerp(desired, 1 - Math.exp(-dt * 12))
    head.current.lerp(desired, 1 - Math.exp(-dt * 3))

    const modelGrp = group.current
    const s = modelGrp.userData.baseScale || 1
    modelGrp.rotation.y = head.current.x * 0.22 + idle.turn * 0.15
    modelGrp.rotation.x = -head.current.y * 0.1
    modelGrp.rotation.z = Math.sin(t * 0.8) * 0.015

    const hopPhase = t % 19
    const hop = hopPhase < 1.3 ? Math.sin((hopPhase / 1.3) * Math.PI) * 0.075 : 0
    modelGrp.position.y = 0.35 + Math.sin(t * 1.35) * 0.035 + hop

    const breath = Math.sin(t * 1.3) * 0.006
    modelGrp.scale.set(s * (1 - breath * 0.4), s * (1 + breath), s)

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

    face.setEyes(gaze.current.x, gaze.current.y, openness)
    face.setMouth('AA')
  })

  if (failed) return <PngFallback />
  if (!model) return null

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
      <primitive object={model} />
    </group>
  )
}
