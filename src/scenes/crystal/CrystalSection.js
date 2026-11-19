import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import data from '../../../data/crystal.json';
import { Renderer } from '../../core/Renderer.js';
import { loadGLTF } from '../../core/AssetLoader.js';
import { CameraTween } from '../../camera/CameraTween.js';
import { ContentPanel } from '../../ui/ContentPanel.js';
import { createHomeButton } from '../../ui/HomeButton.js';
import { CrystalLattice } from './CrystalLattice.js';

const CRYSTAL_MODEL = 'models/TT.glb';
const BG = 0xf6f3fb;
const TAP_MOVE = 8;
const SWIPE_MIN = 40;
const TRANSITION = 1.4; // giây
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Mục 3 – Tinh thể kí ức.
 * Trạng thái: 'crystal' (khối tinh thể tự xoay) -> 'lattice' (mạng tinh thể, xoay có quán tính)
 * -> 'focus' (xem một ảnh + nội dung). Thu nhỏ hết cỡ trong mạng tinh thể để quay về khối
 * tinh thể, khi đó phần kết hiện ở phía dưới.
 */
export class CrystalSection {
  constructor({ onHome }) {
    this.el = document.createElement('section');
    this.el.className = 'view crystal';
    this.el.setAttribute('aria-label', 'Tinh thể kí ức');
    this.el.innerHTML = `
      <div class="crystal__stage"><canvas class="crystal__canvas"></canvas>
        <p class="crystal__hint" aria-live="polite"></p>
        <div class="crystal__loader">Đang tải…</div>
      </div>`;
    this.stage = this.el.querySelector('.crystal__stage');
    this.canvas = this.el.querySelector('.crystal__canvas');
    this.hintEl = this.el.querySelector('.crystal__hint');
    this.loaderEl = this.el.querySelector('.crystal__loader');
    this.panel = new ContentPanel();
    this.panel.el.classList.add('crystal__panel');
    this.panel.el.hidden = true;
    this.homeBtn = createHomeButton(onHome);
    this.el.append(this.panel.el, this.homeBtn);

    this.renderer = new Renderer(this.canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 4, 12);
    const pmrem = new THREE.PMREMGenerator(this.renderer.webgl);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 5, 4);
    this.scene.add(sun, new THREE.AmbientLight(0xffffff, 0.4));

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.tween = new CameraTween(this.camera, this.controls.target);
    this.raycaster = new THREE.Raycaster();

    this.crystal = new THREE.Group();
    this.lattice = new CrystalLattice(data.photos);
    this.lattice.setOpacity(0);
    this.scene.add(this.crystal, this.lattice.group);

    this.state = 'crystal';
    this.focused = null;
    this._transition = null;
    this._time = 0;
    this._ready = null;

