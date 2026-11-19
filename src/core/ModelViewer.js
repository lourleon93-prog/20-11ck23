import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Renderer } from './Renderer.js';
import { loadGLTF } from './AssetLoader.js';

const DEG = Math.PI / 180;

/**
 * Khung xem một model GLB với góc xoay/zoom giới hạn. Một canvas (một WebGL context)
 * dùng lại cho nhiều model: gọi show(path, view) để đổi model.
 *
 * view: { frontAzimuthDeg, azimuthRangeDeg, initialPolarDeg, polarMinDeg, polarMaxDeg,
 *         zoomMin, zoomMax, fitPadding? }
 */
export class ModelViewer {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'viewer';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'viewer__canvas';
    this.loaderEl = document.createElement('div');
    this.loaderEl.className = 'viewer__loader';
    this.el.append(this.canvas, this.loaderEl);

    this.renderer = new Renderer(this.canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    const pmrem = new THREE.PMREMGenerator(this.renderer.webgl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this._token = 0;
    this._view = null;

    this.renderer.onResize(({ width, height }) => {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (this._view) this._frame(this._view, { keepAngles: true });
    });
    this.renderer.setFrameHandler((dt) => {
      this.controls.update(dt);
      this.renderer.webgl.render(this.scene, this.camera);
    });
  }

  async show(path, view) {
    const token = ++this._token;
    this.root.clear();
    this._view = null;
    this._setLoading('Đang tải mô hình… 0%');
    let gltf;
    try {
      gltf = await loadGLTF(path, (p) => token === this._token && this._setLoading(`Đang tải mô hình… ${Math.round(p * 100)}%`));
    } catch (err) {
      console.error(err);
      if (token === this._token) this._setLoading('Không tải được mô hình.');
      return;
    }
    if (token !== this._token) return;
    this.root.add(gltf.scene);
    this._view = view;
    this._frame(view);
    this._setLoading('');
    this.renderer.start();
  }

  start() {
    if (this._view) this.renderer.start();
  }

  stop() {
    this.renderer.stop();
  }

  _frame(view, { keepAngles = false } = {}) {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distance = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * (view.fitPadding ?? 1);

    this.camera.near = distance / 100;
    this.camera.far = distance * 20;
    this.camera.updateProjectionMatrix();

    const front = view.frontAzimuthDeg * DEG;
    const half = (view.azimuthRangeDeg / 2) * DEG;
    const c = this.controls;
    c.minAzimuthAngle = front - half;
    c.maxAzimuthAngle = front + half;
    c.minPolarAngle = view.polarMinDeg * DEG;
    c.maxPolarAngle = view.polarMaxDeg * DEG;
    c.minDistance = distance * view.zoomMin;
    c.maxDistance = distance * view.zoomMax;

    const azimuth = keepAngles ? c.getAzimuthalAngle() : front;
    const polar = keepAngles ? c.getPolarAngle() : view.initialPolarDeg * DEG;
    c.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).add(new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth));
    c.update();
  }

  _setLoading(text) {
    this.loaderEl.textContent = text;
    this.loaderEl.hidden = !text;
  }
}
