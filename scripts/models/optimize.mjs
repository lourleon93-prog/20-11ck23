// Tối ưu model GLB cho web mà giữ nguyên ngoại hình.
//
// Cách chạy (công cụ chỉ cài tạm, không thêm vào dependency của dự án):
//   mkdir -p /tmp/gltf && cd /tmp/gltf && npm init -y && npm i @gltf-transform/core@4.5.1 \
//     @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.2.0 sharp
//   cp <repo>/scripts/models/optimize.mjs /tmp/gltf/ && cd /tmp/gltf
//   node --max-old-space-size=12000 optimize.mjs school <repo>/models/CQT.glb   <repo>/models/optimized/CQT.glb   <repo>/data/waypoints.json
//   node --max-old-space-size=12000 optimize.mjs room   <repo>/models/Thayy.glb <repo>/models/optimized/Thayy.glb
//   node --max-old-space-size=12000 optimize.mjs plain  <repo>/models/flower.glb <repo>/models/optimized/flower.glb
//   Thêm --mobile để tạo bản cho điện thoại (sai số tính theo màn hình điện thoại dọc), vd.:
//   node --max-old-space-size=12000 optimize.mjs room <repo>/models/Thayy.glb <repo>/models/optimized/Thayy.mobile.glb --mobile
//
// Các bước:
//  1. Sửa node có scale = 0 trên trục mà hình học vốn dẹt (ma trận suy biến làm bước lượng tử hoá mất góc xoay).
//  2. (school) Tạo cột cổng bên phải bằng phép đối xứng gương của cột trái (Mirror modifier chưa apply).
//  3. Gộp dữ liệu trùng, bỏ phần không dùng (giữ node rỗng: waypoint wp.*, điểm quả cầu Mball*).
//  4. Giảm tam giác có kiểm soát (khoá đường viền hở để chữ/cánh hoa/tấm phẳng không méo): sai số hình học < 0.5 điểm ảnh tại vị trí camera gần nhất có thể
//     (waypoint, đường đi giữa waypoint, điểm focus quả cầu / mọi góc xoay-zoom trong phòng tưởng nhớ),
//     ngay cả khi phóng to tối đa. Chỉ áp dụng cho mesh từ 100 000 tam giác trở lên.
//  5. (school) Vật giống nhau lặp lại -> instancing (1 lệnh vẽ).
//  6. Ảnh màu WebP chất lượng 90, ảnh dữ liệu (normal/ORM…) WebP không mất dữ liệu; giữ nguyên độ phân giải.
//  7. Nén hình khối Meshopt, độ chính xác cao (vị trí 16 bit, pháp tuyến 12 bit, UV 14 bit).

import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplifyPrimitive, instance, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const MOBILE = args.includes('--mobile');
const [profile, input, output, waypointsPath] = args.filter((a) => !a.startsWith('--'));
if (!['school', 'room', 'plain'].includes(profile) || !input || !output) {
  console.error('Dùng: node optimize.mjs <school|room|plain> <input.glb> <output.glb> [waypoints.json]');
  process.exit(1);
}

// Sai số cho phép trên mỗi đơn vị khoảng cách camera: 0.5 px trên khung hình cao 1600 px
// (máy tính) hoặc 1300 px (điện thoại: 844 px x mật độ 1.5), với góc nhìn hẹp nhất
// (sân trường FOV 35° khi phóng to, phòng tưởng nhớ FOV 40°).
const PX = 0.5 / (MOBILE ? 1300 : 1600);
const ERR_PER_DIST = { school: 2 * Math.tan((35 / 2) * (Math.PI / 180)) * PX, room: 2 * Math.tan((40 / 2) * (Math.PI / 180)) * PX };
// Chỉ giảm tam giác ở mesh cực dày (hoa trang trí, tán cây…); vật bình thường giữ nguyên hoàn toàn
const MIN_TRIS = 100000;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const doc = await io.read(input);
const root = doc.getRoot();
log('đọc xong', input);

