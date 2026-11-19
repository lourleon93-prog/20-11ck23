const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Di chuyển mượt camera + điểm nhìn (target của controls) tới tư thế mới.
 * Gọi update(dt) mỗi khung hình. Trả về Promise khi hoàn tất.
 *
 * Tuỳ chọn `orbitAxis` ({x, z}): camera đi vòng quanh trục thẳng đứng qua điểm này
 * (nội suy góc, bán kính, độ cao) thay vì đi thẳng — tránh xuyên qua model ở giữa.
 * Nếu có `orbitAxis.centerAzimuth` (radian), góc được đo quanh hướng đó để đường đi
 * nằm trong vùng xoay hợp lệ; nếu không, dùng đường vòng ngắn nhất.
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

  to({ position, target }, { duration = 1.6, ease = easeInOutCubic, orbitAxis = null } = {}) {
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
        orbit: orbitAxis && cylindricalPath(this.camera.position, position, orbitAxis),
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
    if (job.orbit) {
      const { axis, a0, da, r0, r1, y0, y1 } = job.orbit;
      const a = a0 + da * k;
      const r = r0 + (r1 - r0) * k;
      this.camera.position.set(axis.x + Math.sin(a) * r, y0 + (y1 - y0) * k, axis.z + Math.cos(a) * r);
    } else {
      this.camera.position.lerpVectors(job.fromPos, job.toPos, k);
    }
    this.target.lerpVectors(job.fromTarget, job.toTarget, k);
    this.camera.lookAt(this.target);
    if (job.t >= 1) {
      this._job = null;
      job.resolve(true);
    }
  }
}

function cylindricalPath(from, to, axis) {
  const c = axis.centerAzimuth ?? null;
  const wrap = (a, ref) => ref + Math.atan2(Math.sin(a - ref), Math.cos(a - ref));
  let a0 = Math.atan2(from.x - axis.x, from.z - axis.z);
  let a1 = Math.atan2(to.x - axis.x, to.z - axis.z);
  if (c !== null) {
    a0 = wrap(a0, c);
    a1 = wrap(a1, c);
  } else {
    a1 = wrap(a1, a0); // đường vòng ngắn nhất
  }
  const da = a1 - a0;
  return {
    axis,
    a0,
    da,
    r0: Math.hypot(from.x - axis.x, from.z - axis.z),
    r1: Math.hypot(to.x - axis.x, to.z - axis.z),
    y0: from.y,
    y1: to.y,
  };
}
