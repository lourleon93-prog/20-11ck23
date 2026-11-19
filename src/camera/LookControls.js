import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * Điều khiển kiểu Street View: camera đứng yên tại chỗ, kéo để nhìn quanh (có quán tính),
 * chụm hai ngón / cuộn chuột để phóng to (đổi góc nhìn FOV).
 * Kéo sang phải -> cảnh "được kéo" sang phải (nhìn sang trái), giống Google Maps.
 */
export class LookControls {
  constructor(camera, dom, { pitchMin = -35, pitchMax = 30, fovMin = 35, fovMax = 75 } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.enabled = true;
    this.yaw = 0;
    this.pitch = 0;
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.fov = camera.fov;
    this.targetFov = camera.fov;
    this.pitchMin = pitchMin * DEG;
    this.pitchMax = pitchMax * DEG;
    this.fovMin = fovMin;
    this.fovMax = fovMax;
    this.sensitivity = 1.4; // radian cho mỗi chiều cao màn hình kéo
    this._vel = { yaw: 0, pitch: 0 };
    this._pointers = new Map();
    this._pinch = 0;
    this._bind();
  }

  /** Quay về hướng nhìn một điểm (mượt). */
  lookAt(point, { immediate = false } = {}) {
    const dir = new THREE.Vector3().subVectors(point, this.camera.position).normalize();
    let yaw = Math.atan2(-dir.x, -dir.z);
    yaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw)); // đường quay ngắn nhất
    this.targetYaw = yaw;
    this.targetPitch = THREE.MathUtils.clamp(Math.asin(dir.y), this.pitchMin, this.pitchMax);
    this._vel.yaw = this._vel.pitch = 0;
    if (immediate) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this._apply();
    }
  }

  setFov(fov) {
    this.targetFov = THREE.MathUtils.clamp(fov, this.fovMin, this.fovMax);
  }

  update(dt) {
    if (!this._pointers.size) {
      // Quán tính sau khi thả tay
      this.targetYaw += this._vel.yaw * dt;
      this.targetPitch += this._vel.pitch * dt;
      const decay = Math.exp(-dt * 4);
      this._vel.yaw *= decay;
      this._vel.pitch *= decay;
    }
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, this.pitchMin, this.pitchMax);
    const k = 1 - Math.exp(-dt * 10);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.fov += (this.targetFov - this.fov) * k;
    this._apply();
  }

  _apply() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    if (Math.abs(this.camera.fov - this.fov) > 1e-3) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  _bind() {
    const el = this.dom;
    let last = null;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      last = { x: e.clientX, y: e.clientY, t: performance.now() };
      this._vel.yaw = this._vel.pitch = 0;
      if (this._pointers.size === 2) this._pinch = this._pinchDist();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this._pointers.has(e.pointerId)) return;
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 2) {
        const d = this._pinchDist();
        if (this._pinch > 0) this.setFov(this.targetFov * (this._pinch / d));
        this._pinch = d;
        return;
      }
      if (!last) return;
      const h = el.clientHeight || 1;
      const scale = (this.sensitivity * (this.fov / 60)) / h; // phóng to thì xoay chậm lại
      const dYaw = (e.clientX - last.x) * scale;
      const dPitch = (e.clientY - last.y) * scale;
      this.targetYaw += dYaw;
      this.targetPitch += dPitch;
      const now = performance.now();
      const dt = Math.max(1, now - last.t) / 1000;
      this._vel.yaw = dYaw / dt;
      this._vel.pitch = dPitch / dt;
      last = { x: e.clientX, y: e.clientY, t: now };
    });
    const up = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinch = 0;
      if (!this._pointers.size) {
        // Thả tay sau khi đứng yên một lúc thì không trôi
        if (last && performance.now() - last.t > 80) this._vel.yaw = this._vel.pitch = 0;
        last = null;
      } else {
        const p = [...this._pointers.values()][0];
        last = { x: p.x, y: p.y, t: performance.now() };
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.setFov(this.targetFov * Math.exp(e.deltaY * 0.001));
      },
      { passive: false },
    );
  }

  _pinchDist() {
    const [a, b] = [...this._pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }
}
