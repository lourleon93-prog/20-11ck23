import data from '../../../data/history.json';
import { ContentPanel } from '../../ui/ContentPanel.js';
import { createHomeButton } from '../../ui/HomeButton.js';
import { showCoachMarks } from '../../ui/CoachMarks.js';
import { onHorizontalSwipe } from '../../ui/gestures.js';
import { tilt } from '../../interaction/TiltInput.js';
import { ModelViewer } from '../../core/ModelViewer.js';
import { loadGLTF } from '../../core/AssetLoader.js';
import { createSlide, ModelSlide, ParallaxSlide } from './slides.js';

/**
 * Mục 1 – Lịch sử và ý nghĩa ngày 20/11 ("cỗ máy thời gian").
 * Bố cục dọc: 2/3 trên là hình ảnh/mô hình, 1/3 dưới là nội dung.
 * Vuốt ngang để đổi mốc thời gian.
 */
export class HistorySection {
  constructor({ onHome }) {
    this.milestones = data.milestones;
    this.index = 0;
    this._introShown = false;
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

    this.panel = new ContentPanel();
    this.homeBtn = createHomeButton(onHome);
    this.el.append(this.media, this.panel.el, this.homeBtn);

    this.viewer = new ModelViewer();

    onHorizontalSwipe(this.el, (dir) => this.go(this.index + dir), {
      ignore: '.viewer__canvas, .panel__font, .home-btn, .coach',
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

    if (!this._introShown) {
      this._introShown = true;
      requestAnimationFrame(() =>
        showCoachMarks(this.el, {
          message: data.intro,
          marks: [
            { target: this.homeBtn, label: 'Trở về trang chủ', place: 'right' },
            { target: this.panel.inner, label: 'Vuốt để đổi mốc thời gian', place: 'above' },
            { target: this.panel.fontEl, label: 'Thay đổi kích cỡ chữ', place: 'above' },
          ],
        }),
      );
    }
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
  }

  _startLoop() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      tilt.update(dt);
      const slide = this.slides[this.index];
      if (slide instanceof ParallaxSlide) slide.update(tilt.x, tilt.y);
      this._raf = requestAnimationFrame(loop);
    };
    tilt.start();
    this._raf = requestAnimationFrame(loop);
  }
}
