import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Renderer } from '../../core/Renderer.js';
import { loadGLTF } from '../../core/AssetLoader.js';
import { analyzePlanarObject, computeFocusPose } from '../../camera/CameraFocus.js';
import { CameraTween } from '../../camera/CameraTween.js';
import { SwipeHint } from '../../ui/SwipeHint.js';
import { HOME_CONFIG } from './homeConfig.js';

const DEG = Math.PI / 180;
const TAP_MAX_MOVE = 8; // px
const TAP_MAX_TIME = 450; // ms
const SWIPE_DISMISS_DX = 40; // px vuốt trái -> phải để ẩn gợi ý

/**
 * Trang chủ: cột chỉ đường 3 biển. Xoay ngang giới hạn, góc dọc giới hạn, zoom giới hạn.
 * Chạm vào một biển -> camera bay tới nhìn vuông góc biển -> gọi onSelect(section).
 */
export class HomeScene {
  constructor({ canvas, stage, loader, onSelect, config = HOME_CONFIG }) {
    this.canvas = canvas;
    this.stage = stage;
    this.loaderEl = loader;
    this.onSelect = onSelect;
    this.config = config;

    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    const pmrem = new THREE.PMREMGenerator(this.renderer.webgl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.8;

    this.tween = new CameraTween(this.camera, this.controls.target);
    this.raycaster = new THREE.Raycaster();
    this.signs = []; // { object, section, label, plane }
    this.busy = false;
    this.overviewPose = null;

    this.renderer.onResize(({ width, height }) => {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.renderer.setFrameHandler((dt) => this._frame(dt));
  }

  async init() {
    let gltf;
    try {
      gltf = await loadGLTF(this.config.model, (p) => this._setProgress(p));
    } catch (err) {
      this._showError(err);
      throw err;
    }
    this.model = gltf.scene;
    this.scene.add(this.model);

    this._collectSigns();
    this._frameModel();
    this._bindInput();
    this.swipeHint = new SwipeHint(this.stage);
    this.loaderEl.classList.add('is-hidden');

    // Chỉ render khi khu vực model đang hiển thị trên màn hình
    this._visibility = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) this.renderer.start();
      else this.renderer.stop();
    });
    this._visibility.observe(this.stage);
  }

  /** Đưa camera về góc nhìn tổng thể và mở lại điều khiển. */
  async returnToOverview() {
    if (!this.overviewPose) return;
    await this.tween.to(this.overviewPose, { duration: this.config.focus.duration, orbitAxis: this.orbitAxis });
    this.controls.enabled = true;
    this.busy = false;
  }

  _collectSigns() {
    for (const def of this.config.signs) {
      const object = this.model.getObjectByName(def.mesh) ?? findByPrefix(this.model, def.mesh);
      if (!object) {
        console.warn(`[Home] Không tìm thấy mesh biển hiệu "${def.mesh}"`);
        continue;
      }
      this.signs.push({ ...def, object, plane: analyzePlanarObject(object) });
    }
  }

  _frameModel() {
    const cfg = this.config;
    const modelBox = new THREE.Box3().setFromObject(this.model);
    const frameBox = new THREE.Box3();
    if (cfg.frameOn === 'signs' && this.signs.length) {
      for (const s of this.signs) frameBox.expandByObject(s.object);
    } else {
      frameBox.copy(modelBox);
    }
    const sphere = frameBox.getBoundingSphere(new THREE.Sphere());
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fov = Math.min(vFov, hFov);
    const distance = (sphere.radius / Math.sin(fov / 2)) * cfg.fitPadding;

    const modelRadius = modelBox.getBoundingSphere(new THREE.Sphere()).radius;
    this.camera.near = distance / 100;
    this.camera.far = (distance + modelRadius) * 10;
    this.camera.updateProjectionMatrix();

    const front = (cfg.frontAzimuthDeg === 'auto' ? this._autoFrontAzimuth() : cfg.frontAzimuthDeg) * DEG;
    const half = (cfg.azimuthRangeDeg / 2) * DEG;
    this.controls.minAzimuthAngle = front - half;
    this.controls.maxAzimuthAngle = front + half;
    this.controls.minPolarAngle = cfg.polarMinDeg * DEG;
    this.controls.maxPolarAngle = cfg.polarMaxDeg * DEG;
    this.controls.minDistance = distance * cfg.zoomMin;
    this.controls.maxDistance = distance * cfg.zoomMax;

    // Trục thẳng đứng của cột: camera bay vòng quanh trục này khi focus
    const axisCenter = modelBox.getCenter(new THREE.Vector3());
    this.orbitAxis = { x: axisCenter.x, z: axisCenter.z, centerAzimuth: front };

    const target = sphere.center.clone();
    const offset = new THREE.Vector3().setFromSphericalCoords(distance, cfg.initialPolarDeg * DEG, front);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();

    this.overviewPose = { position: this.camera.position.clone(), target: target.clone() };
  }

