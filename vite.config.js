import { defineConfig } from 'vite';
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Asset được giữ nguyên vị trí ở thư mục gốc (không dùng public/).
// Khi dev, Vite phục vụ trực tiếp các thư mục này từ root.
// Khi build, plugin dưới đây sao chép chúng nguyên trạng vào dist/.
// (fonts được CSS import nên Vite tự đóng gói, không cần sao chép.)
const STATIC_DIRS = ['models', 'images', 'data'];
const STATIC_FILE_EXT = ['.exr', '.hdr'];

function copyRootAssets() {
  let outDir;
  return {
    name: 'ck23-copy-root-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const root = process.cwd();
      for (const dir of STATIC_DIRS) {
        const src = resolve(root, dir);
        if (existsSync(src)) cpSync(src, resolve(outDir, dir), { recursive: true });
      }
      for (const file of readdirSync(root)) {
        if (STATIC_FILE_EXT.some((ext) => file.toLowerCase().endsWith(ext))) {
          cpSync(resolve(root, file), resolve(outDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  // Đường dẫn tương đối để chạy được trên GitHub Pages (/<tên-repo>/).
  base: './',
  publicDir: false,
  plugins: [copyRootAssets()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // three.js chiếm phần lớn bundle; tách chunk khi có thêm các mục.
    chunkSizeWarningLimit: 800,
  },
});
