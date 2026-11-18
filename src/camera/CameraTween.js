const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Di chuyển mượt camera + điểm nhìn (target của controls) tới tư thế mới.
 * Gọi update(dt) mỗi khung hình. Trả về Promise khi hoàn tất.
 */
export class CameraTween {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target; // THREE.Vector3 (vd. controls.target)
    this._job = null;
  }

  get active() {
    return this._job !== null;
  }

  to({ position, target }, { duration = 1.6, ease = easeInOutCubic } = {}) {
    this.cancel();
    return new Promise((resolve) => {
      this._job = {
        fromPos: this.camera.position.clone(),
        fromTarget: this.target.clone(),
        toPos: position.clone(),
        toTarget: target.clone(),
        t: 0,
        duration,
        ease,
        resolve,
      };
    });
  }

  cancel() {
    if (this._job) this._job.resolve(false);
    this._job = null;
  }

  update(dt) {
    const job = this._job;
    if (!job) return;
    job.t = Math.min(1, job.t + dt / job.duration);
    const k = job.ease(job.t);
    this.camera.position.lerpVectors(job.fromPos, job.toPos, k);
    this.target.lerpVectors(job.fromTarget, job.toTarget, k);
    this.camera.lookAt(this.target);
    if (job.t >= 1) {
      this._job = null;
      job.resolve(true);
    }
  }
}
