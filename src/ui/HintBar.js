import { ICONS } from './icons.js';

/**
 * Dòng gợi ý nhỏ: một hoặc nhiều cặp (biểu tượng + chữ ngắn), chớp nháy chậm.
 * items: [{ icon: 'tap'|'swipe'|'rotate'|'pinch'|'tilt'|'mouse', text }]
 */
export class HintBar {
  constructor(items = [], { className = '' } = {}) {
    this.el = document.createElement('div');
    this.el.className = `hintbar ${className}`;
    this.el.setAttribute('role', 'note');
    this.set(items);
  }

  set(items) {
    this.el.replaceChildren(
      ...items
        .filter((it) => it.text)
        .map((it) => {
          const row = document.createElement('div');
          row.className = 'hintbar__item';
          row.innerHTML = ICONS[it.icon] ?? '';
          const span = document.createElement('span');
          span.textContent = it.text;
          row.appendChild(span);
          return row;
        }),
    );
    this.el.hidden = !this.el.childElementCount;
    this.el.classList.remove('is-faded');
  }

  /** Mờ đi (sau khi người dùng đã làm theo), vẫn để lại để nhắc. */
  fade() {
    this.el.classList.add('is-faded');
  }

  show(visible = true) {
    this.el.hidden = !visible || !this.el.childElementCount;
  }
}
