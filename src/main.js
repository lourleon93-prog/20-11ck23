import './styles/base.css';
import './styles/home.css';

import { HomeScene } from './scenes/home/HomeScene.js';

const home = new HomeScene({
  canvas: document.getElementById('home-canvas'),
  stage: document.getElementById('home-stage'),
  loader: document.getElementById('home-loader'),
  onSelect: (section) => {
    // Các mục 1–3 chưa được triển khai: tạm thời đưa camera về lại góc nhìn tổng thể.
    console.info(`[CK23] Chọn mục: ${section} (chưa triển khai)`);
    setTimeout(() => home.returnToOverview(), 900);
  },
  onScrollBack: () => document.getElementById('home-intro').scrollIntoView({ behavior: 'smooth' }),
});

home.init().catch(() => {});

// Hook gỡ lỗi chỉ có khi chạy dev
if (import.meta.env.DEV) window.__ck23 = { home };
