import * as THREE from 'three';

import waypointsJson from '../../../data/waypoints.json';
import { Renderer } from '../../core/Renderer.js';
import { loadGLTF, releaseImagesAfterUpload } from '../../core/AssetLoader.js';
import { loadHDRI, isMobileDevice, limitTextureSize, freezeStatic } from '../../core/Environment.js';
import { LookControls } from '../../camera/LookControls.js';
import { createHomeButton, setHomeAttention } from '../../ui/HomeButton.js';
import { HintBar } from '../../ui/HintBar.js';
import { showGuideScreen } from '../../ui/GuideScreen.js';
import { ICONS } from '../../ui/icons.js';
import { t } from '../../ui/guide.js';
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
const WALK_SPEED = 0.55; // đơn vị model / giây khi đi giữa các waypoint
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t) => 1 - Math.cos((t * Math.PI) / 2);
const easeOut = (t) => Math.sin((t * Math.PI) / 2);
const linear = (t) => t;

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
      <div class="school__progress" hidden>${ICONS.sphere}<span class="school__progress-text"></span></div>
      <button type="button" class="school__offer" hidden></button>`;
    this.canvas = this.el.querySelector('.school__canvas');
    this.hintEl = this.el.querySelector('.school__hint');
    this.fadeEl = this.el.querySelector('.school__fade');
    this.loaderEl = this.el.querySelector('.school__loader');
    this.loaderText = this.el.querySelector('.school__loader-text');
    this.loaderBar = this.el.querySelector('.school__bar span');
    this.offerBtn = this.el.querySelector('.school__offer');
    this.progressEl = this.el.querySelector('.school__progress');
    this.visited = new Set();
    // Gợi ý nền ở đáy màn hình (sân trường) và trong phòng tưởng nhớ
    this.schoolHint = new HintBar([{ icon: 'tap', text: t('school.hint') }], { className: 'school__hintbar' });
    this.roomHint = new HintBar(
      [
        { icon: 'rotate', text: t('school.memorialHint') },
        { icon: 'tap', text: t('school.offerHint') },
      ],
      { className: 'school__hintbar school__hintbar--room' },
    );
    this.schoolHint.show(false);
    this.roomHint.show(false);
    this.el.append(this.schoolHint.el, this.roomHint.el);

    this.homeBtn = createHomeButton(onHome);
    this.backBtn = createHomeButton(() => this._leaveMemorial());
    this.backBtn.classList.add('home-btn--second', 'home-btn--labeled');
    this.backBtn.innerHTML = `${BACK_ICON}<span>${t('school.backButton')}</span>`;
    this.backBtn.hidden = true;
    this.gallery = new Gallery({
      onClose: () => this._closeSphere(),
      hints: { grid: t('school.galleryHint'), photo: t('school.photoHint') },
    });
    this.el.append(this.gallery.el, this.homeBtn, this.backBtn);

    // Điện thoại: màn hình mật độ cao nên tắt khử răng cưa (không thấy khác biệt, đỡ nặng GPU)
    const dense = this.mobile && Math.min(window.devicePixelRatio || 1, config.mobileMaxPixelRatio) >= 1.5;
    this.renderer = new Renderer(this.canvas, {
      maxPixelRatio: this.mobile ? config.mobileMaxPixelRatio : 2,
      motionPixelRatio: this.mobile ? config.mobileMotionPixelRatio : null,
      antialias: !dense,
    });
    this._lastView = new THREE.Matrix4();
    this.renderer.webgl.toneMappingExposure = config.exposure;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(config.cameraFov, 1, 0.015, 60);
    this.look = new LookControls(this.camera, this.canvas, { fovMax: config.cameraFov + 10 });
    this.raycaster = new THREE.Raycaster();
    this.graph = new WaypointGraph(waypointsJson);
    this.hotspots = [];
    this.markers = [];
    this._floorCache = new Map();
    this.memorial = new MemorialRoom({ canvas: this.canvas, config: config.memorial, mobile: this.mobile });
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
    // Điện thoại hết bộ nhớ đồ hoạ (thường gặp trên iPhone đời cũ): báo rõ thay vì đứng hình
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.el.querySelector('.guide')?.remove();
      this.loaderEl.classList.remove('is-hidden');
      this.loaderBar.parentElement.hidden = true;
      this.loaderText.textContent = t('school.gpuLost');
    });
  }

  enter() {
    this._ready ??= this._load();
    // Màn hướng dẫn mỗi lần vào. Nếu sân trường chưa tải xong, màn này chính là màn chờ tải
    // (hiện tiến độ ở dưới, tải xong mới chạm để đóng được).
    if (this.mode === 'school') this._showGuide(this.model ? null : this._ready.then(() => !!this.model));
    this.renderer.start();
  }

  leave() {
    this.renderer.stop();
    // Đang đi giữa chừng: dừng tại waypoint gần nhất
    if (this._walkQueue || (this._move && this.mode === 'school')) {
      this._walkQueue = null;
      this._move = null;
      if (this.model) {
        this.current = this.graph.nearest(this.camera.position).id;
        this.camera.position.copy(this.graph.get(this.current).position);
        this._buildMarkers();
      }
    }
    // Lần sau quay lại: đứng ở sân trường, không mở sẵn thư viện/phòng tưởng nhớ
    if (this.gallery.isOpen) this.gallery.el.hidden = true;
    if (this.mode !== 'school' && this._savedPose) {
      this.memorial.leave();
      this.backBtn.hidden = this.offerBtn.hidden = true;
      this.roomHint.show(false);
      this.schoolHint.show(true);
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
        loadGLTF(this.mobile ? cfg.model.mobile : cfg.model.desktop, (p) => this._progress(p)),
      ]);
      this.env = env;
      this.scene.environment = env.envMap;
      this.scene.background = env.background;
      this.memorial.setEnvironment(env);

      this.model = gltf.scene;
      if (this.mobile) {
        const n = limitTextureSize(this.model, cfg.mobileMaxTextureSize);
        releaseImagesAfterUpload(this.model);
        if (n) console.info(`[School] Đã thu nhỏ ${n} texture cho điện thoại`);
      }
      this.scene.add(this.model);
      freezeStatic(this.model);
      this._createSpheres();

      const start = this.graph.get(cfg.startWaypoint) ?? this.graph.get(this.graph.first);
      this.current = start.id;
      this.camera.position.copy(start.position);
      const next = this.graph.neighbors(start.id)[0];
      if (next) this.look.lookAt(next.position, { immediate: true });
      this._buildMarkers();

      this.loaderEl.classList.add('is-hidden');
      this._updateProgress();
    } catch (err) {
      console.error(err);
      this.loaderText.textContent = 'Không tải được sân trường. Vui lòng thử lại sau.';
    }
  }

  _progress(p) {
    p = Math.max(0, Math.min(1, p));
    this._guide?.setProgress(p);
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

  /** Chấm ở mọi waypoint (trừ chỗ đang đứng); waypoint kề bên được làm nổi bật kèm mũi tên. */
  _buildMarkers() {
    for (const m of this.markers) {
      this.scene.remove(m.group);
      m.dispose();
    }
    const here = this.graph.get(this.current).position;
    const near = new Set(this.graph.neighbors(this.current).map((n) => n.id));
    this.markers = [...this.graph.nodes.values()]
      .filter((n) => n.id !== this.current)
      .map((n) => {
        const dir = new THREE.Vector3().subVectors(n.position, here).setY(0).normalize();
        const marker = new WaypointMarker({
          id: n.id,
          floor: this._floorBelow(n),
          direction: dir,
          size: this.config.markerSize,
          primary: near.has(n.id),
        });
        this.scene.add(marker.group);
        return marker;
      });
  }

  _showMarkers(visible) {
    for (const m of this.markers) m.group.visible = visible;
  }

  /** Đi tới waypoint `id`, lần lượt qua các waypoint ở giữa để ngắm trường. */
  _moveTo(id, then) {
    if (this._move) return;
    const path = this.graph.path(this.current, id);
    if (!path) return;
    this._walk(path.slice(1), then);
  }

  _walk(steps, then) {
    this.schoolHint.fade();
    if (!steps.length) return then?.();
    this._showMarkers(false);
    this._walkQueue = { steps: steps.slice(), index: 0, then };
    this._nextStep();
  }

  _nextStep() {
    const q = this._walkQueue;
    const id = q.steps[q.index];
    const node = this.graph.get(id);
    const from = this.camera.position.clone();
    const single = q.steps.length === 1;
    const first = q.index === 0;
    const last = q.index === q.steps.length - 1;
    const fn = single ? ease : first ? easeIn : last ? easeOut : linear;
    const duration = Math.max(0.35, from.distanceTo(node.position) / WALK_SPEED) * (single ? 1.3 : first || last ? 1.4 : 1);
    this._move = { from, to: node.position.clone(), t: 0, duration, ease: fn, id };
    // Nhìn theo hướng đi
    this.look.lookAt(new THREE.Vector3(node.position.x, this.camera.position.y, node.position.z));
    this.look.targetPitch = 0;
  }

  _arrive(id) {
    this.current = id;
    const q = this._walkQueue;
    if (q && q.index < q.steps.length - 1) {
      q.index++;
      this._nextStep();
      return;
    }
    this._walkQueue = null;
    this._buildMarkers();
    q?.then?.();
  }

  // ---------- Quả cầu ----------

  /** Chạm quả cầu: đi theo waypoint tới chỗ gần quả cầu nhất rồi mới focus. */
  _openSphere(hs) {
    if (this.mode !== 'school' || this._move) return;
    const target = this.graph.nearest(hs.group.position);
    const path = target && this.graph.path(this.current, target.id);
    if (path && path.length > 1) {
      this._hint('');
      this._walk(path.slice(1), () => this._focusSphere(hs));
    } else {
      this._focusSphere(hs);
    }
  }

  _focusSphere(hs) {
    this.mode = 'sphere';
    this.look.enabled = false;
    this._savedPose = { position: this.camera.position.clone(), yaw: this.look.targetYaw, pitch: this.look.targetPitch, fov: this.look.targetFov };
    const center = hs.group.position.clone();
    const away = this.camera.position.clone().sub(center).normalize();
    const to = center.clone().addScaledVector(away, this.config.sphereFocusDistance);
    this._move = { from: this.camera.position.clone(), to, t: 0, duration: 1.2, then: () => this._afterSphereFocus(hs) };
    this.look.lookAt(center);
    this.look.setFov(this.config.cameraFov);
    this._showMarkers(false);
    this._hint('');
  }

  async _showGuide(waitFor = null) {
    this.el.querySelector('.guide')?.remove();
    this.schoolHint.show(false);
    this._guide = showGuideScreen(this.el, {
      title: t('school.title'),
      dismiss: t('dismiss'),
      waitFor,
      loadingText: t('school.loading'),
      errorText: t('school.loadError'),
      cards: [
        { icon: 'waypoint', title: t('school.waypoint.title'), text: t('school.waypoint') },
        { icon: 'sphere', title: t('school.sphere.title'), text: t('school.sphere') },
        { icon: 'rotate', title: t('school.look.title'), text: t('school.look') },
      ],
    });
    const ok = await this._guide.closed;
    this._guide = null;
    if (ok && this.mode === 'school') this.schoolHint.set([{ icon: 'tap', text: t('school.hint') }]);
  }

  /** Ô đếm quả cầu đã xem; đủ hết thì nút Home báo hiệu. */
  _updateProgress() {
    const total = this.hotspots.length;
    this.progressEl.querySelector('.school__progress-text').textContent = `${t('school.progress')}: ${this.visited.size}/${total}`;
    this.progressEl.hidden = this.mode === 'memorial' || !total;
    this.progressEl.classList.toggle('is-done', total > 0 && this.visited.size >= total);
    setHomeAttention(this.homeBtn, total > 0 && this.visited.size >= total ? t('school.done') : '');
  }

  _afterSphereFocus(hs) {
    this.visited.add(hs.id);
    hs.visited = true;
    this.schoolHint.fade();
    this._updateProgress();
    const data = SPHERE_DATA[hs.def.data] ?? {};
    if (hs.def.type === 'memorial') return this._enterMemorial();
    this.gallery.open({ title: data.title || '', photos: data.photos || [] });
  }

  /**
   * Sau khi xem quả cầu: quay mặt về phía waypoint bên cạnh (quả cầu đặt rất sát waypoint,
   * nếu vẫn nhìn vào nó thì cả màn hình chỉ thấy quầng sáng).
   */
  _faceNeighbor(from) {
    const next = this.graph.neighbors(this.current)[0];
    if (!next) return false;
    const saved = this.camera.position.clone();
    this.camera.position.copy(from);
    this.look.lookAt(new THREE.Vector3(next.position.x, from.y, next.position.z));
    this.look.targetPitch = 0;
    this.camera.position.copy(saved);
    return true;
  }

  _closeSphere() {
    const pose = this._savedPose;
    if (!this._faceNeighbor(pose.position)) {
      this.look.targetYaw = pose.yaw;
      this.look.targetPitch = pose.pitch;
    }
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
      if (this.mobile) {
        limitTextureSize(this.memorial.scene, this.config.mobileMaxTextureSize);
        releaseImagesAfterUpload(this.memorial.scene);
      }
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
    this.offerBtn.classList.toggle('is-pulsing', !this.memorial.flowerOffered);
    this.schoolHint.show(false);
    this.roomHint.show(true);
    this._updateProgress();
    // Người dùng đã thử xoay trong phòng -> gợi ý mờ đi
    this.canvas.addEventListener('pointerdown', () => this.mode === 'memorial' && this.roomHint.fade(), { once: true });
    this.offerBtn.disabled = this.memorial.flowerOffered;
    await this._fade(false);
  }

  async _leaveMemorial() {
    await this._fade(true);
    this.memorial.leave();
    this.backBtn.hidden = true;
    this.offerBtn.hidden = true;
    this.roomHint.show(false);
    this.schoolHint.show(true);
    this.loaderEl.classList.add('is-hidden');
    // Về lại đúng chỗ đứng trước khi vào quả cầu
    const pose = this._savedPose;
    this.camera.position.copy(pose.position);
    this.look.targetYaw = this.look.yaw = pose.yaw;
    this.look.targetPitch = this.look.pitch = pose.pitch;
    if (this._faceNeighbor(pose.position)) {
      this.look.yaw = this.look.targetYaw;
      this.look.pitch = this.look.targetPitch;
    }
    this.look.setFov(pose.fov);
    this.mode = 'school';
    this._updateProgress();
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
      this.offerBtn.classList.remove('is-pulsing');
      this.roomHint.set([{ icon: 'rotate', text: t('school.memorialHint') }]);
      this.roomHint.fade();
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

  /** Camera có đổi vị trí/hướng/góc nhìn so với khung hình trước không. */
  _cameraMoved(camera) {
    camera.updateMatrixWorld();
    const m = camera.matrixWorld;
    let diff = Math.abs(camera.fov - (this._lastFov ?? camera.fov));
    for (let i = 0; i < 16; i++) diff += Math.abs(m.elements[i] - this._lastView.elements[i]);
    this._lastView.copy(m);
    this._lastFov = camera.fov;
    return diff > 1e-5;
  }

  _frame(dt) {
    this._time += dt;
    if (this.mode === 'memorial') {
      // Chỉ vẽ lại khi camera thay đổi (đang xoay/trôi do độ trễ) hoặc cảnh vừa đổi
      const changed = this.memorial.update(dt);
      const pr = this.renderer.webgl.getPixelRatio();
      this.renderer.setMotion(this._cameraMoved(this.memorial.camera), dt);
      if (changed || pr !== this.renderer.webgl.getPixelRatio())
        this.renderer.webgl.render(this.memorial.scene, this.memorial.camera);
      return;
    }
    if (!this.model) return;

    const mv = this._move;
    if (mv) {
      mv.t = Math.min(1, mv.t + dt / mv.duration);
      this.camera.position.lerpVectors(mv.from, mv.to, (mv.ease ?? ease)(mv.t));
      if (mv.t >= 1) {
        this._move = null;
        if (mv.id) this._arrive(mv.id);
        mv.then?.();
      }
    }
    this.look.update(dt);
    this.renderer.setMotion(this._cameraMoved(this.camera), dt);
    for (const h of this.hotspots) h.update(this._time, this.camera.position);
    for (const m of this.markers) m.update(this._time, this.camera.position);
    this.renderer.webgl.render(this.scene, this.camera);
  }
}
