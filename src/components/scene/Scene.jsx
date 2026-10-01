import React, { useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei'
import * as THREE from 'three'
import { gsap } from 'gsap'
import LifeTree from './LifeTree'
import { USE_TREE } from './WeeleafEmblem'
import CenterLeafy from './CenterLeafy'
import OrbitingCoins from './OrbitingCoins'
import { orbitState, markOrbitManual } from '../../data/orbitState'
import useStore from '../../store/useStore'
import { useGraphicsTier } from '../../hooks/useLiteGraphics'

function Lighting({ shadows }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 18, 6]} intensity={1.4} castShadow={shadows} />
      <directionalLight position={[-5, 5, 8]} intensity={0.4} color="#ffe0a0" />
    </>
  )
}

function SceneContents({ shadows }) {
  return (
    <>
      <Lighting shadows={shadows} />
      {USE_TREE ? <LifeTree /> : (
        <Suspense fallback={null}>
          <CenterLeafy />
        </Suspense>
      )}
      <OrbitingCoins />
    </>
  )
}

export default function Scene() {
  const tier = useGraphicsTier()
  const reducedQuality = tier !== 'full'
  const shadows = !reducedQuality

  useEffect(() => {
    const modal = () => useStore.getState().isModalOpen
    const handleWheel = (e) => {
      if (modal()) return
      e.preventDefault()
      markOrbitManual()
      const raw = e.deltaX !== 0 ? e.deltaX : e.deltaY
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1
      gsap.to(orbitState, { angle: orbitState.angle + raw * unit * 0.252, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
    }
    let touchStartX = 0
    const handleTouchStart = (e) => { if (!modal()) touchStartX = e.touches[0].clientX }
    const handleTouchMove = (e) => {
      if (modal()) return
      markOrbitManual()
      const dx = touchStartX - e.touches[0].clientX
      touchStartX = e.touches[0].clientX
      gsap.to(orbitState, { angle: orbitState.angle + dx * 0.35, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return (
    <Canvas
      frameloop="always"
      dpr={reducedQuality ? [1, 1.25] : [1, 2]}
      camera={{ position: [0, 1.5, 15], fov: 50, near: 0.1, far: 100 }}
      shadows={shadows}
      style={{ position: 'absolute', inset: 0 }}
      gl={{ antialias: !reducedQuality, alpha: true, powerPreference: reducedQuality ? 'default' : 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        scene.background = null
      }}
    >
      <AdaptiveDpr pixelated={reducedQuality} />
      <AdaptiveEvents />
      <SceneContents shadows={shadows} />
    </Canvas>
  )
}
