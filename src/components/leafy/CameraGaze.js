export class CameraGaze {
  point = null
  worker = null
  stream = null
  video = null
  timer = null
  timeout = null
  generation = 0
  busy = false
  lastSeen = 0
  status = 'off'
  constructor(onStatus) {
    this.onStatus = onStatus
  }
  set(s, message) {
    if (s !== this.status || message) {
      this.status = s
      this.onStatus?.(s, message)
    }
  }
  async start() {
    this.stop()
    const generation = this.generation
    this.set('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Kamera kræver en understøttet browser.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      this.video = video
      await video.play()
      const worker = new Worker('/camera/face-worker.js')
      this.worker = worker
      const fail = () => {
        if (generation !== this.generation) return
        this.stop()
        this.set('error', 'Ansigtsfølgning kunne ikke startes. Leafy ser lige frem.')
      }
      this.timeout = setTimeout(fail, 25000)
      worker.onerror = fail
      worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return
        if (data.type === 'error') return fail()
        if (data.type === 'ready') {
          if (this.timeout) clearTimeout(this.timeout)
          this.set('searching')
          this.timer = setInterval(() => void this.frame(generation), 150)
        }
        if (data.type === 'face') {
          this.busy = false
          if (data.point) {
            this.point = data.point
            this.lastSeen = performance.now()
            this.set('tracking')
          } else if (performance.now() - this.lastSeen > 650) {
            this.point = null
            this.set('searching')
          }
        }
      }
      worker.postMessage({ type: 'init' })
    } catch (e) {
      this.stop()
      this.set('error', e.name === 'NotAllowedError' ? 'Kameraadgang blev ikke givet.' : 'Kameraet kunne ikke åbnes.')
    }
  }
  async frame(generation) {
    if (this.busy || generation !== this.generation || !this.video || !this.worker) return
    if (this.video.readyState < 2) return
    this.busy = true
    const bitmap = await createImageBitmap(this.video)
    if (generation !== this.generation) {
      bitmap.close()
      return
    }
    this.worker.postMessage({ type: 'frame', bitmap }, [bitmap])
  }
  stop() {
    this.generation += 1
    if (this.timer) clearInterval(this.timer)
    if (this.timeout) clearTimeout(this.timeout)
    this.timer = this.timeout = null
    this.worker?.terminate()
    this.worker = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video = null
    this.point = null
    this.busy = false
    this.set('off')
  }
}
