import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { loadGLTF } from '../../core/AssetLoader.js';
import { analyzePlanarObject, computeFocusPose } from '../../camera/CameraFocus.js';

const DEG = Math.PI / 180;

/**
 * Khu vực tưởng nhớ thầy: camera nhìn vào ảnh người thầy, xoay/zoom giới hạn với độ trễ lớn.
 * Nút "Dâng hoa" thêm bó hoa (flower.glb, đã căn sẵn toạ độ trùng lọ hoa) vào cảnh.
 */
export class MemorialRoom {
  constructor({ canvas, config }) {
    this.config = config;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.scene = new THREE.Scene();
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enabled = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = config.damping;
    this.controls.rotateSpeed = 0.35;
    this.flowerOffered = false;
    this._loaded = null;
  }

  load(onProgress) {
    this._loaded ??= loadGLTF(this.config.model, onProgress).then((gltf) => {
      this.scene.add(gltf.scene);
      const name = this.config.photoMesh;
      const photo =
        gltf.scene.getObjectByName(name) ?? gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
      if (!photo) throw new Error(`Không tìm thấy ảnh "${this.config.photoMesh}" trong phòng tưởng nhớ`);
      this.photoPlane = analyzePlanarObject(photo);
      // Tải sẵn bó hoa ở nền
      this._flower = loadGLTF(this.config.flower);
      this._flower.catch(() => {});
    });
    return this._loaded;
  }

  setEnvironment(env) {
    this.scene.environment = env.envMap;
    this.scene.background = env.background;
  }

  enter() {
    const cfg = this.config;
    const plane = this.photoPlane;
    const pose = computeFocusPose(this.camera, plane, { fill: cfg.fill });
    const c = this.controls;
    const distance = pose.position.distanceTo(pose.target);
    const az = Math.atan2(plane.normal.x, plane.normal.z);
    c.target.copy(pose.target);
    this.camera.position.copy(pose.position);
    c.minAzimuthAngle = az - (cfg.azimuthRangeDeg / 2) * DEG;
    c.maxAzimuthAngle = az + (cfg.azimuthRangeDeg / 2) * DEG;
    c.minPolarAngle = (90 - cfg.polarRangeDeg / 2) * DEG;
    c.maxPolarAngle = (90 + cfg.polarRangeDeg / 2) * DEG;
    c.minDistance = distance * cfg.zoomMin;
    c.maxDistance = distance * cfg.zoomMax;
    this.camera.near = distance / 200;
    this.camera.far = distance * 50;
    this.camera.updateProjectionMatrix();
    c.enabled = true;
    c.update();
  }

  leave() {
    this.controls.enabled = false;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Thêm bó hoa vào lọ (không animation). Trả về Promise khi hoa đã hiện. */
  async offerFlower() {
    if (this.flowerOffered) return;
    const gltf = await this._flower;
    this.scene.add(gltf.scene);
    this.flowerOffered = true;
  }

  update(dt) {
    if (this.controls.enabled) this.controls.update(dt);
  }
}
