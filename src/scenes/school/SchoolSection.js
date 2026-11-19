import * as THREE from 'three';

import waypointsJson from '../../../data/waypoints.json';
import { Renderer } from '../../core/Renderer.js';
import { loadGLTF } from '../../core/AssetLoader.js';
import { loadHDRI, isMobileDevice, limitTextureSize } from '../../core/Environment.js';
import { LookControls } from '../../camera/LookControls.js';
import { createHomeButton } from '../../ui/HomeButton.js';
import { Gallery } from '../../ui/Gallery.js';
import { WaypointGraph } from './WaypointGraph.js';
import { SphereHotspot, WaypointMarker } from './Hotspots.js';
import { MemorialRoom } from './MemorialRoom.js';
import { SCHOOL_CONFIG } from './schoolConfig.js';

// Nội dung từng quả cầu: data/Mball.json, data/Mball.001.json, …
const SPHERE_DATA = Object.fromEntries(
  Object.entries(import.meta.glob('../../../data/Mball*.json', { eager: true, import: 'default' })).map(([path, json]) => [
    path.split('/').pop().replace(/\.json$/, ''),
    json,
  ]),
);

const TAP_MOVE = 8;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;

/**
 * Mục 2 – Thanh xuân có thầy cô.
 * Đi trong model trường theo waypoint (kiểu Street View): chạm chấm sáng để đi, kéo để nhìn quanh.
 * 4 quả cầu: 3 quả mở thư viện ảnh, 1 quả đưa vào khu vực tưởng nhớ thầy.
 */
export class SchoolSection {
  constructor({ onHome, config = SCHOOL_CONFIG }) {
    this.config = config;
    this.mobile = isMobileDevice();

    this.el = document.createElement('section');
    this.el.className = 'view school';
    this.el.setAttribute('aria-label', 'Thanh xuân có thầy cô');
    this.el.innerHTML = `
      <canvas class="school__canvas"></canvas>
      <p class="school__hint"></p>
      <div class="school__fade"></div>
      <div class="school__loader"><div class="school__loader-text">Đang tải sân trường…</div>
        <div class="school__bar"><span></span></div></div>
      <button type="button" class="school__offer" hidden></button>`;
    this.canvas = this.el.querySelector('.school__canvas');
    this.hintEl = this.el.querySelector('.school__hint');
    this.fadeEl = this.el.querySelector('.school__fade');
    this.loaderEl = this.el.querySelector('.school__loader');
    this.loaderText = this.el.querySelector('.school__loader-text');
    this.loaderBar = this.el.querySelector('.school__bar span');
    this.offerBtn = this.el.querySelector('.school__offer');

    this.homeBtn = createHomeButton(onHome);
    this.backBtn = createHomeButton(() => this._leaveMemorial());
    this.backBtn.classList.add('home-btn--second');
    this.backBtn.innerHTML = BACK_ICON;
    this.backBtn.hidden = true;
    this.gallery = new Gallery({ onClose: () => this._closeSphere() });
    this.el.append(this.gallery.el, this.homeBtn, this.backBtn);

    this.renderer = new Renderer(this.canvas, { maxPixelRatio: this.mobile ? config.mobileMaxPixelRatio : 2 });
    this.renderer.webgl.toneMappingExposure = config.exposure;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(config.cameraFov, 1, 0.005, 60);
    this.look = new LookControls(this.camera, this.canvas, { fovMax: config.cameraFov + 10 });
    this.raycaster = new THREE.Raycaster();
    this.graph = new WaypointGraph(waypointsJson);
    this.hotspots = [];
    this.markers = [];
    this._floorCache = new Map();
    this.memorial = new MemorialRoom({ canvas: this.canvas, config: config.memorial });
    this.mode = 'school'; // 'school' | 'sphere' | 'memorial'
    this._move = null;
    this._time = 0;
    this._ready = null;

    const memData = SPHERE_DATA[config.spheres.find((s) => s.type === 'memorial')?.data] ?? {};
    this.backBtn.setAttribute('aria-label', memData.backButton || 'Về sân trường');
    this.offerBtn.textContent = memData.offerButton || 'Dâng hoa';
    this.offerBtn.addEventListener('click', () => this._offerFlower(memData));

    this.renderer.onResize(({ width, height }) => {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.memorial.setAspect(width / height);
    });
    this.renderer.setFrameHandler((dt) => this._frame(dt));
    this._bindInput();
  }

  enter() {
    this._ready ??= this._load();
    this.renderer.start();
  }

  leave() {
    this.renderer.stop();
    // Lần sau quay lại: đứng ở sân trường, không mở sẵn thư viện/phòng tưởng nhớ
    if (this.gallery.isOpen) this.gallery.el.hidden = true;
    if (this.mode !== 'school' && this._savedPose) {
      this.memorial.leave();
      this.backBtn.hidden = this.offerBtn.hidden = true;
      this.fadeEl.classList.remove('is-on');
      this._move = null;
      this.camera.position.copy(this._savedPose.position);
      this.look.targetYaw = this.look.yaw = this._savedPose.yaw;
      this.look.targetPitch = this.look.pitch = this._savedPose.pitch;
      this.mode = 'school';
      this.look.enabled = true;
      for (const m of this.markers) m.group.visible = true;
    }
  }

