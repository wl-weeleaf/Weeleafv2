import * as THREE from 'three'
import outline from './outline.json'

const N = outline.length
const RINGS = 48
const SCALE = 3.4 / 486

export function createLeafyGeometry(front = true) {
  const positions = []
  const uvs = []
  const indices = []
  const vertex = (px, py, r) => {
    const base = Math.sqrt(Math.max(0, 1 - r * r))
    const eyes =
      Math.exp(-((px - 175) ** 2 / 800 + (py - 277) ** 2 / 1250)) +
      Math.exp(-((px - 307) ** 2 / 800 + (py - 277) ** 2 / 1250))
    const z = front ? 0.47 * base + 0.07 * eyes * base : -0.34 * base
    positions.push((px - 256) * SCALE, (254 - py) * SCALE, z)
    uvs.push(px / 512, 1 - py / 512)
  }
  vertex(256, 290, 0)
  for (let ring = 1; ring <= RINGS; ring++) {
    const r = Math.sin((ring / RINGS) * Math.PI / 2)
    for (const [x, y] of outline) vertex(256 + (x - 256) * r, 290 + (y - 290) * r, r)
  }
  const tri = (a, b, c) => indices.push(...(front ? [a, b, c] : [a, c, b]))
  for (let i = 0; i < N; i++) tri(0, 1 + i, 1 + ((i + 1) % N))
  for (let ring = 1; ring < RINGS; ring++) {
    for (let i = 0; i < N; i++) {
      const a = 1 + (ring - 1) * N + i
      const b = 1 + (ring - 1) * N + ((i + 1) % N)
      const c = a + N
      const d = b + N
      tri(a, c, d)
      tri(a, d, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  const normals = g.getAttribute('normal')
  for (let i = 0; i < N; i++) {
    const p = outline[(i + N - 1) % N]
    const q = outline[(i + 1) % N]
    const n = new THREE.Vector3(p[1] - q[1], p[0] - q[0], 0).normalize()
    normals.setXYZ(1 + (RINGS - 1) * N + i, n.x, n.y, 0)
  }
  return g
}

export async function createLeafy(textureUrl = '/leafy/npc-base.png', backUrl = '/leafy/back.png') {
  const loader = new THREE.TextureLoader()
  const loaded = await Promise.allSettled([loader.loadAsync(textureUrl), loader.loadAsync(backUrl)])
  if (loaded.some((r) => r.status === 'rejected')) {
    loaded.forEach((r) => {
      if (r.status === 'fulfilled') r.value.dispose()
    })
    throw new Error('Leafy textures could not load')
  }
  const [texture, backTexture] = loaded.map((r) => r.value)
  for (const t of [texture, backTexture]) {
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
  }
  const root = new THREE.Group()
  root.name = 'Leafy'
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.18,
  })
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.85,
    emissiveMap: backTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.18,
  })
  const front = new THREE.Mesh(createLeafyGeometry(true), frontMaterial)
  front.name = 'Leafy_front'
  const backGeometry = createLeafyGeometry(false)
  const backUV = backGeometry.getAttribute('uv')
  for (let i = 0; i < backUV.count; i++) backUV.setX(i, 1 - backUV.getX(i))
  const back = new THREE.Mesh(backGeometry, backMaterial)
  back.name = 'Leafy_back'
  root.add(front, back)
  return root
}

export function disposeLeafy(root) {
  const mats = new Set()
  const tex = new Set()
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m)
    }
  })
  for (const m of mats) {
    for (const v of Object.values(m)) if (v instanceof THREE.Texture) tex.add(v)
    m.dispose()
  }
  tex.forEach((t) => t.dispose())
}
