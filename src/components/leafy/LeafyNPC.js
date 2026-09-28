import * as THREE from 'three'
import { createLeafy, disposeLeafy } from './createLeafy'
import outline from './outline.json'

function surface(x, y) {
  const px = x / (3.4 / 486) + 256
  const py = 254 - y / (3.4 / 486)
  const angle = (Math.atan2(290 - py, px - 256) + Math.PI * 2) % (Math.PI * 2)
  const i = Math.round((angle / (2 * Math.PI)) * outline.length) % outline.length
  const r = Math.min(
    0.99,
    Math.hypot(px - 256, py - 290) / Math.hypot(outline[i][0] - 256, outline[i][1] - 290)
  )
  const base = Math.sqrt(Math.max(0, 1 - r * r))
  const eye =
    Math.exp(-((px - 175) ** 2 / 800 + (py - 277) ** 2 / 1250)) +
    Math.exp(-((px - 307) ** 2 / 800 + (py - 277) ** 2 / 1250))
  return 0.47 * base + 0.07 * eye * base
}

export class LeafyNPC {
  static create() {
    return new LeafyNPC(createLeafy())
  }

  constructor(model) {
    this.model = model
    this.eyes = []
    this.pupils = []
    this.closed = []
    this.elapsed = 0
    this.blinkAt = 2.2
    this.blinkTime = -1
    this.gaze = new THREE.Vector2()
    this.head = new THREE.Vector2()
    model.name = 'Leafy'

    const white = new THREE.MeshStandardMaterial({ color: '#f3ffe0', roughness: 0.28 })
    const iris = new THREE.MeshStandardMaterial({ color: '#145719', roughness: 0.3 })
    const pupil = new THREE.MeshStandardMaterial({ color: '#020e03', roughness: 0.12 })
    const shine = new THREE.MeshBasicMaterial({ color: 'white' })
    const green = new THREE.MeshStandardMaterial({ color: '#248012', roughness: 0.8 })
    const sphere = new THREE.SphereGeometry(1, 32, 24)
    const ball = (mat, x, y, z) => {
      const m = new THREE.Mesh(sphere.clone(), mat)
      m.scale.set(x, y, z)
      return m
    }

    ;[-1, 1].forEach((side, i) => {
      const eye = new THREE.Group()
      eye.name = i ? 'Eye_R' : 'Eye_L'
      eye.position.set(side * 0.48, -0.16, surface(side * 0.48, -0.16) + 0.012)
      eye.add(ball(white, 0.245, 0.3, 0.105))
      const look = new THREE.Group()
      const ir = ball(iris, 0.178, 0.229, 0.064)
      ir.position.z = 0.092
      look.add(ir)
      const p = ball(pupil, 0.137, 0.181, 0.035)
      p.position.z = 0.144
      look.add(p)
      const h = ball(shine, 0.042, 0.042, 0.019)
      h.position.set(-0.054, 0.098, 0.176)
      look.add(h)
      const h2 = ball(shine, 0.017, 0.017, 0.012)
      h2.position.set(0.055, -0.083, 0.173)
      look.add(h2)
      eye.add(look)
      model.add(eye)
      this.eyes.push(eye)
      this.pupils.push(look)

      const brow = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.155, 0, 0),
            new THREE.Vector3(0, 0.058, 0),
            new THREE.Vector3(0.155, 0, 0),
          ]),
          18,
          0.034,
          8,
          false
        ),
        green
      )
      brow.position.set(side * 0.48, 0.4, surface(side * 0.48, 0.4) + 0.035)
      model.add(brow)

      const lid = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.18, 0.025, 0),
            new THREE.Vector3(0, -0.015, 0),
            new THREE.Vector3(0.18, 0.025, 0),
          ]),
          18,
          0.017,
          8,
          false
        ),
        green
      )
      lid.position.copy(eye.position)
      lid.position.z += 0.025
      lid.visible = false
      model.add(lid)
      this.closed.push(lid)
    })
    sphere.dispose()

    const mouthMat = new THREE.MeshStandardMaterial({
      color: '#1a0c08',
      roughness: 0.45,
      metalness: 0.05,
    })
    const mouthInner = new THREE.MeshStandardMaterial({
      color: '#5a1d28',
      roughness: 0.55,
    })
    this.mouth = new THREE.Group()
    this.mouth.position.set(-0.02, -0.66, surface(-0.02, -0.66) + 0.02)
    const lips = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mouthMat)
    lips.scale.set(0.28, 0.16, 0.1)
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mouthInner)
    cavity.scale.set(0.18, 0.11, 0.08)
    cavity.position.z = 0.02
    this.mouth.add(lips, cavity)
    model.add(this.mouth)

    model.traverse((o) => {
      o.raycast = () => {}
    })
  }

  update(dt, target, active) {
    this.elapsed += dt
    const t = this.elapsed
    const desired = active
      ? target
      : new THREE.Vector2(Math.sin(t * 0.47) * 0.17, Math.sin(t * 0.31) * 0.09)
    this.gaze.lerp(desired, 1 - Math.exp(-dt * 12))
    this.head.lerp(desired, 1 - Math.exp(-dt * 3))
    this.model.rotation.y = this.head.x * 0.22
    this.model.rotation.x = -this.head.y * 0.1
    this.model.rotation.z = Math.sin(t * 0.8) * 0.015
    this.model.position.y = Math.sin(t * 1.35) * 0.035
    const breath = Math.sin(t * 1.3) * 0.006
    this.model.scale.set(1 - breath * 0.4, 1 + breath, 1)

    if (t > this.blinkAt && this.blinkTime < 0) {
      this.blinkTime = 0
      this.blinkAt = t + 2.7 + Math.random() * 3
    }
    let openness = 1
    if (this.blinkTime >= 0) {
      this.blinkTime += dt
      openness = 1 - Math.sin(Math.min(1, this.blinkTime / 0.19) * Math.PI)
      if (this.blinkTime > 0.19) this.blinkTime = -1
    }
    for (let i = 0; i < 2; i++) {
      this.eyes[i].scale.y = Math.max(0.035, openness)
      this.closed[i].visible = openness < 0.16
      this.eyes[i].visible = openness >= 0.16
      this.pupils[i].position.x = this.gaze.x * 0.072
      this.pupils[i].position.y = this.gaze.y * 0.077
    }
    this.mouth.scale.set(1, 1.15 + Math.sin(t * 2.1) * 0.08, 1)
  }

  dispose() {
    disposeLeafy(this.model)
  }
}
