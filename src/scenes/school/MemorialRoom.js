import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { loadGLTF } from '../../core/AssetLoader.js';
import { analyzePlanarObject } from '../../camera/CameraFocus.js';

const DEG = Math.PI / 180;

// Các điểm trên khung hình (toạ độ NDC) dùng để kiểm tra camera có nhìn ra ngoài tường/sàn không
const SAMPLES = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function findByName(root, name) {
  return root.getObjectByName(name) ?? root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
}

/**
 * Khu vực tưởng nhớ thầy.
 * Camera chỉ được nhìn trong phạm vi góc tường có ảnh và bàn: mọi góc khung hình phải rơi vào
 * bức tường (hoặc sàn phía dưới) — nếu xoay/zoom làm lộ ra ngoài (trời), camera bị giữ lại.
 * Xoay có độ trễ lớn. Nút "Dâng hoa" thêm bó hoa (flower.glb, đã căn sẵn trùng lọ hoa).
 */
export class MemorialRoom {
  constructor({ canvas, config }) {
    this.config = config;
    this.camera = new THREE.PerspectiveCamera(config.fov ?? 40, 1, 0.01, 100);
    this.scene = new THREE.Scene();
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enabled = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = config.damping;
    this.controls.rotateSpeed = 0.35;
    this.controls.zoomSpeed = 0.6;
    this.flowerOffered = false;
    this._loaded = null;
    this._lastValid = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
  }

  load(onProgress) {
    this._loaded ??= loadGLTF(this.config.model, onProgress).then((gltf) => {
      const root = gltf.scene;
      this.scene.add(root);
      root.updateMatrixWorld(true);
      const cfg = this.config;

      const photo = findByName(root, cfg.photoMesh);
      const wall = findByName(root, cfg.wallMesh);
      const floor = findByName(root, cfg.floorMesh);
      if (!photo || !wall) throw new Error('Không tìm thấy ảnh hoặc bức tường trong phòng tưởng nhớ');
      this.photoPlane = analyzePlanarObject(photo);
      this.wall = analyzePlanarObject(wall);
      this.floorBox = floor ? new THREE.Box3().setFromObject(floor) : null;

      // Vùng cần thấy: ảnh thầy + bàn (+ các vật liệt kê trong cấu hình)
      this.frameBox = new THREE.Box3();
      for (const name of [cfg.photoMesh, ...(cfg.frameMeshes ?? [])]) {
        const obj = findByName(root, name);
        if (obj) this.frameBox.expandByObject(obj);
      }

      // Tải sẵn bó hoa ở nền
      this._flower = loadGLTF(cfg.flower);
      this._flower.catch(() => {});
    });
    return this._loaded;
  }

  setEnvironment(env) {
    this.scene.environment = env.envMap;
    this.scene.background = env.background; // không bao giờ lộ ra nhờ giới hạn khung hình
  }

  enter() {
    const cfg = this.config;
    const normal = this.photoPlane.normal.clone();
    const center = this.frameBox.getCenter(new THREE.Vector3());
    // Điểm nhìn: tâm vùng ảnh + bàn, đặt trên mặt tường
    const target = this._projectOnWall(center);

    const size = this.frameBox.getSize(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, normal).normalize();
    const contentH = size.y;
    const contentW = Math.abs(size.x * side.x) + Math.abs(size.z * side.z);

    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    // Khoảng cách để ảnh + bàn vừa khung hình
    let distance = Math.max(contentH / 2 / Math.tan(vFov / 2), contentW / 2 / Math.tan(hFov / 2)) / cfg.fill;
    // Không lùi xa tới mức khung hình vượt ra ngoài bức tường
    const maxDistance = this._maxDistanceInsideWall(target, normal, vFov, hFov);
    distance = Math.min(distance, maxDistance);

    const c = this.controls;
    c.target.copy(target);
    this.camera.position.copy(target).addScaledVector(normal, distance);
    this.camera.near = distance / 200;
    this.camera.far = distance * 50;
    this.camera.updateProjectionMatrix();

    const az = Math.atan2(normal.x, normal.z);
    c.minAzimuthAngle = az - (cfg.azimuthRangeDeg / 2) * DEG;
    c.maxAzimuthAngle = az + (cfg.azimuthRangeDeg / 2) * DEG;
    c.minPolarAngle = (90 - cfg.polarRangeDeg / 2) * DEG;
    c.maxPolarAngle = (90 + cfg.polarRangeDeg / 2) * DEG;
    c.minDistance = distance * cfg.zoomMin;
    c.maxDistance = distance; // không thu nhỏ hơn góc nhìn ban đầu
    c.enabled = true;
    c.update();
    this._lastValid.copy(this.camera.position);
  }

