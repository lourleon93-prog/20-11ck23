import './styles/base.css';
import './styles/home.css';
import './styles/ui.css';
import './styles/history.css';
import './styles/crystal.css';

import { Router } from './core/Router.js';
import { HomeScene } from './scenes/home/HomeScene.js';
import { HistorySection } from './scenes/history/HistorySection.js';
import { ComingSoonSection } from './scenes/ComingSoonSection.js';
import { CrystalSection } from './scenes/crystal/CrystalSection.js';
import { HOME_CONFIG } from './scenes/home/homeConfig.js';

const app = document.getElementById('app');
const goHome = () => router.go('home');

const home = new HomeScene({
  canvas: document.getElementById('home-canvas'),
  stage: document.getElementById('home-stage'),
  loader: document.getElementById('home-loader'),
  // Mỗi biển hiệu dẫn tới đúng một mục (khai báo trong homeConfig.signs)
  onSelect: (section) => router.go(section),
  onScrollBack: () => document.getElementById('home-intro').scrollIntoView({ behavior: 'smooth' }),
});

const historySection = new HistorySection({ onHome: goHome });
const labelOf = (id) => HOME_CONFIG.signs.find((s) => s.section === id)?.label ?? id;
const school = new ComingSoonSection({ title: labelOf('school'), onHome: goHome });
const crystal = new CrystalSection({ onHome: goHome });
app.append(historySection.el, school.el, crystal.el);

const router = new Router({
  home: { el: document.getElementById('view-home'), enter: () => home.resume() },
  history: historySection,
  school,
  crystal,
});

home.init().catch(() => {});
router.start();

// Hook gỡ lỗi chỉ có khi chạy dev
if (import.meta.env.DEV) window.__ck23 = { home, history: historySection, crystal, router };
