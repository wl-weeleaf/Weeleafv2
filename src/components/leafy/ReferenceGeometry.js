import * as THREE from 'three'

let reference = null

export async function loadReferenceGeometry() {
  if (reference) return reference
  const res = await fetch('/leafy/reference-geometry.json')
  if (!res.ok) throw new Error('reference-geometry.json mangler')
  reference = await res.json()
  return reference
}

export function referenceGeometry(front) {
  if (!reference) throw new Error('Reference geometry er ikke loadet')
  const d = front ? reference.front : reference.back
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.POSITION, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(d.NORMAL, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.TEXCOORD_0, 2))
  g.setIndex(d.indices)
  return g
}
