const clamp = (v) => Math.max(-1, Math.min(1, v));

/**
 * Độ nghiêng điện thoại chuẩn hoá về [-1, 1] (x: trái/phải, y: trước/sau), đã làm mượt.
 * - Điện thoại: DeviceOrientationEvent (iOS cần xin quyền trong một thao tác chạm).
 * - Máy tính: dùng vị trí chuột để mô phỏng.
 * x < 0 nghĩa là nghiêng sang trái.
 */
class TiltInput {
  constructor() {
    this.x = 0;
    this.y = 0;
    this._tx = 0;
    this._ty = 0;
    this._betaBase = null;
    this._hasSensor = false;
    this._started = false;
    this.rangeDeg = 25; // nghiêng chừng này độ thì đạt mức tối đa
  }

  /** Gọi trong sự kiện click/touchend để iOS hiện hộp xin quyền. */
  async requestPermission() {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        await DOE.requestPermission();
      } catch {
        /* người dùng từ chối hoặc không có cử chỉ hợp lệ */
      }
    }
    this.start();
  }

  start() {
    if (this._started) return;
    this._started = true;
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      this._hasSensor = true;
      if (this._betaBase === null) this._betaBase = e.beta;
      // Từ từ dời mốc "cầm thẳng" theo tư thế người dùng
      this._betaBase += (e.beta - this._betaBase) * 0.01;
      this._tx = clamp(e.gamma / this.rangeDeg);
      this._ty = clamp((e.beta - this._betaBase) / this.rangeDeg);
    });
    window.addEventListener('pointermove', (e) => {
      if (this._hasSensor || e.pointerType !== 'mouse') return;
      this._tx = clamp((e.clientX / window.innerWidth) * 2 - 1);
      this._ty = clamp((e.clientY / window.innerHeight) * 2 - 1);
    });
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 6);
    this.x += (this._tx - this.x) * k;
    this.y += (this._ty - this.y) * k;
  }
}

export const tilt = new TiltInput();