    this.renderer.onResize(({ width, height }) => {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.renderer.setFrameHandler((dt) => this._frame(dt));
    this._bindInput();
  }

  enter() {
    this._ready ??= this._load();
    this._ready.then(() => {
      this._setState('crystal', { showEnding: false });
      this._placeCamera(this.crystalDistance, true);
    });
    this.renderer.start();
  }

  leave() {
    this.renderer.stop();
    this.tween.cancel();
    this._transition = null;
  }

  async _load() {
    try {
      const gltf = await loadGLTF(CRYSTAL_MODEL);
      const model = gltf.scene;
      // Đưa khối tinh thể về tâm, chuẩn hoá bán kính = 1
      const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
      model.position.sub(sphere.center);
      const holder = new THREE.Group();
      holder.add(model);
      holder.scale.setScalar(1 / sphere.radius);
      this.crystal.add(holder);
      this._crystalMats = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const mat of [o.material].flat()) {
          mat.transparent = true;
          mat.userData.baseOpacity = mat.opacity;
          this._crystalMats.push(mat);
        }
      });
    } catch (err) {
      console.error(err);
    }
    this.loaderEl.hidden = true;
    this.lattice.loadPhotos();
  }

  /** Khoảng cách để vật bán kính `radius` chiếm tỉ lệ `fill` của chiều hẹp hơn của khung hình. */
  _fit(radius, fill) {
    const v = (this.camera.fov * Math.PI) / 180;
    const h = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    return radius / Math.tan(Math.min(v, h) / 2) / fill;
  }

  get crystalDistance() {
    return this._fit(1, 0.62);
  }

  get latticeDistance() {
    return this._fit(this.lattice.radius, 1.1);
  }

  get exitDistance() {
    return this.latticeDistance * 1.45;
  }

  // ---------- Trạng thái ----------

  _setState(state, { showEnding } = {}) {
    this.state = state;
    const c = this.controls;
    c.enabled = state === 'crystal' || state === 'lattice';
    this.homeBtn.hidden = state === 'lattice' || state === 'focus';
    if (state === 'crystal') {
      c.autoRotate = true;
      c.autoRotateSpeed = 1.2;
      c.dampingFactor = 0.08;
      c.rotateSpeed = 0.8;
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI;
      c.minDistance = this.crystalDistance * 0.6;
      c.maxDistance = this.crystalDistance * 1.6;
      this._showPanel(showEnding ? data.ending : null);
      this._hint(showEnding ? '' : data.hint);
    } else if (state === 'lattice') {
      c.autoRotate = true;
      c.autoRotateSpeed = 0.35;
      c.dampingFactor = 0.035; // quán tính dài, xoay "trôi" như thiên hà
      c.rotateSpeed = 0.55;
      c.minDistance = 0.9;
      c.maxDistance = this.latticeDistance * 1.6;
      this._showPanel(null);
    }
  }

  _hint(text, { autoHide = 0 } = {}) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('is-visible', !!text);
    clearTimeout(this._hintTimer);
    if (text && autoHide) this._hintTimer = setTimeout(() => this.hintEl.classList.remove('is-visible'), autoHide);
  }

  _showPanel(content) {
    if (!content) {
      this.panel.el.hidden = true;
      return;
    }
    this.panel.el.hidden = false;
    this.panel.set(content, this.panel.titleEl.textContent ? 1 : 0);
  }

  _placeCamera(distance, resetAngles = false) {
    const dir = resetAngles
      ? new THREE.Vector3().setFromSphericalCoords(1, Math.PI * 0.42, Math.PI * 0.15)
      : this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(distance));
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  /** Chuyển giữa khối tinh thể và mạng tinh thể (to = 1: vào mạng, 0: ra khối). */
  _morph(to) {
    const from = to ? 0 : 1;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this._transition = {
      t: 0,
      from,
      to,
      dir,
      d0: this.camera.position.distanceTo(this.controls.target),
      d1: to ? this.latticeDistance : this.crystalDistance,
      target0: this.controls.target.clone(),
    };
    this.controls.enabled = false;
    this.homeBtn.hidden = true;
    this._hint('');
    this._showPanel(null);
  }

  _applyMorph(k) {
    // k: 0 = khối tinh thể, 1 = mạng tinh thể
    this.crystal.scale.setScalar(1 + k * 2.5);
    this.crystal.visible = k < 0.999;
    for (const mat of this._crystalMats ?? []) mat.opacity = (1 - k) * mat.userData.baseOpacity;
    this.lattice.group.scale.setScalar(0.25 + 0.75 * k);
    this.lattice.setOpacity(k);
  }

  // ---------- Focus ảnh ----------

  _focusCard(card) {
    const first = this.state !== 'focus';
    this.state = 'focus';
    this.focused = card;
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.homeBtn.hidden = true;
    this._hint('');
    this._showPanel({ title: card.data.title, body: card.data.body });
    // Đợi khung nội dung hiện để canvas đổi kích thước rồi mới tính khoảng cách
    requestAnimationFrame(() => {
      const pos = card.group.getWorldPosition(new THREE.Vector3());
      const { width, height } = this.lattice.cardExtent(card);
      const scale = this.lattice.group.scale.x;
      const fov = (this.camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect);
      const fill = 0.8;
      const d = Math.max(
        (height * scale) / 2 / Math.tan(fov / 2) / fill,
        (width * scale) / 2 / Math.tan(hFov / 2) / fill,
      );
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      this.tween.to({ position: pos.clone().addScaledVector(dir, d), target: pos }, { duration: first ? 1.2 : 0.8 });
    });
  }

  _exitFocus() {
    if (this.state !== 'focus') return;
    this.focused = null;
    this._showPanel(null);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.tween
      .to({ position: dir.multiplyScalar(this.latticeDistance), target: new THREE.Vector3() }, { duration: 1.1 })
      .then((done) => done && this._setState('lattice'));
  }

  /** Vuốt khi đang xem ảnh: chuyển sang ảnh nằm theo hướng vuốt; hết ảnh thì nảy lại. */
  _swipeFocus(dx, dy) {
    const want = new THREE.Vector2(-dx, dy).normalize(); // vuốt trái -> xem ảnh bên phải
    const here = this.focused.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
    let best = null;
    let bestScore = Infinity;
    for (const card of this.lattice.cards) {
      if (card === this.focused) continue;
      const p = card.group.getWorldPosition(new THREE.Vector3()).project(this.camera);
      if (p.z > 1) continue;
      const v = new THREE.Vector2((p.x - here.x) * this.camera.aspect, p.y - here.y);
      const len = v.length();
      if (len < 1e-4) continue;
      const cos = v.dot(want) / len;
      if (cos < 0.5) continue;
      const score = len / cos;
      if (score < bestScore) {
        bestScore = score;
        best = card;
      }
    }
    if (best) return this._focusCard(best);

    // Không còn ảnh theo hướng này: nảy nhẹ rồi trở lại
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const offset = right.multiplyScalar(want.x * 0.12).add(up.multiplyScalar(want.y * 0.12));
    const home = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.tween
      .to({ position: home.position.clone().add(offset), target: home.target.clone().add(offset) }, { duration: 0.18 })
      .then((done) => done && this.tween.to(home, { duration: 0.45 }));
  }

  // ---------- Thao tác ----------

  _bindInput() {
    const pointers = new Map();
    let start = null;
    let pinchStart = 0;
    let wheelOut = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (pointers.size === 2) {
        start = null;
        pinchStart = pinchDistance(pointers);
      }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Đang xem ảnh: chụm hai ngón để thu nhỏ về mạng tinh thể
      if (this.state === 'focus' && pointers.size === 2 && pinchStart > 0) {
        if (pinchDistance(pointers) / pinchStart < 0.8) {
          pinchStart = 0;
          this._exitFocus();
        }
      }
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (!start || e.type !== 'pointerup') return void (start = pointers.size ? start : null);
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const quick = performance.now() - start.t < 800;
      start = null;
      if (this._transition || this.tween.active) return;
      if (Math.hypot(dx, dy) <= TAP_MOVE) this._onTap(e);
      else if (this.state === 'focus' && quick && Math.hypot(dx, dy) >= SWIPE_MIN) this._swipeFocus(dx, dy);
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.state !== 'focus') return;
        e.preventDefault();
        wheelOut = e.deltaY > 0 ? wheelOut + e.deltaY : 0;
        if (wheelOut > 60) {
          wheelOut = 0;
          this._exitFocus();
        }
      },
      { passive: false },
    );
  }

  _onTap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.state === 'crystal') {
      if (this.raycaster.intersectObject(this.crystal, true).length) this._morph(1);
    } else if (this.state === 'lattice' || this.state === 'focus') {
      const hit = this.raycaster.intersectObjects(this.lattice.pickables(), false)[0];
      if (hit) this._focusCard(this.lattice.cards[hit.object.userData.cardIndex]);
    }
  }

  // ---------- Vòng lặp ----------

  _frame(dt) {
    this._time += dt;
    const tr = this._transition;
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / TRANSITION);
      const k = ease(tr.t);
      const mix = tr.from + (tr.to - tr.from) * k;
      this._applyMorph(mix);
      this.controls.target.lerpVectors(tr.target0, new THREE.Vector3(), k);
      this.camera.position.copy(this.controls.target).addScaledVector(tr.dir, tr.d0 + (tr.d1 - tr.d0) * k);
      this.camera.lookAt(this.controls.target);
      if (tr.t >= 1) {
        this._transition = null;
        if (tr.to) {
          this._setState('lattice');
          this._hint(data.latticeHint, { autoHide: 4000 });
        } else {
          this._setState('crystal', { showEnding: true });
        }
      }
    } else if (this.tween.active) {
      this.tween.update(dt);
    } else if (this.controls.enabled) {
      this.controls.update(dt);
      // Thu nhỏ hết cỡ trong mạng tinh thể -> quay về khối tinh thể (phần kết)
      if (this.state === 'lattice' && this.camera.position.distanceTo(this.controls.target) > this.exitDistance) {
        this._morph(0);
      }
    }

    // Sương mù theo khoảng cách camera để mạng tinh thể có chiều sâu
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.scene.fog.near = dist; // vật ở gần hơn điểm nhìn (ảnh đang xem) không bị mờ
    this.scene.fog.far = dist + this.lattice.radius * 2.2;

    this.lattice.update(this.camera, this._time);
    this.renderer.webgl.render(this.scene, this.camera);
  }
}

function pinchDistance(pointers) {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
