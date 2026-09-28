import * as THREE from 'three'
import { HandSprites } from './HandSprites'

export class FloatingAccessories {
  hands = new THREE.Group()
  shoes = new THREE.Group()
  sprites = []
  palms = []
  feet = []
  constructor(handAtlas) {
    this.hands.name = 'Leafy_floating_hands'
    this.shoes.name = 'Leafy_hemp_shoes'
    const green = new THREE.MeshStandardMaterial({ color: '#79c829', roughness: 0.82 })
    const trim = new THREE.MeshStandardMaterial({ color: '#315f19', roughness: 0.9 })
    const sole = new THREE.MeshStandardMaterial({ color: '#eee5c8', roughness: 0.96 })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const c = canvas.getContext('2d')
    c.fillStyle = '#c1aa7d'
    c.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 8) {
      for (let x = 0; x < 128; x += 8) {
        const vertical = ((x + y) / 8) % 2 === 0
        c.fillStyle = vertical ? '#ddc99d' : '#a18b63'
        c.fillRect(x + 1, y + 1, 6, 6)
      }
    }
    const weave = new THREE.CanvasTexture(canvas)
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping
    weave.repeat.set(3, 2)
    const hemp = new THREE.MeshStandardMaterial({ color: '#eee2c6', map: weave, roughness: 1 })
    const ellipsoid = (parent, name, material, x, y, z, sx, sy, sz) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material)
      m.name = name
      m.position.set(x, y, z)
      m.scale.set(sx, sy, sz)
      parent.add(m)
      return m
    }
    for (const side of [-1, 1]) {
      const hand = new THREE.Group()
      hand.name = side < 0 ? 'Left_hand' : 'Right_hand'
      this.hands.add(hand)
      this.palms.push(hand)
      const sprites = new HandSprites(handAtlas, side > 0)
      hand.add(sprites.group)
      this.sprites.push(sprites)
      const shoe = new THREE.Group()
      shoe.name = side < 0 ? 'Left_hemp_shoe' : 'Right_hemp_shoe'
      this.shoes.add(shoe)
      this.feet.push(shoe)
      ellipsoid(shoe, 'Ivory_sole', sole, 0, -0.12, 0.06, 0.4, 0.13, 0.54)
      ellipsoid(shoe, 'Hemp_upper', hemp, 0, 0.025, 0.06, 0.365, 0.26, 0.49)
      ellipsoid(shoe, 'Green_collar', trim, 0, 0.24, -0.17, 0.225, 0.045, 0.235)
    }
    this.update(0, 'idle', false, 0)
  }
  setVisible(hands, shoes) {
    this.hands.visible = hands
    this.shoes.visible = shoes
  }
  orient(camera) {
    this.hands.updateWorldMatrix(true, false)
    const local = this.hands.worldToLocal(camera.clone())
    const yaw = Math.atan2(local.x, local.z)
    this.sprites.forEach((s) => s.orient(yaw))
  }
  update(t, state, moving, dt) {
    const a = moving ? 1 : 0
    this.palms.forEach((hand, i) => {
      const side = i === 0 ? -1 : 1
      const phase = t * 1.3 + i * 1.7
      hand.position.set(side * (1.8 + Math.sin(t * 0.65 + i) * 0.035 * a), -0.72 + Math.sin(phase) * 0.06 * a, 0.12)
      hand.rotation.set(Math.sin(phase) * 0.08 * a, side * 0.1, side * 0.12 + Math.sin(phase) * 0.07 * a)
      let pose = 'rest'
      if (moving && state === 'speaking') {
        pose = 'open'
        hand.position.y += 0.15 + Math.sin(t * 2 + i) * 0.06
      }
      this.sprites[i].update(pose, dt)
    })
    this.feet.forEach((shoe, i) => {
      const side = i === 0 ? -1 : 1
      shoe.position.set(side * 0.53, -2.23 + Math.sin(t * 1.2 + i * 1.8) * 0.045 * a, 0.08)
    })
  }
}