  /** Hướng (độ) nằm giữa cung nhỏ nhất chứa hướng mặt đọc được của mọi biển. */
  _autoFrontAzimuth() {
    const angles = this.signs
      .filter((s) => s.plane.hasFront)
      .map((s) => Math.atan2(s.plane.normal.x, s.plane.normal.z))
      .sort((a, b) => a - b);
    if (!angles.length) return 0;
    // Tìm khoảng trống lớn nhất giữa các hướng; mặt trước nằm đối diện khoảng trống đó
    let gapStart = angles[angles.length - 1];
    let gap = angles[0] + 2 * Math.PI - gapStart;
    for (let i = 1; i < angles.length; i++) {
      if (angles[i] - angles[i - 1] > gap) {
        gap = angles[i] - angles[i - 1];
        gapStart = angles[i - 1];
      }
    }
    const span = 2 * Math.PI - gap;
    if (span / DEG > this.config.azimuthRangeDeg) {
      console.warn(`[Home] Mặt các biển trải ${Math.round(span / DEG)}°, vượt biên độ xoay ${this.config.azimuthRangeDeg}°`);
    }
    return (gapStart + gap / 2 + Math.PI) / DEG;
  }

  _bindInput() {
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (down && e.isPrimary && !this.swipeHint?.dismissed && e.clientX - down.x > SWIPE_DISMISS_DX) {
        this.swipeHint.dismiss();
      }
      if (e.pointerType === 'mouse' && !down) {
        this.canvas.style.cursor = this._pickSign(e) ? 'pointer' : '';
      }
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || !e.isPrimary) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < TAP_MAX_TIME;
      down = null;
      if (moved > TAP_MAX_MOVE || !quick || this.busy) return;
      const sign = this._pickSign(e);
      if (sign) this._focusSign(sign);
    });
    this.canvas.addEventListener('pointercancel', () => (down = null));
  }

  _pickSign(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    // Raycast cả model để biển bị cột che khuất thì không chọn được
    const hit = this.raycaster.intersectObject(this.model, true)[0];
    if (!hit) return null;
    const direct = this.signs.find((s) => isDescendant(hit.object, s.object));
    if (direct) return direct;
    // Chạm vào tấm bảng quanh ảnh: chọn biển có mặt phẳng chứa điểm chạm
    return this.signs.find((s) => isNearPlane(hit.point, s.plane, this.config.hitSlack)) ?? null;
  }

  async _focusSign(sign) {
    this.busy = true;
    this.controls.enabled = false;
    this.swipeHint?.dismiss();
    this.overviewPose = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    const pose = computeFocusPose(this.camera, sign.plane, { fill: this.config.focus.fill });
    await this.tween.to(pose, { duration: this.config.focus.duration, orbitAxis: this.orbitAxis });
    this.onSelect?.(sign.section, sign);
  }

  _frame(dt) {
    if (this.tween.active) this.tween.update(dt);
    else if (this.controls.enabled) this.controls.update(dt);
    this.renderer.webgl.render(this.scene, this.camera);
  }

  _setProgress(p) {
    const el = this.loaderEl.querySelector('[data-progress]');
    if (el) el.textContent = `${Math.round(p * 100)}%`;
  }

  _showError(err) {
    console.error(err);
    this.loaderEl.classList.add('is-error');
    this.loaderEl.textContent = 'Không tải được mô hình. Vui lòng thử lại sau.';
  }
}

function isNearPlane(point, plane, slack) {
  const d = new THREE.Vector3().subVectors(point, plane.center);
  const size = Math.max(plane.sizeU, plane.sizeV);
  return (
    Math.abs(d.dot(plane.normal)) < size * 0.15 &&
    Math.abs(d.dot(plane.axisU)) < plane.sizeU * slack &&
    Math.abs(d.dot(plane.axisV)) < plane.sizeV * slack
  );
}

function isDescendant(object, ancestor) {
  for (let o = object; o; o = o.parent) if (o === ancestor) return true;
  return false;
}

// GLTFLoader có thể đổi tên node trùng (vd. thêm hậu tố _1), nên tìm theo tiền tố khi cần.
function findByPrefix(root, name) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.name.startsWith(name)) found = o;
  });
  return found;
}
