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
  g.globalCompositeOperation = 'destination-in'
  g.scale(w / 2, h / 2)
  const mask = g.createRadialGradient(1, 1, 0.9, 1, 1, 1)
  mask.addColorStop(0, 'white')
  mask.addColorStop(1, 'transparent')
  g.fillStyle = mask
  g.fillRect(0, 0, 2, 2)
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

    const b = this.baseCanvas.getContext('2d')
    b.drawImage(original, 0, 0)
    for (const [x, y, w, h] of [
      [113, 219, 106, 114],
      [261, 221, 106, 114],
      [129, 167, 75, 57],
      [275, 165, 86, 62],
      [174, 315, 127, 77],
    ]) {
      const patch = cutout(clean, x, y, w, h)
      const ctx = patch.getContext('2d')
      const image = ctx.getImageData(0, 0, w, h)
      const old = b.getImageData(x, y, w, h)
      const sums = [0, 0, 0]
      const counts = [0, 0, 0]
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const r = Math.hypot((px - w / 2) / (w / 2), (py - h / 2) / (h / 2))
          if (r > 0.72 && r < 0.88) {
            const i = (py * w + px) * 4
            for (let k = 0; k < 3; k++) {
              sums[k] += old.data[i + k]
              counts[k] += image.data[i + k]
            }
          }
        }
      }
      for (let i = 0; i < image.data.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          image.data[i + k] *= Math.max(0.8, Math.min(1.2, sums[k] / (counts[k] || 1)))
        }
      }
      ctx.resetTransform()
      ctx.globalCompositeOperation = 'source-over'
      ctx.putImageData(image, 0, 0)
      b.drawImage(patch, x, y)
    }

    this.eyeParts = [cutout(original, 120, 226, 92, 100), cutout(original, 268, 228, 92, 100)]
    this.pupils = [cutout(original, 149, 247, 54, 67), cutout(original, 277, 249, 58, 65)]
    this.browParts = [cutout(original, 136, 174, 61, 43), cutout(original, 282, 172, 72, 48)]
    this.smile = cutout(original, 184, 325, 107, 57)
    const mouthCtx = this.smile.getContext('2d')
    const pixels = mouthCtx.getImageData(0, 0, 107, 57)
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i]
      const g = pixels.data[i + 1]
      const bl = pixels.data[i + 2]
      if (g > r * 1.4 && g > bl * 1.3 && g > 55) pixels.data[i + 3] = 0
    }
    mouthCtx.resetTransform()
    mouthCtx.globalCompositeOperation = 'source-over'
    mouthCtx.putImageData(pixels, 0, 0)

    this.base = texture(this.baseCanvas, 'Original_torso_skin')
    this.eyes = texture(this.eyeCanvas, 'Original_eyes')
    this.brows = texture(this.browCanvas, 'Original_brows')
    this.mouth = texture(this.mouthCanvas, 'Original_mouth')
    this.setEyes(0, 0, 1)
    this.setMouth('AA')
  }

  setEyes(x, y, open) {
    x = Math.round(x * 20) / 20
    y = Math.round(y * 20) / 20
    open = Math.max(0.035, Math.round(open * 20) / 20)
    const key = [x, y, open].join(',')
    if (key === this.eyeKey) return
    this.eyeKey = key
    const ctx = this.eyeCanvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 512)
    this.eyeParts.forEach((part, i) => {
      const g = this.scratch.getContext('2d')
      this.scratch.width = 92
      this.scratch.height = 100
      g.drawImage(part, 0, 0)
      if (x !== 0 || y !== 0) {
        g.save()
        g.beginPath()
        g.ellipse(46, 51, 35, 40, 0, 0, Math.PI * 2)
        g.clip()
        const white = g.createRadialGradient(43, 44, 7, 46, 51, 44)
        white.addColorStop(0, '#f9ffe9')
        white.addColorStop(1, '#c5e1ad')
        g.fillStyle = white
        g.fillRect(5, 8, 82, 87)
        g.drawImage(this.pupils[i], i === 0 ? 29 + x * 9 : 9 + x * 9, 21 - y * 8)
        g.restore()
      }
      if (open < 0.14) {
        ctx.strokeStyle = '#123607'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(141 + i * 148, 277)
        ctx.quadraticCurveTo(167 + i * 148, 289, 191 + i * 148, 277)
        ctx.stroke()
        return
      }
      const h = 100 * open
      ctx.drawImage(this.scratch, 120 + i * 148, 277 - h / 2, 92, h)
    })
    this.eyes.needsUpdate = true
  }

  setMouth(id) {
    const level = { rest: 0, MBP: 0, FV: 1, L: 2, EE: 2, OO: 3, OH: 3, AA: 4 }
    const key = id === 'none' ? 'none' : String(level[id] ?? 4)
    if (key === this.mouthKey) return
    this.mouthKey = key
    const c = this.mouthCanvas.getContext('2d')
    c.clearRect(0, 0, 512, 512)
    if (id !== 'none') {
      const h = [8, 20, 33, 45, 57][level[id] ?? 4]
      c.drawImage(this.smile, 184, 352 - h / 2, 107, h)
    }
    this.mouth.needsUpdate = true
  }
}
