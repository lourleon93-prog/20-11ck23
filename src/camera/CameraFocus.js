import * as THREE from 'three';

/**
 * Phân tích hình học của một vật thể phẳng (biển hiệu, khung ảnh…) trong world space
 * bằng PCA trên các đỉnh: trục có phương sai nhỏ nhất chính là pháp tuyến mặt phẳng.
 * Cách này không phụ thuộc việc model đã "apply transform" trong Blender hay chưa,
 * nên không cần giả định trước hướng/tỉ lệ của model.
 *
 * @returns {{center: THREE.Vector3, normal: THREE.Vector3, axisU: THREE.Vector3,
 *            axisV: THREE.Vector3, sizeU: number, sizeV: number}}
 */
export function analyzePlanarObject(object) {
  object.updateWorldMatrix(true, true);
  const points = [];
  const v = new THREE.Vector3();
  object.traverse((child) => {
    if (!child.isMesh) return;
    const pos = child.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      points.push(v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld).clone());
    }
  });
  if (points.length < 3) throw new Error(`"${object.name}" không có đủ đỉnh để phân tích`);

  const mean = new THREE.Vector3();
  for (const p of points) mean.add(p);
  mean.divideScalar(points.length);

  // Ma trận hiệp phương sai đối xứng 3x3
  const c = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = [p.x - mean.x, p.y - mean.y, p.z - mean.z];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r][k] += d[r] * d[k];
  }

  const { values, vectors } = jacobiEigen(c);
  const order = [0, 1, 2].sort((a, b) => values[b] - values[a]); // lớn -> nhỏ
  const axis = order.map((i) => new THREE.Vector3(vectors[0][i], vectors[1][i], vectors[2][i]).normalize());
  const [axisU, axisV, normal] = axis;

  // Kích thước thật theo hai trục trong mặt phẳng + tâm hình học (không phải trọng tâm đỉnh)
  const range = (ax) => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
      const t = v.subVectors(p, mean).dot(ax);
      if (t < min) min = t;
      if (t > max) max = t;
    }
    return { min, max };
  };
  const ru = range(axisU);
  const rv = range(axisV);
  const rn = range(normal);
  const center = mean
    .clone()
    .addScaledVector(axisU, (ru.min + ru.max) / 2)
    .addScaledVector(axisV, (rv.min + rv.max) / 2)
    .addScaledVector(normal, (rn.min + rn.max) / 2);

  return { center, normal, axisU, axisV, sizeU: ru.max - ru.min, sizeV: rv.max - rv.min };
}

/**
 * Tính vị trí camera nhìn vuông góc vào mặt phẳng, sao cho vật thể vừa khung hình.
 * Chọn mặt của biển hướng về phía camera hiện tại.
 */
export function computeFocusPose(camera, plane, { fill = 0.7 } = {}) {
  const normal = plane.normal.clone();
  if (normal.dot(new THREE.Vector3().subVectors(camera.position, plane.center)) < 0) normal.negate();

  // Kích thước biển chiếu lên khung hình: chiều ngang ~ thành phần nằm ngang của các trục.
  const up = new THREE.Vector3(0, 1, 0);
  const horiz = (ax, size) => size * Math.sqrt(Math.max(0, 1 - ax.dot(up) ** 2));
  const vert = (ax, size) => size * Math.abs(ax.dot(up));
  const w = Math.max(horiz(plane.axisU, plane.sizeU), horiz(plane.axisV, plane.sizeV));
  const h = Math.max(vert(plane.axisU, plane.sizeU), vert(plane.axisV, plane.sizeV), 1e-6);

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = h / 2 / Math.tan(vFov / 2) / fill;
  const distH = w / 2 / Math.tan(hFov / 2) / fill;
  const distance = Math.max(distV, distH, camera.near * 4);

  return {
    position: plane.center.clone().addScaledVector(normal, distance),
    target: plane.center.clone(),
  };
}

/** Phân rã trị riêng ma trận đối xứng 3x3 (phương pháp Jacobi). */
function jacobiEigen(m) {
  const a = m.map((row) => row.slice());
  const vec = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-20) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const cs = 1 / Math.sqrt(t * t + 1);
        const sn = t * cs;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = cs * akp - sn * akq;
          a[k][q] = sn * akp + cs * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = cs * apk - sn * aqk;
          a[q][k] = sn * apk + cs * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = vec[k][p];
          const vkq = vec[k][q];
          vec[k][p] = cs * vkp - sn * vkq;
          vec[k][q] = sn * vkp + cs * vkq;
        }
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: vec };
}
