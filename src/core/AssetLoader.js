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
