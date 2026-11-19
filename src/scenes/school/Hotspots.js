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
 * Chấm điều hướng trên mặt đất tại các waypoint kề bên, chớp nháy chậm, kèm mũi tên chỉ hướng đi.
 */
export class WaypointMarker {
  constructor({ id, floor, direction, size }) {
    this.id = id;
    this.group = new THREE.Group();
    this.group.position.copy(floor);

    const mat = (opacity) =>
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.75, size, 40), mat(0.9));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(size * 0.38, 32), mat(0.95));
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, size * 1.75);
    arrowShape.lineTo(size * 0.45, size * 1.25);
    arrowShape.lineTo(-size * 0.45, size * 1.25);
    arrowShape.closePath();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), mat(0.9));

    const flat = new THREE.Group();
    flat.rotation.x = -Math.PI / 2;
    flat.add(ring, dot, arrow);
    // Mũi tên chỉ theo hướng đi tới waypoint này
    flat.rotation.z = Math.atan2(-direction.x, -direction.z);
    this.group.add(flat);
    this.materials = [ring.material, dot.material, arrow.material];
    this.baseOpacity = this.materials.map((m) => m.opacity);

    this.hit = new THREE.Mesh(new THREE.CircleGeometry(size * 2.2, 16), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.rotation.x = -Math.PI / 2;
    this.hit.userData.waypoint = id;
    this.group.add(this.hit);
    this.phase = Math.random() * Math.PI * 2;
  }

  update(t) {
    const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2 + this.phase)); // chớp nháy chậm
    this.materials.forEach((m, i) => (m.opacity = this.baseOpacity[i] * k));
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
}