  leave() {
    this.controls.enabled = false;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.controls.enabled) this.enter(); // đổi hướng màn hình: tính lại khung hình
  }

  /** Thêm bó hoa vào lọ (không animation). */
  async offerFlower() {
    if (this.flowerOffered) return;
    const gltf = await this._flower;
    this.scene.add(gltf.scene);
    this.flowerOffered = true;
  }

  update(dt) {
    if (!this.controls.enabled) return;
    this.controls.update(dt);
    // Giữ camera trong phạm vi góc tường: nếu khung hình lộ ra ngoài thì trả về vị trí hợp lệ trước đó
    if (this._viewInsideRoom()) this._lastValid.copy(this.camera.position);
    else {
      this.camera.position.copy(this._lastValid);
      this.camera.lookAt(this.controls.target);
    }
  }

  // ---------- Hình học ----------

  _projectOnWall(point) {
    const w = this.wall;
    const d = new THREE.Vector3().subVectors(point, w.center).dot(w.normal);
    return point.clone().addScaledVector(w.normal, -d);
  }

  /** Toạ độ (u, v) của điểm trên mặt tường so với tâm tường, cùng nửa kích thước tường. */
  _wallCoords(p) {
    const w = this.wall;
    const d = new THREE.Vector3().subVectors(p, w.center);
    // Trục "đứng" của tường là trục gần với phương thẳng đứng nhất
    const uVertical = Math.abs(w.axisU.y) > Math.abs(w.axisV.y);
    const vert = uVertical ? w.axisU : w.axisV;
    const horiz = uVertical ? w.axisV : w.axisU;
    const sign = vert.y >= 0 ? 1 : -1;
    return {
      x: d.dot(horiz),
      y: d.dot(vert) * sign,
      halfX: (uVertical ? w.sizeV : w.sizeU) / 2,
      halfY: (uVertical ? w.sizeU : w.sizeV) / 2,
    };
  }

  _maxDistanceInsideWall(target, normal, vFov, hFov) {
    const m = this.config.wallMargin;
    const t = this._wallCoords(target);
    const halfW = Math.min(t.halfX - t.x, t.halfX + t.x) - m;
    const halfH = t.halfY - t.y - m; // chỉ giới hạn mép trên; phía dưới là sàn
    return Math.max(0.1, Math.min(halfW / Math.tan(hFov / 2), halfH / Math.tan(vFov / 2)));
  }

  _viewInsideRoom() {
    const cam = this.camera;
    cam.updateMatrixWorld();
    const w = this.wall;
    const m = this.config.wallMargin * 0.5;
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(w.normal, w.center);
    const floorY = this.floorBox ? this.floorBox.max.y : -Infinity;
    const hit = new THREE.Vector3();
    for (const [x, y] of SAMPLES) {
      this._ray.setFromCamera(ndc.set(x, y), cam);
      const ray = this._ray.ray;
      // Tia chạm sàn trước khi tới tường: hợp lệ nếu nằm trong sàn
      if (this.floorBox && ray.direction.y < 0) {
        const tFloor = (floorY - ray.origin.y) / ray.direction.y;
        const tWall = ray.intersectPlane(plane, hit) ? ray.origin.distanceTo(hit) : Infinity;
        if (tFloor > 0 && tFloor < tWall) {
          const p = ray.at(tFloor, new THREE.Vector3());
          const b = this.floorBox;
          if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) return false;
          continue;
        }
      }
      if (!ray.intersectPlane(plane, hit)) return false;
      const c = this._wallCoords(hit);
      if (Math.abs(c.x) > c.halfX - m || c.y > c.halfY - m) return false;
    }
    return true;
  }
}
