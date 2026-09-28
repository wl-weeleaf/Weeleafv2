import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'

const GLB_URL = '/leafy-npc.glb'
const PNG_URL = '/leafy-center.png'
const LEAFY_ASPECT = 553 / 705

function shouldHide(name) {
  if (!name) return false
  return /hand|shoe|foot|hemp|ivory_sole|green_collar|green_strap/i.test(name)
}

function prepareModel(scene) {
  const root = scene.clone(true)

  root.traverse((obj) => {
    obj.raycast = () => {}
    if (shouldHide(obj.name)) {
      obj.visible = false
      return
    }
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => {
        m.side = THREE.DoubleSide
        m.toneMapped = false
        if (obj.name === 'Mouth_sprite') {
          m.transparent = true
          m.depthWrite = false
          // Gør den bagte mund-sprite lidt højere, så den læses som åben.
          obj.scale.y = Math.max(obj.scale.y, 1.35)
          obj.visible = true
        }
      })
    }
  })

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
  return root
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

  const height = mobile ? 6.5 : 7.4
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
  const [model, setModel] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      GLB_URL,
      (gltf) => {
        if (cancelled) return
        setModel(prepareModel(gltf.scene))
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

  useFrame(({ clock }) => {
    if (!group.current) return
    const t = clock.elapsedTime
    group.current.position.y = 0.35 + Math.sin(t * 1.25) * 0.07
    group.current.rotation.y = Math.sin(t * 0.35) * 0.08
  })

  if (failed) return <PngFallback />
  if (!model) return null

  const scale = mobile ? 3.2 : 3.8

  return (
    <group ref={group} position={[0, 0.35, 0]} scale={scale}>
      <primitive object={model} />
    </group>
  )
}