  // ---------- Tải ----------

  async _load() {
    const cfg = this.config;
    try {
      const [env, gltf] = await Promise.all([
        loadHDRI(this.renderer.webgl, cfg.hdri),
        loadGLTF(cfg.model, (p) => this._progress(p)),
      ]);
      this.env = env;
      this.scene.environment = env.envMap;
      this.scene.background = env.background;
      this.memorial.setEnvironment(env);

      this.model = gltf.scene;
      if (this.mobile) {
        const n = limitTextureSize(this.model, cfg.mobileMaxTextureSize);
        if (n) console.info(`[School] Đã thu nhỏ ${n} texture cho điện thoại`);
      }
      this.scene.add(this.model);
      this.model.updateMatrixWorld(true);
      this._createSpheres();

      const start = this.graph.get(cfg.startWaypoint) ?? this.graph.get(this.graph.first);
      this.current = start.id;
      this.camera.position.copy(start.position);
      const next = this.graph.neighbors(start.id)[0];
      if (next) this.look.lookAt(next.position, { immediate: true });
      this._buildMarkers();

      this.loaderEl.classList.add('is-hidden');
      this._hint('Chạm chấm sáng để di chuyển · Kéo để nhìn xung quanh · Chạm quả cầu phát sáng để xem kỉ niệm', 6000);
    } catch (err) {
      console.error(err);
      this.loaderText.textContent = 'Không tải được sân trường. Vui lòng thử lại sau.';
    }
  }

  _progress(p) {
    this.loaderBar.style.transform = `scaleX(${p})`;
    this.loaderText.textContent = `Đang tải sân trường… ${Math.round(p * 100)}%`;
  }

