import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LayeredLeafyNPC } from '../leafy/LayeredLeafyNPC'
import { CameraGaze } from '../leafy/CameraGaze'
import useLeafyUi from '../../store/leafyUi'
import { orbitState } from '../../data/orbitState'
import { ORBIT_HEIGHT } from '../../data/coinData'
import useStore from '../../store/useStore'

const PASSES = 10

function ballBounce(p) {
  const hits = p * 3
  const n = Math.floor(hits)
  const local = hits - n
  return Math.abs(Math.sin(local * Math.PI)) * Math.pow(0.55, n)
}

export default function CenterLeafy() {
  const { size, camera } = useThree()
  const mobile = size.width < 768
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const holder = useRef()
  const npcRef = useRef(null)
  const gazeRef = useRef(null)
  const spinTime = useRef(-1)
  const eyeRoll = useRef(-1)
  const passes = useRef(0)
  const prevFront = useRef(false)
  const clickTimer = useRef(0)
  const pointer = useRef(new THREE.Vector2())
  const [ready, setReady] = useState(false)
  const follow = useLeafyUi((s) => s.follow)
  const blink = useLeafyUi((s) => s.blink)
  const motion = useLeafyUi((s) => s.motion)
  const chatOpen = useLeafyUi((s) => s.chatOpen)
  const speaking = useLeafyUi((s) => s.speaking)
  const viseme = useLeafyUi((s) => s.viseme)
  const cameraOn = useLeafyUi((s) => s.cameraOn)
  const openChat = useLeafyUi((s) => s.openChat)
  const openMenu = useLeafyUi((s) => s.openMenu)
  const setCameraStatus = useLeafyUi((s) => s.setCameraStatus)
  const setOrbitProgress = useLeafyUi((s) => s.setOrbitProgress)
  const baseY = ORBIT_HEIGHT + 0.72 + 3.4 * scale * 0.5

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
        window.dispatchEvent(new Event('leafy-ready'))
      })
      .catch((err) => console.warn('[LayeredLeafyNPC]', err))
    gazeRef.current = new CameraGaze((status) => setCameraStatus(status))
    return () => {
      cancelled = true
      gazeRef.current?.stop()
    }
  }, [setCameraStatus])

  useEffect(() => {
    if (cameraOn) gazeRef.current?.start()
    else gazeRef.current?.stop()
  }, [cameraOn])

  useFrame((state, rawDt) => {
    const npc = npcRef.current
    const group = holder.current
    if (!npc || !group) return
    const dt = Math.min(rawDt, 0.05)
    const coins = useStore.getState().coins
    const core = coins.find((c) => c.id === 'wl-core') || coins[0]
    const camDir = camera.position.clone().setY(0).normalize()
    const coreAngle = (((core?.angle || 0) + orbitState.angle) * Math.PI) / 180
    const coreDir = new THREE.Vector3(Math.cos(coreAngle), 0, Math.sin(coreAngle))
    const inFront = coreDir.dot(camDir) > 0.94
    if (inFront && !prevFront.current && eyeRoll.current < 0 && spinTime.current < 0) {
      passes.current += 1
      if (passes.current >= PASSES) {
        passes.current = 0
        eyeRoll.current = 0
      }
    }
    prevFront.current = inFront
    setOrbitProgress(passes.current / PASSES)

    let lift = 0
    let spin = 0
    if (eyeRoll.current >= 0) {
      eyeRoll.current += dt
      const p = Math.min(1, eyeRoll.current / 0.9)
      npc.face?.setEyeRoll?.(p * Math.PI * 2)
      if (p === 1) {
        eyeRoll.current = -1
        npc.face?.setEyeRoll?.(0)
        spinTime.current = 0
      }
    }
    if (spinTime.current >= 0) {
      spinTime.current += dt
      const p = Math.min(1, spinTime.current / 1.6)
      lift = ballBounce(p) * 1.15
      spin = Math.PI * 2 * (p * p * (3 - 2 * p))
      if (p === 1) spinTime.current = -1
    }
    group.position.y = baseY + lift
    group.rotation.y = spin
    group.scale.setScalar(scale)

    const camPoint = gazeRef.current?.point
    if (camPoint) pointer.current.set(camPoint.x, camPoint.y)
    else pointer.current.set(state.pointer.x, state.pointer.y)

    const active = follow && (Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02 || Boolean(camPoint))
    npc.update(dt, pointer.current, active, 'idle', speaking ? 'speaking' : chatOpen ? 'attentive' : 'idle', blink, follow || Boolean(camPoint), motion)
    npc.setMouth(speaking ? viseme : 'AA')
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
