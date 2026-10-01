import * as THREE from 'three'

function canvas(w = 512, h = 512) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
function texture(c, name) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.name = name
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}
function cutout(image, x, y, w, h) {
  const c = canvas(w, h)
  const g = c.getContext('2d')
  g.drawImage(image, x, y, w, h, 0, 0, w, h)
  return c
}
function sample(image) {
  const c = canvas(40, 40)
  const g = c.getContext('2d')
  g.drawImage(image, 210, 380, 70, 70, 0, 0, 40, 40)
  const d = g.getImageData(0, 0, 40, 40).data
  let r = 0, gr = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 30) continue
    r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++
  }
  return n ? [r / n, gr / n, b / n] : [120, 190, 70]
}
function harmonize(source, target, strength) {
  const c = canvas(source.width, source.height)
  const g = c.getContext('2d')
  g.drawImage(source, 0, 0)
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 12) continue
    d[i] = d[i] * (1 - strength) + target[0] * strength
    d[i + 1] = d[i + 1] * (1 - strength) + target[1] * strength
    d[i + 2] = d[i + 2] * (1 - strength) + target[2] * strength
  }
  g.putImageData(img, 0, 0)
  return c
}

export class FaceSpriteLayers {
  constructor(original, clean) {
    this.eyeCanvas = canvas()
    this.browCanvas = canvas()
    this.mouthCanvas = canvas()
    this.baseCanvas = canvas()
    this.scratch = canvas(90, 100)
    this.eyeKey = ''
    this.browKey = ''
    this.mouthKey = ''
    this.roll = 0
    const leaf = sample(clean)
    const b = this.baseCanvas.getContext('2d')
    b.drawImage(original, 0, 0)
    for (const [x, y, w, h] of [[113, 219, 106, 114], [261, 221, 106, 114], [129, 167, 75, 57], [275, 165, 86, 62], [174, 315, 127, 77]]) {
      b.drawImage(cutout(clean, x, y, w, h), x, y)
    }
    this.eyeParts = [cutout(original, 120, 226, 92, 100), cutout(original, 268, 228, 92, 100)]
    this.pupils = [cutout(original, 149, 247, 54, 67), cutout(original, 277, 249, 58, 65)]
    this.browParts = [harmonize(cutout(original, 136, 174, 61, 43), leaf, 0.45), harmonize(cutout(original, 282, 172, 72, 48), leaf, 0.45)]
    this.smile = harmonize(cutout(original, 184, 325, 107, 57), leaf, 0.55)
    this.base = texture(this.baseCanvas, 'Original_torso_skin')
    this.eyes = texture(this.eyeCanvas, 'Original_eyes')
    this.brows = texture(this.browCanvas, 'Original_brows')
    this.mouth = texture(this.mouthCanvas, 'Original_mouth')
    this.setEyes(0, 0, 1)
    this.setBrows('idle', false)
    this.setMouth('AA')
  }
  setEyeRoll(roll) { this.roll = roll; this.eyeKey = '' }
  setEyes(x, y, open) {
    x = Math.round(x * 20) / 20
    y = Math.round(y * 20) / 20
    open = Math.max(0.035, Math.round(open * 20) / 20)
    const key = [x, y, open, Math.round(this.roll * 12)].join(',')
    if (key === this.eyeKey) return
    this.eyeKey = key
    const ctx = this.eyeCanvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 512)
    this.eyeParts.forEach((part, i) => {
      const g = this.scratch.getContext('2d')
      this.scratch.width = 92
      this.scratch.height = 100
      g.clearRect(0, 0, 92, 100)
      g.drawImage(part, 0, 0)
      if (x !== 0 || y !== 0) {
        g.save()
        g.beginPath()
        g.ellipse(46, 51, 35, 40, 0, 0, Math.PI * 2)
        g.clip()
        g.fillStyle = '#e7f6c8'
        g.fillRect(5, 8, 82, 87)
        g.drawImage(this.pupils[i], i === 0 ? 29 + x * 9 : 9 + x * 9, 21 - y * 8)
        g.restore()
      }
      const h = 100 * open
      ctx.save()
      ctx.translate(166 + i * 148, 277)
      ctx.rotate(this.roll)
      ctx.drawImage(this.scratch, -46, -h / 2, 92, h)
      ctx.restore()
    })
    this.eyes.needsUpdate = true
  }
  setBrows(expression, thinking) {
    const raise = thinking ? 18 : { idle: 0, happy: 6, curious: 14, sleepy: -10 }[expression] ?? 0
    const key = expression + raise
    if (key === this.browKey) return
    this.browKey = key
    const ctx = this.browCanvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 512)
    ctx.drawImage(this.browParts[0], 136, 174 - raise)
    ctx.drawImage(this.browParts[1], 282, 172 - raise * 0.6)
    this.brows.needsUpdate = true
  }
  setMouth(id) {
    const level = { rest: 0, MBP: 0, FV: 1, L: 2, EE: 2, OO: 3, OH: 3, AA: 4 }
    const key = id === 'none' ? 'none' : String(level[id] ?? 4)
    if (key === this.mouthKey) return
    this.mouthKey = key
    const c = this.mouthCanvas.getContext('2d')
    c.clearRect(0, 0, 512, 512)
    if (id !== 'none') {
      const h = [18, 24, 34, 46, 57][level[id] ?? 4]
      c.drawImage(this.smile, 184, 352 - h / 2, 107, h)
    }
    this.mouth.needsUpdate = true
  }
}
