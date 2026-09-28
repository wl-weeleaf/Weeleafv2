import * as THREE from 'three'
import { loadReferenceGeometry, referenceGeometry } from './ReferenceGeometry'
import { deformPoint } from './LeafDeformation'
import { FloatingAccessories } from './FloatingAccessories'
import { FaceSpriteLayers } from './FaceSpriteLayers'

export class LayeredLeafyNPC {
  gaze = new THREE.Vector2()
  head = new THREE.Vector2()
  elapsed = 0
  blinkAt = 2.2
  blinkTime = -1
  surfaces = []
  tipTurn = 0
  movement = 0

  constructor(face, back, handAtlas) {
    this.face = face
    this.model = new THREE.Group()
    this.model.name = 'Leafy_torso'
    for (const isFront of [true, false]) {
      const geo = referenceGeometry(isFront)
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: isFront ? face.base : back }))
      mesh.name = isFront ? 'Leafy_torso_front' : 'Leafy_torso_back'
      this.model.add(mesh)
      if (isFront) {
        for (const [name, map, offset] of [
          ['Eyes_sprite', face.eyes, 0.003],
          ['Brows_sprite', face.brows, 0.004],
          ['Mouth_sprite', face.mouth, 0.005],
        ]) {
          const layerGeometry = geo.clone()
          const p = layerGeometry.getAttribute('position')
          for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + offset)
          const layer = new THREE.Mesh(
            layerGeometry,
            new THREE.MeshBasicMaterial({
              map,
              transparent: true,
              depthWrite: false,
              alphaTest: 0.015,
              toneMapped: false,
            })
          )
          layer.name = name
          layer.renderOrder = 1
          this.model.add(layer)
          if (name === 'Eyes_sprite') this.eyes = layer
          else if (name === 'Brows_sprite') this.brows = layer
          else this.mouth = layer
        }
      }
    }
    this.model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.frustumCulled = false
        o.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage)
        this.surfaces.push({ mesh: o, base: new Float32Array(o.geometry.getAttribute('position').array) })
      }
    })
    this.accessories = new FloatingAccessories(handAtlas)
    this.model.add(this.accessories.hands, this.accessories.shoes)
  }

  static async load(assetBase = '/leafy') {
    await loadReferenceGeometry()
    const base = assetBase.replace(/\/$/, '')
    const loader = new THREE.ImageLoader()
    const [original, clean, backImage, handAtlas] = await Promise.all(
      ['original-torso.png', 'npc-base.png', 'back.png', 'hands-atlas.png'].map((p) => loader.loadAsync(`${base}/${p}`))
    )
    const back = new THREE.Texture(backImage)
    back.colorSpace = THREE.SRGBColorSpace
    back.needsUpdate = true
    return new LayeredLeafyNPC(new FaceSpriteLayers(original, clean), back, handAtlas)
  }

  setLayers(eyes, mouth) {
    this.eyes.visible = eyes
    this.brows.visible = eyes
    this.mouth.visible = mouth
  }

  orientAccessories(camera) {
    this.accessories.orient(camera)
  }

  setAccessories(hands, shoes) {
    this.accessories.setVisible(hands, shoes)
  }

  setMouth(id) {
    this.face.setMouth(id)
  }

  update(dt, target, active, expression, state, animate = true, track = true, motion = 'idle') {
    this.elapsed += dt
    const t = this.elapsed
    this.accessories.update(t, state, animate && motion !== 'still', dt)
    const desired =
      active && track
        ? target
        : new THREE.Vector2(animate && state === 'idle' ? Math.sin(t * 0.47) * 0.17 : 0, animate && state === 'idle' ? Math.sin(t * 0.31) * 0.09 : 0)
    this.gaze.lerp(desired, 1 - Math.exp(-dt * 12))
    this.head.lerp(desired, 1 - Math.exp(-dt * 3))
    this.model.rotation.set(
      -this.head.y * 0.1,
      this.head.x * 0.22,
      animate ? (state === 'thinking' ? Math.sin(t * 0.5) * 0.045 : Math.sin(t * 0.8) * 0.015) : 0
    )
    this.model.position.y = animate && motion !== 'still' ? (motion === 'hop' ? Math.max(0, Math.sin(t * 3)) * 0.17 : Math.sin(t * 1.35) * 0.035) : 0
    this.model.scale.setScalar(1)
    this.tipTurn = THREE.MathUtils.damp(this.tipTurn, this.head.x, 1.8, dt)
    this.movement = THREE.MathUtils.damp(this.movement, animate && motion !== 'still' ? (state === 'idle' ? 1 : 0.7) : 0, 5, dt)
    for (const { mesh, base } of this.surfaces) {
      const p = mesh.geometry.getAttribute('position')
      for (let i = 0; i < p.count; i++) {
        const v = deformPoint(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], t, this.tipTurn, this.movement)
        p.setXYZ(i, v[0], v[1], v[2])
      }
      p.needsUpdate = true
    }
    if (animate && motion === 'idle' && state === 'idle') {
      const phase = t % 19
      this.model.position.y += phase < 1.3 ? Math.sin((phase / 1.3) * Math.PI) * 0.075 : 0
    }
    if (animate && state === 'idle' && motion !== 'still') {
      const stretch = t % 47
      if (stretch > 36 && stretch < 39) {
        const a = Math.sin(((stretch - 36) / 3) * Math.PI) * 0.018
        this.model.scale.set(1 - a * 0.35, 1 + a, 1)
      }
    }
    if (animate && state === 'attentive') this.model.rotation.x += Math.sin(t * 1.5) * 0.012
    if (animate && t > this.blinkAt && this.blinkTime < 0) {
      this.blinkTime = 0
      this.blinkAt = t + (Math.random() < 0.16 ? 0.34 : 2.7 + Math.random() * 3)
    }
    let openness = 1
    if (this.blinkTime >= 0) {
      this.blinkTime += dt
      openness = 1 - Math.sin(Math.min(1, this.blinkTime / 0.19) * Math.PI)
      if (this.blinkTime > 0.19) this.blinkTime = -1
    }
    if (!animate) {
      openness = 1
      this.blinkTime = -1
    }
    this.face.setEyes(this.gaze.x, this.gaze.y, openness * (expression === 'sleepy' ? 0.55 : 1))
    this.face.setBrows(expression, state === 'thinking')
  }

  dispose() {}
}