// ---------- tiện ích ----------
const apply = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];
function worldBox(node) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const mesh = node.getMesh();
  if (!mesh) return null;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const a = prim.getAttribute('POSITION');
    const pmin = a.getMinNormalized([]);
    const pmax = a.getMaxNormalized([]);
    for (let i = 0; i < 8; i++) {
      const w = apply(m, [i & 1 ? pmax[0] : pmin[0], i & 2 ? pmax[1] : pmin[1], i & 4 ? pmax[2] : pmin[2]]);
      for (let d = 0; d < 3; d++) {
        lo[d] = Math.min(lo[d], w[d]);
        hi[d] = Math.max(hi[d], w[d]);
      }
    }
  }
  return { lo, hi };
}
const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((d) => Math.max(b.lo[d] - p[d], 0, p[d] - b.hi[d])));
const boxRadius = (b) => Math.hypot(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]) / 2;
const byName = (name) => root.listNodes().find((n) => n.getName() === name);
const triCount = (mesh) =>
  mesh.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

// ---------- 1. scale = 0 ----------
for (const node of root.listNodes()) {
  const s = node.getScale().slice();
  if (!s.some((v) => Math.abs(v) < 1e-9)) continue;
  const mesh = node.getMesh();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  if (mesh)
    for (const p of mesh.listPrimitives()) {
      const a = p.getAttribute('POSITION');
      const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        for (let d = 0; d < 3; d++) {
          lo[d] = Math.min(lo[d], v[d]);
          hi[d] = Math.max(hi[d], v[d]);
        }
      }
    }
  for (let d = 0; d < 3; d++) {
    if (Math.abs(s[d]) >= 1e-9) continue;
    const flat = !mesh || hi[d] - lo[d] < 1e-9;
    s[d] = flat && node.listChildren().length === 0 ? 1 : 1e-6;
  }
  node.setScale(s);
  log('sửa scale 0:', node.getName());
}

// ---------- 2. cột cổng bên phải ----------
if (profile === 'school') {
  const pillar = byName('Cube.002');
  const beams = ['Cube.001', 'Cube.006', 'Cube.045'].map(byName).filter(Boolean);
  if (pillar && beams.length && !byName('Cube.002 (mirror)')) {
    const cx = beams.map((b) => b.getWorldTranslation()[0]).reduce((a, b) => a + b, 0) / beams.length;
    // Ma trận đối xứng gương qua mặt phẳng x = cx, nhân với ma trận world của cột trái
    const W = pillar.getWorldMatrix();
    const M = W.slice();
    for (const i of [0, 4, 8]) M[i] = -W[i];
    M[12] = 2 * cx - W[12];
    const copy = doc.createNode('Cube.002 (mirror)').setMesh(pillar.getMesh()).setMatrix(M);
    root.listScenes()[0].addChild(copy);
    log(`thêm cột cổng đối xứng qua x = ${cx.toFixed(4)}`);
  }
}

// ---------- 3. gộp trùng / dọn ----------
await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true, keepSolidTextures: true }), weld());
log('dedup + prune + weld xong');

