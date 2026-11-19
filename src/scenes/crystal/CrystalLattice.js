import * as THREE from 'three';
import { loadTexture } from '../../core/AssetLoader.js';

const SPACING = 1;
const CARD_SIZE = 0.62; // cạnh dài của khung ảnh (đơn vị world)
const FRAME = 0.03; // viền trắng quanh ảnh
const ATOM_RADIUS = 0.055;
const ATOM_COLOR = 0x8e6cc9;
const BOND_COLOR = 0x9a86c2;

/**
 * Mạng tinh thể sinh bằng code, theo dạng bát diện (giống khối phèn):
 * các nút nằm trên lưới lập phương thoả |x|+|y|+|z| <= R, nối với các nút kề cạnh.
 * Mỗi ảnh chiếm một nút (khung ảnh luôn quay về camera); nút còn lại là nguyên tử nhỏ.
 * R tự tăng khi số ảnh nhiều hơn số nút.
 */
export class CrystalLattice {
  constructor(photos) {
    this.photos = photos;
    this.group = new THREE.Group();
    this.cards = [];
    this._materials = [];

    const sites = buildSites(photos.length);
    this.radius = sites.radius * SPACING + CARD_SIZE / 2;
    const photoSites = pickSpreadSites(sites.points, photos.length);

    // Liên kết giữa các nút kề nhau
    const bondPositions = [];
    for (let i = 0; i < sites.points.length; i++) {
      for (let j = i + 1; j < sites.points.length; j++) {
        if (sites.points[i].distanceToSquared(sites.points[j]) === 1) {
          bondPositions.push(...sites.points[i].toArray(), ...sites.points[j].toArray());
        }
      }
    }
    const bondGeo = new THREE.BufferGeometry();
    bondGeo.setAttribute('position', new THREE.Float32BufferAttribute(bondPositions.map((v) => v * SPACING), 3));
    const bondMat = this._track(new THREE.LineBasicMaterial({ color: BOND_COLOR, transparent: true, opacity: 0.45 }));
    this.group.add(new THREE.LineSegments(bondGeo, bondMat));

    // Nguyên tử trang trí ở các nút không có ảnh
    const atomSites = sites.points.filter((_, i) => !photoSites.includes(i));
    const atomMat = this._track(
      new THREE.MeshStandardMaterial({
        color: ATOM_COLOR,
        emissive: ATOM_COLOR,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
      }),
    );
    const atoms = new THREE.InstancedMesh(new THREE.SphereGeometry(ATOM_RADIUS, 16, 12), atomMat, atomSites.length);
    const m = new THREE.Matrix4();
    atomSites.forEach((p, i) => atoms.setMatrixAt(i, m.makeTranslation(p.x * SPACING, p.y * SPACING, p.z * SPACING)));
    this.group.add(atoms);

    // Khung ảnh
    photoSites.forEach((siteIndex, i) => {
      const card = new THREE.Group();
      card.position.copy(sites.points[siteIndex]).multiplyScalar(SPACING);
      // toneMapped: false để ảnh giữ đúng màu gốc
      const frameMat = this._track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false }));
      const photoMat = this._track(new THREE.MeshBasicMaterial({ color: 0xece8f4, transparent: true, toneMapped: false }));
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), frameMat);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), photoMat);
      photo.position.z = 0.002;
      frame.userData.cardIndex = photo.userData.cardIndex = i;
      card.add(frame, photo);
      this.group.add(card);
      const entry = { index: i, group: card, frame, photo, photoMat, data: photos[i], size: CARD_SIZE, phase: i * 1.7 };
      this._layoutCard(entry, 4 / 3);
      this.cards.push(entry);
    });
  }

  /** Tải ảnh vào các khung (ảnh thu nhỏ tối đa 1024px để nhẹ bộ nhớ). */
  async loadPhotos() {
    await Promise.all(
      this.cards.map(async (card) => {
        try {
          const { texture, aspect } = await loadTexture(card.data.src, 1024);
          card.photoMat.map = texture;
          card.photoMat.color.set(0xffffff);
          card.photoMat.needsUpdate = true;
          this._layoutCard(card, aspect);
        } catch (err) {
          console.warn(err);
        }
      }),
    );
  }

  /** Kích thước thật (rộng, cao) của khung ảnh — dùng để tính khoảng cách camera khi focus. */
  cardExtent(card) {
    return { width: card.frame.scale.x, height: card.frame.scale.y };
  }

  setOpacity(alpha) {
    for (const mat of this._materials) {
      mat.opacity = alpha * (mat.userData.baseOpacity ?? 1);
      mat.visible = alpha > 0.001;
    }
  }

  /** Khung ảnh luôn quay về camera, trôi nhẹ để mạng tinh thể "sống". */
  update(camera, time) {
    for (const c of this.cards) {
      c.group.quaternion.copy(camera.quaternion);
      c.photo.position.y = c.frame.position.y = Math.sin(time * 0.8 + c.phase) * 0.012;
    }
  }

  pickables() {
    return this.cards.flatMap((c) => [c.frame, c.photo]);
  }

  _layoutCard(card, aspect) {
    const w = aspect >= 1 ? CARD_SIZE : CARD_SIZE * aspect;
    const h = aspect >= 1 ? CARD_SIZE / aspect : CARD_SIZE;
    card.photo.scale.set(w, h, 1);
    card.frame.scale.set(w + FRAME * 2, h + FRAME * 2, 1);
  }

  _track(mat) {
    mat.userData.baseOpacity = mat.opacity;
    this._materials.push(mat);
    return mat;
  }
}

function buildSites(count) {
  let radius = 2;
  for (;;) {
    const points = [];
    for (let x = -radius; x <= radius; x++)
      for (let y = -radius; y <= radius; y++)
        for (let z = -radius; z <= radius; z++)
          if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= radius) points.push(new THREE.Vector3(x, y, z));
    if (points.length >= count) return { radius, points };
    radius++;
  }
}

/** Chọn các nút cách xa nhau nhất (lấy mẫu điểm xa nhất) để ảnh trải đều trong mạng. */
function pickSpreadSites(points, count) {
  if (!count) return [];
  const chosen = [points.findIndex((p) => p.lengthSq() === 0)];
  const minDist = points.map((p) => p.distanceToSquared(points[chosen[0]]));
  while (chosen.length < count) {
    let best = -1;
    for (let i = 0; i < points.length; i++) if (!chosen.includes(i) && (best < 0 || minDist[i] > minDist[best])) best = i;
    chosen.push(best);
    for (let i = 0; i < points.length; i++) minDist[i] = Math.min(minDist[i], points[i].distanceToSquared(points[best]));
  }
  return chosen;
}
