import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;

/** Ghép đường dẫn asset với base của Vite (cần cho GitHub Pages). */
export function assetUrl(path) {
  return BASE + path.replace(/^\/+/, '');
}

const textureCache = new Map();

/**
 * Tải ảnh thành texture, thu nhỏ về cạnh dài tối đa `maxSize` để tiết kiệm bộ nhớ GPU.
 * Trả về { texture, aspect } (aspect = rộng / cao).
 */
export function loadTexture(path, maxSize = 1024) {
  const key = `${path}@${maxSize}`;
  if (!textureCache.has(key)) {
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resolve({ texture, aspect: img.naturalWidth / img.naturalHeight });
      };
      img.onerror = () => reject(new Error(`Không tải được ảnh "${path}"`));
      img.src = assetUrl(path);
    });
    promise.catch(() => textureCache.delete(key));
    textureCache.set(key, promise);
  }
  return textureCache.get(key);
}

const gltfLoader = new GLTFLoader();
// Hỗ trợ sẵn GLB nén Meshopt (gltfpack / gltf-transform) khi tối ưu model sau này.
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();

/**
 * Tải GLB, có cache theo URL. Lỗi được ném ra với thông điệp rõ ràng
 * (vd. file chỉ là con trỏ Git LFS chưa được tải về).
 */
export function loadGLTF(path, onProgress) {
  const url = assetUrl(path);
  if (!cache.has(url)) {
    const promise = new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          // Bộ đọc giữ lại toàn bộ file .glb (hàng chục–trăm MB) trong bộ nhớ; không cần nữa thì bỏ
          gltf.parser?.cache?.removeAll?.();
          gltf.parser = null;
          resolve(gltf);
        },
        (e) => {
          if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
        },
        (err) => reject(new Error(`Không tải được model "${path}": ${err?.message || err}`)),
      );
    });
    promise.catch(() => cache.delete(url));
    cache.set(url, promise);
  }
  return cache.get(url);
}

/**
 * Sau khi ảnh texture đã được đưa lên GPU, bỏ bản ảnh giải nén trong bộ nhớ thường.
 * Trên iPhone bộ nhớ thường và bộ nhớ đồ hoạ dùng chung, nên việc này giảm gần một nửa bộ nhớ ảnh.
 * Nhiều texture có thể dùng chung một ảnh gốc (Source): chỉ bỏ ảnh khi TẤT CẢ texture dùng ảnh đó
 * đã lên GPU. (Chỉ dùng cho model tĩnh: texture không được cập nhật lại sau khi tải.)
 */
export function releaseImagesAfterUpload(root) {
  const groups = new Map(); // Source -> Set<Texture> chưa lên GPU
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    for (const mat of [obj.material].flat()) {
      for (const key of Object.keys(mat)) {
        const tex = mat[key];
        if (!tex?.isTexture || !tex.source) continue;
        if (!groups.has(tex.source)) groups.set(tex.source, new Set());
        groups.get(tex.source).add(tex);
      }
    }
  });
  for (const [source, pending] of groups) {
    for (const tex of pending) {
      const prev = tex.onUpdate;
      tex.onUpdate = function (t) {
        prev?.call(this, t);
        t.onUpdate = prev ?? null;
        pending.delete(t);
        if (pending.size) return;
        source.data?.close?.(); // ImageBitmap
        source.data = null;
      };
    }
  }
}
