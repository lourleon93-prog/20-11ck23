import * as THREE from 'three';

/**
 * Bọc WebGLRenderer: cấu hình chuẩn cho mobile, tự resize theo kích thước canvas
 * và chỉ chạy vòng lặp render khi được bật (tiết kiệm pin/GPU khi cảnh bị ẩn).
 */
export class Renderer {
  constructor(canvas, { maxPixelRatio = 2 } = {}) {
    this.canvas = canvas;
    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
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
    fn(this.size);
    return () => this._resizeListeners.delete(fn);
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
