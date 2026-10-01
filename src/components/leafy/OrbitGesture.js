export class OrbitGesture {
  last = null
  travel = 0
  direction = 0
  idle = 0
  constructor(turns = 2) {
    this.turns = turns
  }
  get progress() {
    return Math.min(1, this.travel / (Math.PI * 2 * this.turns))
  }
  update(angle, dragging, dt) {
    if (!Number.isFinite(angle)) return false
    const old = this.last
    this.last = angle
    if (!dragging) {
      this.idle += dt
      if (this.idle > 3) {
        this.travel = 0
        this.direction = 0
      }
      return false
    }
    this.idle = 0
    if (old === null) return false
    const delta = Math.atan2(Math.sin(angle - old), Math.cos(angle - old))
    if (Math.abs(delta) < 0.0001) return false
    const sign = Math.sign(delta)
    if (this.direction && sign !== this.direction) this.travel = 0
    this.direction = sign
    this.travel += Math.abs(delta)
    if (this.progress >= 1) {
      this.travel = 0
      return true
    }
    return false
  }
}
