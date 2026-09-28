import * as THREE from 'three'

const poses = ['rest', 'open', 'point']

export class HandSprites {
  group = new THREE.Group()
  layers = []
  constructor(atlas, mirror) {
    this.group.name = 'Image_hand'
    this.group.scale.x = mirror ? -1 : 1
    const size = atlas.width / 3
    const height = atlas.height / 2
    for (let row = 0; row < 2; row++) {
      poses.forEach((pose, col) => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = height
        canvas.getContext('2d').drawImage(atlas, col * size, row * height, size, height, 0, 0, size, height)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.02,
          toneMapped: false,
          opacity: pose === 'rest' ? 1 : 0,
          side: row ? THREE.BackSide : THREE.FrontSide,
        })
        const geo = new THREE.PlaneGeometry(0.82, 0.82, 8, 8)
        const p = geo.getAttribute('position')
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i)
          p.setZ(i, (row ? -1 : 1) * (0.015 + 0.055 * Math.max(0, 1 - (x / 0.41) ** 2)))
        }
        geo.computeVertexNormals()
        const mesh = new THREE.Mesh(geo, material)
        mesh.visible = pose === 'rest'
        this.group.add(mesh)
        this.layers.push({ pose, mesh })
      })
    }
  }
  update(pose, dt) {
    for (const layer of this.layers) {
      const goal = layer.pose === pose ? 1 : 0
      layer.mesh.material.opacity = THREE.MathUtils.damp(layer.mesh.material.opacity, goal, 14, dt)
      layer.mesh.visible = layer.mesh.material.opacity > 0.005
    }
  }
  orient(yaw) {
    const back = Math.abs(yaw) > Math.PI / 2
    let delta = yaw - (back ? Math.sign(yaw) * Math.PI : 0)
    this.group.rotation.y = THREE.MathUtils.clamp(delta, -0.68, 0.68)
  }
}
