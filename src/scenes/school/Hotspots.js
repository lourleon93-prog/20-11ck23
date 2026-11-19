import * as THREE from 'three';

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/**
 * Quả cầu tương tác: lõi phát sáng + quầng sáng, trôi lên xuống và "thở" nhẹ để thu hút chú ý.
 * Vị trí lấy từ node rỗng Mball* trong model trường (Blender metaball không xuất ra glTF).
 */
export class SphereHotspot {
  constructor({ id, position, radius, color }) {
    this.id = id;
    this.base = position.clone();
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 24),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.2,
        roughness: 0.15,
        metalness: 0,
        transparent: true,
        opacity: 0.92,
      }),
    );
    this.core.userData.hotspot = this;

    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.glow.scale.setScalar(radius * 6);
    this.glow.userData.hotspot = this;

    // Vùng chạm lớn hơn quả cầu để dễ bấm trên điện thoại
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.2, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.userData.hotspot = this;

    this.group.add(this.glow, this.core, this.hit);
    this.phase = Math.random() * Math.PI * 2;
  }

  update(t) {
    const s = Math.sin(t * 1.6 + this.phase);
    this.group.position.y = this.base.y + s * this.radius * 0.35;
    this.glow.material.opacity = 0.55 + 0.35 * (0.5 + 0.5 * s);
    this.glow.scale.setScalar(this.radius * (5.5 + s * 0.8));
    this.core.material.emissiveIntensity = 1 + 0.5 * (0.5 + 0.5 * s);
  }
}

/**
 * Điểm điều hướng tại mỗi waypoint, chớp nháy chậm:
 * - Chấm sáng luôn quay về camera, lơ lửng sát mặt sân, kích thước theo khoảng cách để luôn thấy rõ
 *   (vòng tròn nằm phẳng trên sân bị ép dẹt khi nhìn xa vì tầm mắt rất thấp).
 * - Waypoint kề bên (primary): thêm vòng tròn + mũi tên chỉ hướng đi nằm trên mặt sân.
 */
export class WaypointMarker {
  constructor({ id, floor, direction, size, primary = true }) {
    this.id = id;
    this.size = size;
    this.primary = primary;
    this.group = new THREE.Group();
    this.group.position.copy(floor);

    // polygonOffset: vòng tròn nằm sát mặt sân nên đẩy nhẹ về phía camera để không bị mặt sân che
    const mat = (opacity) =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -8,
      });
    this.materials = [];
    if (primary) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.75, size, 40), mat(0.9));
      const arrowShape = new THREE.Shape();
      arrowShape.moveTo(0, size * 1.75);
      arrowShape.lineTo(size * 0.45, size * 1.25);
      arrowShape.lineTo(-size * 0.45, size * 1.25);
      arrowShape.closePath();
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), mat(0.9));
      const flat = new THREE.Group();
      flat.rotation.x = -Math.PI / 2;
      // Mũi tên chỉ theo hướng đi tới waypoint này
      flat.rotation.z = Math.atan2(-direction.x, -direction.z);
      flat.add(ring, arrow);
      this.group.add(flat);
      this.materials.push(ring.material, arrow.material);
    }

    // Chấm sáng quay về camera
    this.pin = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: primary ? 1 : 0.9,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.group.add(this.pin);
    this.materials.push(this.pin.material);
    this.baseOpacity = this.materials.map((m) => m.opacity);

    // Vùng chạm: khối cầu quanh chấm sáng (to theo khoảng cách)
    this.hit = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.userData.waypoint = id;
    this.group.add(this.hit);
    this.phase = Math.random() * Math.PI * 2;
  }

  /** camPos: vị trí camera — kích thước chấm và vùng chạm giữ gần như cố định trên màn hình. */
  update(t, camPos) {
    if (camPos) {
      const d = this.group.position.distanceTo(camPos);
      const s = Math.max(this.size * 1.1, d * (this.primary ? 0.045 : 0.032));
      this.pin.scale.setScalar(s);
      this.pin.position.y = s * 0.35; // lơ lửng ngay trên mặt sân
      this.hit.scale.setScalar(Math.max(this.size * 2, d * 0.06));
    }
    const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + this.phase)); // chớp nháy chậm
    this.materials.forEach((m, i) => (m.opacity = this.baseOpacity[i] * k));
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && o.material.map !== glowTexture) o.material.dispose?.();
    });
  }
}