// ---------- 4. giảm tam giác có kiểm soát ----------
if (profile !== 'plain') {
  const cams = [];
  if (profile === 'school') {
    const wps = JSON.parse(readFileSync(waypointsPath, 'utf8'));
    for (const [id, wp] of Object.entries(wps)) {
      cams.push({ p: wp.position, r: 0 });
      for (const other of wp.links || []) {
        const q = wps[other]?.position;
        if (!q) continue;
        const n = Math.ceil(Math.hypot(q[0] - wp.position[0], q[1] - wp.position[1], q[2] - wp.position[2]) / 0.02);
        for (let i = 1; i < n; i++) cams.push({ p: wp.position.map((v, d) => v + ((q[d] - v) * i) / n), r: 0 });
      }
    }
    // Camera tới gần quả cầu khi focus (cách tâm 0.16)
    for (const n of root.listNodes()) if (/^Mball/.test(n.getName())) cams.push({ p: n.getWorldTranslation(), r: 0.16 });
  } else {
    // Phòng tưởng nhớ: mọi vị trí camera có thể có quanh ảnh thầy (xoay ±25°, ±15°).
    // Khoảng cách: máy tính 0.9–6 (màn ngang phải đứng gần); điện thoại dọc 3.0–6.2
    // (khoảng cách ban đầu ~5.45, phóng to tối đa 0.6 lần -> ~3.27).
    const photo = byName('FB_IMG_1794075035707');
    const b = worldBox(photo);
    const t = [b.lo[0], 1.2, (b.lo[2] + b.hi[2]) / 2];
    for (let d = MOBILE ? 3.0 : 0.9; d <= 6.2; d += 0.15)
      for (let az = -25; az <= 25; az += 5)
        for (let el = -15; el <= 15; el += 5) {
          const a = (az * Math.PI) / 180;
          const e = (el * Math.PI) / 180;
          cams.push({ p: [t[0] + d * Math.cos(e) * Math.cos(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.sin(a)], r: 0 });
        }
  }
  log(`${cams.length} vị trí camera mẫu`);

  // Sai số cho phép (tương đối theo bán kính mesh) = nhỏ nhất qua mọi node dùng mesh đó
  const relErr = new Map();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || triCount(mesh) < MIN_TRIS) continue;
    const box = worldBox(node);
    let dmin = Infinity;
    for (const c of cams) dmin = Math.min(dmin, Math.max(boxDist(box, c.p) - c.r, 0.02));
    const err = (dmin * ERR_PER_DIST[profile]) / Math.max(boxRadius(box), 1e-6);
    relErr.set(mesh, Math.min(relErr.get(mesh) ?? Infinity, err));
  }
  let before = 0;
  let after = 0;
  for (const [mesh, err] of relErr) {
    const b = triCount(mesh);
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // chỉ TRIANGLES
      // lockBorder: giữ nguyên đường viền hở (chữ, cánh hoa, tấm phẳng, đường nối UV)
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: err, lockBorder: true });
    }
    const a = triCount(mesh);
    before += b;
    after += a;
    if (b > 100000) log(`  ${mesh.getName()}: ${b.toLocaleString()} -> ${a.toLocaleString()} tam giác (sai số ${err.toExponential(2)})`);
  }
  log(`giảm tam giác: ${before.toLocaleString()} -> ${after.toLocaleString()} (các mesh >= ${MIN_TRIS})`);
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true, keepSolidTextures: true }));
}

// ---------- 5. instancing ----------
if (profile === 'school') {
  // Instancing của three.js biến đổi pháp tuyến bằng ma trận thường (không phải nghịch đảo chuyển vị)
  // và không lật thứ tự mặt cho từng bản sao. Vì vậy chỉ instancing vật có tỉ lệ đều 3 trục và không
  // bị lật gương; các vật khác dùng mesh riêng để giữ đúng ánh sáng và mặt trước/sau như bản gốc.
  const det = (m) =>
    m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  const uniform = (m) => {
    const sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);
    return Math.max(sx, sy, sz) / Math.max(1e-12, Math.min(sx, sy, sz)) < 1.001;
  };
  // Tạm gỡ mesh khỏi các vật "không an toàn" để bước instancing chỉ gom vật an toàn, rồi gắn lại.
  const detached = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    if (det(m) < 0 || !uniform(m)) {
      detached.push([node, mesh]);
      node.setMesh(null);
    }
  }
  await doc.transform(instance({ min: 2 }));
  for (const [node, mesh] of detached) node.setMesh(mesh);
  log(`${detached.length} vật lật gương/tỉ lệ không đều được vẽ riêng (không instancing)`);
  log('instancing xong');
}

// ---------- 6. texture ----------
await doc.transform(
  textureCompress({
    encoder: sharp,
    targetFormat: 'webp',
    slots: /^(baseColorTexture|emissiveTexture|specularColorTexture|sheenColorTexture)$/,
    quality: 90,
  }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', lossless: true }),
);
log('WebP xong');

// ---------- 7. meshopt ----------
await doc.transform(
  meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 14 }),
);
await io.write(output, doc);
log('ghi xong', output);