  _createSpheres() {
    for (const def of this.config.spheres) {
      // GLTFLoader bỏ dấu chấm trong tên node (Mball.001 -> Mball001)
      const node =
        this.model.getObjectByName(def.node) ??
        this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(def.node));
      if (!node) {
        console.warn(`[School] Không tìm thấy điểm quả cầu "${def.node}"`);
        continue;
      }
      const hs = new SphereHotspot({
        id: def.node,
        position: node.getWorldPosition(new THREE.Vector3()),
        radius: this.config.sphereRadius,
        color: def.color,
      });
      hs.def = def;
      this.hotspots.push(hs);
      this.scene.add(hs.group);
    }
  }

  // ---------- Di chuyển theo waypoint ----------

  _floorBelow(node) {
    if (this._floorCache.has(node.id)) return this._floorCache.get(node.id);
    this.raycaster.set(node.position, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 1;
    const hit = this.raycaster.intersectObject(this.model, true)[0];
    this.raycaster.far = Infinity;
    const y = hit ? hit.point.y + 0.003 : node.position.y - 0.14;
    const floor = new THREE.Vector3(node.position.x, y, node.position.z);
    this._floorCache.set(node.id, floor);
    return floor;
  }

  _buildMarkers() {
    for (const m of this.markers) {
      this.scene.remove(m.group);
      m.dispose();
    }
    this.markers = this.graph.neighbors(this.current).map((n) => {
      const here = this.graph.get(this.current).position;
      const dir = new THREE.Vector3().subVectors(n.position, here).setY(0).normalize();
      const marker = new WaypointMarker({ id: n.id, floor: this._floorBelow(n), direction: dir, size: this.config.markerSize });
      this.scene.add(marker.group);
      return marker;
    });
  }

  _moveTo(id) {
    const node = this.graph.get(id);
    if (!node || this._move) return;
    const from = this.camera.position.clone();
    const dist = from.distanceTo(node.position);
    this._move = { from, to: node.position.clone(), t: 0, duration: THREE.MathUtils.clamp(dist * 1.3, 0.6, 1.8), id };
    this.look.lookAt(new THREE.Vector3(node.position.x, this.camera.position.y, node.position.z));
    this.look.targetPitch = 0;
    for (const m of this.markers) m.group.visible = false;
  }

  // ---------- Quả cầu ----------

  _openSphere(hs) {
    if (this.mode !== 'school' || this._move) return;
    this.mode = 'sphere';
    this.look.enabled = false;
    this._savedPose = { position: this.camera.position.clone(), yaw: this.look.targetYaw, pitch: this.look.targetPitch, fov: this.look.targetFov };
    const center = hs.group.position.clone();
    const away = this.camera.position.clone().sub(center).normalize();
    const to = center.clone().addScaledVector(away, this.config.sphereFocusDistance);
    this._move = { from: this.camera.position.clone(), to, t: 0, duration: 1.2, then: () => this._afterSphereFocus(hs) };
    this.look.lookAt(center);
    this.look.setFov(this.config.cameraFov);
    for (const m of this.markers) m.group.visible = false;
    this._hint('');
  }

  _afterSphereFocus(hs) {
    const data = SPHERE_DATA[hs.def.data] ?? {};
    if (hs.def.type === 'memorial') return this._enterMemorial();
    this.gallery.open({ title: data.title || '', photos: data.photos || [] });
  }

  _closeSphere() {
    const pose = this._savedPose;
    this.look.targetYaw = pose.yaw;
    this.look.targetPitch = pose.pitch;
    this.look.setFov(pose.fov);
    this._move = {
      from: this.camera.position.clone(),
      to: pose.position,
      t: 0,
      duration: 1,
      then: () => {
        this.mode = 'school';
        this.look.enabled = true;
        for (const m of this.markers) m.group.visible = true;
      },
    };
  }

  async _enterMemorial() {
    await this._fade(true);
    this.loaderEl.classList.remove('is-hidden');
    this.loaderText.textContent = 'Đang tải khu vực tưởng nhớ…';
    this.loaderBar.style.transform = 'scaleX(0)';
    try {
      await this.memorial.load((p) => this._progress(p));
      if (this.mobile) limitTextureSize(this.memorial.scene, this.config.mobileMaxTextureSize);
    } catch (err) {
      console.error(err);
      this.loaderText.textContent = 'Không tải được khu vực tưởng nhớ.';
      setTimeout(() => this._leaveMemorial(), 1500);
      return;
    }
    this.loaderEl.classList.add('is-hidden');
    this.mode = 'memorial';
    this.memorial.enter();
    this.backBtn.hidden = false;
    this.offerBtn.hidden = false;
    this.offerBtn.disabled = this.memorial.flowerOffered;
    await this._fade(false);
  }

  async _leaveMemorial() {
    await this._fade(true);
    this.memorial.leave();
    this.backBtn.hidden = true;
    this.offerBtn.hidden = true;
    this.loaderEl.classList.add('is-hidden');
    // Về lại đúng chỗ đứng trước khi vào quả cầu
    const pose = this._savedPose;
    this.camera.position.copy(pose.position);
    this.look.targetYaw = this.look.yaw = pose.yaw;
    this.look.targetPitch = this.look.pitch = pose.pitch;
    this.look.setFov(pose.fov);
    this.mode = 'school';
    this.look.enabled = true;
    for (const m of this.markers) m.group.visible = true;
    await this._fade(false);
  }

  async _offerFlower(memData) {
    if (this.memorial.flowerOffered) return;
    this.offerBtn.disabled = true;
    const label = this.offerBtn.textContent;
    this.offerBtn.textContent = '…';
    try {
      await this.memorial.offerFlower();
      this.offerBtn.textContent = memData.offeredButton || 'Đã dâng hoa';
    } catch (err) {
      console.error(err);
      this.offerBtn.textContent = label;
      this.offerBtn.disabled = false;
    }
  }

  // ---------- Thao tác ----------

  _bindInput() {
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.isPrimary) down = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || !e.isPrimary) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved <= TAP_MOVE && this.mode === 'school' && this.model) this._onTap(e);
    });
  }

  _onTap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets = [...this.hotspots.map((h) => h.hit), ...this.markers.filter((m) => m.group.visible).map((m) => m.hit)];
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return;
    if (hit.object.userData.hotspot) this._openSphere(hit.object.userData.hotspot);
    else if (hit.object.userData.waypoint) this._moveTo(hit.object.userData.waypoint);
  }

  // ---------- Hiệu ứng ----------

  _hint(text, autoHide = 0) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('is-visible', !!text);
    clearTimeout(this._hintTimer);
    if (text && autoHide) this._hintTimer = setTimeout(() => this.hintEl.classList.remove('is-visible'), autoHide);
  }

  _fade(toOpaque) {
    this.fadeEl.classList.toggle('is-on', toOpaque);
    return new Promise((r) => setTimeout(r, 450));
  }

  _frame(dt) {
    this._time += dt;
    if (this.mode === 'memorial') {
      this.memorial.update(dt);
      this.renderer.webgl.render(this.memorial.scene, this.memorial.camera);
      return;
    }
    if (!this.model) return;

    const mv = this._move;
    if (mv) {
      mv.t = Math.min(1, mv.t + dt / mv.duration);
      this.camera.position.lerpVectors(mv.from, mv.to, ease(mv.t));
      if (mv.t >= 1) {
        this._move = null;
        if (mv.id) {
          this.current = mv.id;
          this._buildMarkers();
        }
        mv.then?.();
      }
    }
    this.look.update(dt);
    for (const h of this.hotspots) h.update(this._time);
    for (const m of this.markers) m.update(this._time);
    this.renderer.webgl.render(this.scene, this.camera);
  }
}
