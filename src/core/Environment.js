import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { assetUrl } from './AssetLoader.js';

const cache = new Map();

/**
 * Tải ảnh HDRI (.exr) và tạo bản đồ môi trường (PMREM) để chiếu sáng model.
 * Trả về { envMap, background }: envMap dùng cho scene.environment,
 * background là ảnh equirectangular dùng làm nền trời.
 */
export function loadHDRI(renderer, path) {
  if (!cache.has(path)) {
    const promise = new EXRLoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(assetUrl(path))
      .then((tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envMap = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
        return { envMap, background: tex };
      });
    promise.catch(() => cache.delete(path));
    cache.set(path, promise);
  }
  return cache.get(path);
}

/** Thiết bị cảm ứng / màn hình nhỏ: coi là điện thoại để giới hạn tài nguyên GPU. */
export function isMobileDevice() {
  return matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 768;
}

/**
 * Thu nhỏ các texture lớn hơn `maxSize` ngay trên máy người xem (file gốc giữ nguyên).
 * Dùng trên điện thoại để model nhiều texture lớn không vượt bộ nhớ GPU.
 * Trả về số texture đã thu nhỏ.
 */
export function limitTextureSize(root, maxSize) {
  const seen = new Set();
  let count = 0;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    for (const mat of [obj.material].flat()) {
      for (const key of Object.keys(mat)) {
        const tex = mat[key];
        if (!tex?.isTexture || seen.has(tex) || !tex.image) continue;
        seen.add(tex);
        const { width, height } = tex.image;
        if (!width || !height || Math.max(width, height) <= maxSize) continue;
        const scale = maxSize / Math.max(width, height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext('2d').drawImage(tex.image, 0, 0, canvas.width, canvas.height);
        tex.image.close?.(); // giải phóng ImageBitmap gốc
        tex.image = canvas;
        tex.needsUpdate = true;
        count++;
      }
    }
  });
  return count;
}

/** Model tĩnh: tính ma trận một lần rồi tắt cập nhật mỗi khung hình (đỡ tốn CPU với hàng trăm node). */
export function freezeStatic(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.matrixWorldAutoUpdate = false;
  });
}
