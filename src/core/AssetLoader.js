import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = import.meta.env.BASE_URL;

/** Ghép đường dẫn asset với base của Vite (cần cho GitHub Pages). */
export function assetUrl(path) {
  return BASE + path.replace(/^\/+/, '');
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
        resolve,
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
