import { createHomeButton } from '../ui/HomeButton.js';

/** Trang tạm cho các mục chưa triển khai (sẽ được thay bằng mục thật). */
export class ComingSoonSection {
  constructor({ title, onHome }) {
    this.el = document.createElement('section');
    this.el.className = 'view coming-soon';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = 'Phần này đang được xây dựng.';
    this.el.append(createHomeButton(onHome), h, p);
  }
}
