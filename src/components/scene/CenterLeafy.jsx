import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LayeredLeafyNPC } from '../leafy/LayeredLeafyNPC'
import { CameraGaze } from '../leafy/CameraGaze'
import { OrbitGesture } from '../leafy/OrbitGesture'
import useLeafyUi from '../../store/leafyUi'
import { ORBIT_HEIGHT } from '../../data/coinData'

export default function CenterLeafy() {
  const { size, camera, controls } = useThree()
  const mobile = size.width < 768
  const scale = (mobile ? 3.2 : 3.8) * 0.25
  const npcRef = useRef(null)
  const gazeRef = useRef(null)
  const gesture = useRef(new OrbitGesture(2))
  const spinTime = useRef(-1)
  const cooldown = useRef(0)
  const yaw = useRef(0)
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
      })
      .catch((err) => console.warn('[LayeredLeafyNPC]', err))
    gazeRef.current = new CameraGaze((status) => setCameraStatus(status))
    return () => {
      cancelled = true
      gazeRef.current?.stop()
    }
  }, [setCameraStatus])

  useEffect(() => {
    const gaze = gazeRef.current
    if (!gaze) return
    if (cameraOn) gaze.start()
    else gaze.stop()
  }, [cameraOn])

  useFrame((state, rawDt) => {
    const npc = npcRef.current
    if (!npc) return
    const dt = Math.min(rawDt, 0.05)
    const azimuth = controls?.getAzimuthalAngle?.() ?? Math.atan2(camera.position.x, camera.position.z)
    const dragging = Boolean(controls?.state === 2 || state.pointer.buttons)
    if (gesture.current.update(azimuth, dragging, dt)) {
      spinTime.current = 0
      cooldown.current = 2.5
    }
    setOrbitProgress(gesture.current.progress)
    yaw.current += Math.atan2(Math.sin(azimuth - yaw.current), Math.cos(azimuth - yaw.current)) * (1 - Math.exp(-dt * 4))
    cooldown.current = Math.max(0, cooldown.current - dt)
    let lift = 0
    let spin = 0
    if (spinTime.current >= 0) {
      spinTime.current += dt
      const p = Math.min(1, spinTime.current / 1.35)
      lift = Math.sin(Math.PI * p) * 0.75
      spin = Math.PI * 2 * (p * p * (3 - 2 * p))
      if (p === 1) spinTime.current = -1
    }
    if (npcRef.current && holderPose.current) {
      holderPose.current.position.y = baseY + lift
      holderPose.current.rotation.y = yaw.current + spin
    }
    const camPoint = gazeRef.current?.point
    const active = camPoint ? true : follow && (Math.abs(state.pointer.x) > 0.02 || Math.abs(state.pointer.y) > 0.02)
    if (camPoint) pointer.current.set(camPoint.x, camPoint.y)
    else pointer.current.set(state.pointer.x, state.pointer.y)
    const poseState = speaking ? 'speaking' : chatOpen ? 'attentive' : 'idle'
    npc.update(dt, pointer.current, active, 'idle', poseState, blink, follow || Boolean(camPoint), motion)
    npc.setMouth(speaking ? viseme : 'AA')
    npc.setAccessories(false, false)
    npc.orientAccessories(camera.position)
  })

  const holderPose = useRef()

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
    <group ref={holderPose} position={[0, baseY, 0]} scale={scale}>
      <primitive object={npcRef.current.model} />
      <mesh position={[0, 0, 0.55]} onPointerDown={onPointerDown}>
        <circleGeometry args={[1.35, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
