import data from '../../../data/history.json';
import { ContentPanel } from '../../ui/ContentPanel.js';
import { createHomeButton, setHomeAttention } from '../../ui/HomeButton.js';
import { HintBar } from '../../ui/HintBar.js';
import { t } from '../../ui/guide.js';
import { showCoachMarks } from '../../ui/CoachMarks.js';
import { onHorizontalSwipe } from '../../ui/gestures.js';
import { tilt } from '../../interaction/TiltInput.js';
import { ModelViewer } from '../../core/ModelViewer.js';
import { loadGLTF } from '../../core/AssetLoader.js';
import { createSlide, ModelSlide, ParallaxSlide } from './slides.js';

const CHEVRON = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/**
 * Mục 1 – Lịch sử và ý nghĩa ngày 20/11 ("cỗ máy thời gian").
 * Bố cục dọc: 2/3 trên là hình ảnh/mô hình, 1/3 dưới là nội dung.
 * Vuốt ngang để đổi mốc thời gian.
 */
export class HistorySection {
  constructor({ onHome }) {
    this.milestones = data.milestones;
    this.index = 0;
    this._raf = 0;

    this.el = document.createElement('section');
    this.el.className = 'view history';
    this.el.setAttribute('aria-label', 'Lịch sử và ý nghĩa ngày 20/11');

    this.media = document.createElement('div');
    this.media.className = 'history__media';
    this.slides = this.milestones.map((m) => {
      const slide = createSlide(m.media);
      this.media.appendChild(slide.el);
      return slide;
    });

    // Gợi ý thao tác ở đáy vùng hình (nghiêng / xoay / phóng to), đổi theo từng mốc
    this.mediaHint = new HintBar([], { className: 'media-hint' });
    this.media.appendChild(this.mediaHint.el);

    this.panel = new ContentPanel();
    // Hàng điều hướng: nút trước / sau + chấm vị trí (cho người không quen vuốt)
    this.nav = document.createElement('div');
    this.nav.className = 'history__nav';
    this.nav.innerHTML = `
      <button type="button" class="nav-arrow" data-dir="-1" aria-label="Mốc trước">${CHEVRON('M15 5l-7 7 7 7')}</button>
      <div class="history__dots">${this.milestones.map(() => '<i></i>').join('')}</div>
      <button type="button" class="nav-arrow" data-dir="1" aria-label="Mốc sau">${CHEVRON('M9 5l7 7-7 7')}</button>`;
    this.nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-arrow');
      if (btn) this.go(this.index + Number(btn.dataset.dir));
    });
    this.panel.el.prepend(this.nav);
    this.homeBtn = createHomeButton(onHome);
    this.el.append(this.media, this.panel.el, this.homeBtn);

    this.viewer = new ModelViewer();
    // Người dùng đã thử xoay/phóng to mô hình -> gợi ý mờ đi
    this.viewer.canvas.addEventListener('pointerdown', () => this.mediaHint.fade());
    this.viewer.canvas.addEventListener('wheel', () => this.mediaHint.fade(), { passive: true });

    onHorizontalSwipe(this.el, (dir) => this.go(this.index + dir), {
      ignore: '.viewer__canvas, .panel__font, .home-btn, .home-bubble, .coach, .history__nav',
    });
    // iOS: xin quyền cảm biến nghiêng ở lần chạm đầu tiên
    this.el.addEventListener('click', () => tilt.requestPermission(), { once: true });

    this._show(0, 0);
  }

  enter() {
    this._startLoop();
    const current = this.slides[this.index];
    if (current instanceof ModelSlide) this.viewer.start();
    // Tải trước các mô hình của mục này
    for (const s of this.slides) if (s instanceof ModelSlide) loadGLTF(s.model).catch(() => {});

    // Mỗi lần vào: bắt đầu lại từ "chưa xem hết"
    this._finished = false;
    this._updateDone();

    // Lớp hướng dẫn hiện mỗi lần vào mục này
    this.el.querySelector('.coach')?.remove();
    requestAnimationFrame(() =>
      showCoachMarks(this.el, {
        message: data.intro,
        dismiss: t('dismiss'),
        marks: [
          { target: this.homeBtn, label: t('history.homeButton'), place: 'right' },
          { target: this.panel.inner, label: t('history.swipe'), icon: 'swipe', place: 'above' },
          { target: this.panel.fontEl, label: t('history.fontSize'), place: 'above' },
        ],
      }),
    );
  }

  leave() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.viewer.stop();
  }

  go(i) {
    if (i < 0 || i >= this.slides.length || i === this.index) return;
    const dir = Math.sign(i - this.index);
    this._show(i, dir);
  }

  _show(i, dir) {
    const prev = this.slides[this.index];
    this.index = i;
    const next = this.slides[i];

    this.slides.forEach((s, k) => {
      s.el.classList.toggle('is-active', k === i);
      s.el.dataset.side = k < i ? 'prev' : k > i ? 'next' : '';
    });

    if (prev instanceof ModelSlide && prev !== next) this.viewer.stop();
    if (next instanceof ModelSlide) {
      next.el.appendChild(this.viewer.el);
      this.viewer.show(next.model, next.view);
    }

    const m = this.milestones[i];
    this.panel.set({ title: m.title, body: m.body }, dir);

    // Chấm vị trí + nút trước/sau
    this.nav.querySelectorAll('.history__dots i').forEach((dot, k) => dot.classList.toggle('is-on', k === i));
    this.nav.querySelector('[data-dir="-1"]').disabled = i === 0;
    this.nav.querySelector('[data-dir="1"]').disabled = i === this.slides.length - 1;

    // Gợi ý thao tác theo loại hình của mốc này
    if (next instanceof ParallaxSlide) this.mediaHint.set([{ icon: 'tilt', text: t('history.tilt') }]);
    else if (next instanceof ModelSlide)
      this.mediaHint.set([
        { icon: 'rotate', text: t('history.rotate') },
        { icon: 'pinch', text: t('history.zoom') },
      ]);
    else this.mediaHint.set([]);
    this._tiltSeen = 0;

    // Tới mốc cuối (Ý nghĩa) = đã xem hết -> nút Home báo hiệu
    if (i === this.slides.length - 1) this._finished = true;
    this._updateDone();
  }

  _updateDone() {
    setHomeAttention(this.homeBtn, this._finished ? t('history.done') : '');
  }

  _startLoop() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      tilt.update(dt);
      const slide = this.slides[this.index];
      if (slide instanceof ParallaxSlide) {
        slide.update(tilt.x, tilt.y);
        // Người dùng đã nghiêng thử một lúc -> gợi ý mờ đi
        if (Math.hypot(tilt.x, tilt.y) > 0.35 && (this._tiltSeen += dt) > 0.6) this.mediaHint.fade();
      }
      this._raf = requestAnimationFrame(loop);
    };
    tilt.start();
    this._raf = requestAnimationFrame(loop);
  }
}
