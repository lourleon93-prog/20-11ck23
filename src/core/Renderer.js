import * as THREE from 'three';

/**
 * Bọc WebGLRenderer: cấu hình chuẩn cho mobile, tự resize theo kích thước canvas
 * và chỉ chạy vòng lặp render khi được bật (tiết kiệm pin/GPU khi cảnh bị ẩn).
 */
export class Renderer {
  /**
   * motionPixelRatio: độ phân giải khi đang chuyển động (vd. điện thoại vẽ thô hơn lúc camera di chuyển,
   * mắt không nhận ra; đứng yên 0.25 s thì trở lại độ nét đầy đủ). Mặc định = maxPixelRatio (tắt).
   */
  constructor(canvas, { maxPixelRatio = 2, antialias = true, motionPixelRatio = null } = {}) {
    this.canvas = canvas;
    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.fullPixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    this.motionPixelRatio = Math.min(this.fullPixelRatio, motionPixelRatio ?? this.fullPixelRatio);
    this._still = 0;
    this.webgl.setPixelRatio(this.fullPixelRatio);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1;

    this.timer = new THREE.Timer();
    this._onFrame = null;
    this._resizeListeners = new Set();
    this._observer = new ResizeObserver(() => this._resize());
    this._observer.observe(canvas);
    this._resize();
  }

  get size() {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  onResize(fn) {
    this._resizeListeners.add(fn);
    const size = this.size;
    if (size.width && size.height) fn(size); // canvas chưa hiển thị (0x0) thì chờ ResizeObserver
    return () => this._resizeListeners.delete(fn);
  }

  /** Báo khung hình hiện tại có chuyển động hay không, để đổi độ phân giải thích ứng. */
  setMotion(moving, dt) {
    if (this.motionPixelRatio === this.fullPixelRatio) return;
    this._still = moving ? 0 : this._still + dt;
    const want = this._still > 0.25 ? this.fullPixelRatio : this.motionPixelRatio;
    if (this.webgl.getPixelRatio() !== want) this.webgl.setPixelRatio(want);
  }

  /** Đặt hàm được gọi mỗi khung hình: fn(deltaSeconds). */
  setFrameHandler(fn) {
    this._onFrame = fn;
  }

  start() {
    this.timer.reset();
    this.webgl.setAnimationLoop((t) => {
      this.timer.update(t);
      this._onFrame?.(Math.min(this.timer.getDelta(), 0.1));
    });
  }

  stop() {
    this.webgl.setAnimationLoop(null);
  }

  _resize() {
    const { width, height } = this.size;
    if (!width || !height) return;
    this.webgl.setSize(width, height, false);
    for (const fn of this._resizeListeners) fn({ width, height });
  }

  dispose() {
    this.stop();
    this._observer.disconnect();
    this.webgl.dispose();
  }
}
