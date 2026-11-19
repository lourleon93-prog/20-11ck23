import { assetUrl } from '../core/AssetLoader.js';
import { ContentPanel } from './ContentPanel.js';
import { onHorizontalSwipe } from './gestures.js';
import { ICONS } from './icons.js';

const CHEVRON = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

/**
 * Thư viện ảnh của một quả cầu:
 * - Màn tổng thể: lưới tất cả ảnh, căn giữa màn hình.
 * - Chạm một ảnh: nền tối lại, ảnh phóng to như một tấm ảnh thật (không tràn viền),
 *   khung nội dung phía dưới (tiêu đề in đậm + nội dung). Vuốt ảnh/nội dung để đổi ảnh.
 */
export class Gallery {
  /** hints: { grid: 'Chạm vào một ảnh…', photo: 'Vuốt sang trái, phải…' } */
  constructor({ onClose, hints = {} }) {
    this.onClose = onClose;
    this.photos = [];
    this.index = -1;

    this.el = document.createElement('div');
    this.el.className = 'gallery';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="gallery__head">
        <h2 class="gallery__title"></h2>
        <button type="button" class="gallery__close" aria-label="Đóng">${CLOSE_ICON}</button>
      </div>
      <p class="gallery__hint">${ICONS.tap}<span></span></p>
      <div class="gallery__grid"></div>
      <div class="lightbox" hidden>
        <div class="lightbox__media"><img class="lightbox__img" alt="" draggable="false" /></div>
        <div class="lightbox__nav">
          <button type="button" class="nav-arrow" data-dir="-1" aria-label="Ảnh trước">${CHEVRON('M15 5l-7 7 7 7')}</button>
          <span class="lightbox__count"></span>
          <button type="button" class="nav-arrow" data-dir="1" aria-label="Ảnh sau">${CHEVRON('M9 5l7 7-7 7')}</button>
        </div>
        <p class="lightbox__hint"></p>
        <button type="button" class="lightbox__close" aria-label="Về danh sách ảnh">${CLOSE_ICON}</button>
      </div>`;
    this.titleEl = this.el.querySelector('.gallery__title');
    this.grid = this.el.querySelector('.gallery__grid');
    this.lightbox = this.el.querySelector('.lightbox');
    this.img = this.el.querySelector('.lightbox__img');
    this.panel = new ContentPanel();
    this.panel.el.classList.add('lightbox__panel');
    this.lightbox.appendChild(this.panel.el);

    this.el.querySelector('.gallery__hint span').textContent = hints.grid || '';
    this.el.querySelector('.gallery__hint').hidden = !hints.grid;
    this.el.querySelector('.lightbox__hint').textContent = hints.photo || '';
    this.el.querySelector('.lightbox__nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-arrow');
      if (btn) this._showPhoto(this.index + Number(btn.dataset.dir), Number(btn.dataset.dir));
    });
    this.el.querySelector('.gallery__close').addEventListener('click', () => this.close());
    this.el.querySelector('.lightbox__close').addEventListener('click', () => this._closePhoto());
    onHorizontalSwipe(this.lightbox, (dir) => this._showPhoto(this.index + dir, dir), {
      ignore: '.panel__font, .lightbox__close, .lightbox__nav',
    });
  }

  open({ title, photos }) {
    this.photos = photos;
    this.titleEl.textContent = title;
    this.grid.replaceChildren(
      ...photos.map((p, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gallery__thumb';
        btn.setAttribute('aria-label', p.title || `Ảnh ${i + 1}`);
        const img = document.createElement('img');
        img.src = assetUrl(p.src);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        btn.addEventListener('click', () => this._showPhoto(i, 0));
        return btn;
      }),
    );
    this.lightbox.hidden = true;
    this.el.hidden = false;
  }

  close() {
    this.el.hidden = true;
    this.lightbox.hidden = true;
    this.onClose?.();
  }

  get isOpen() {
    return !this.el.hidden;
  }

  _showPhoto(i, dir) {
    if (i < 0 || i >= this.photos.length) return;
    this.index = i;
    const p = this.photos[i];
    this.lightbox.hidden = false;
    this.img.classList.remove('is-in');
    this.img.style.setProperty('--dir', dir || 0);
    this.img.src = assetUrl(p.src);
    this.img.alt = p.title || '';
    void this.img.offsetWidth;
    this.img.classList.add('is-in');
    this.panel.set({ title: p.title, body: p.body }, dir);
    this.el.querySelector('.lightbox__count').textContent = `${i + 1} / ${this.photos.length}`;
    this.el.querySelector('.lightbox__nav [data-dir="-1"]').disabled = i === 0;
    this.el.querySelector('.lightbox__nav [data-dir="1"]').disabled = i === this.photos.length - 1;
  }

  _closePhoto() {
    this.lightbox.hidden = true;
  }
}
