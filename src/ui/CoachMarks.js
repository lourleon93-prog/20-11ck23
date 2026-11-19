import { ICONS } from './icons.js';

/**
 * Lớp hướng dẫn: khung chớp nháy chậm quanh các phần điều khiển kèm ý nghĩa,
 * cùng một thông điệp chung và câu "chạm vào màn hình khi đã hiểu". Biến mất khi người dùng chạm.
 *
 * @param {HTMLElement} container
 * @param {{ message: string, dismiss?: string,
 *           marks: { target: HTMLElement, label: string, icon?: string, place?: 'below'|'above'|'right' }[] }} opts
 * @returns {Promise<void>} khi người dùng chạm để đóng
 */
export function showCoachMarks(container, { message, dismiss = '', marks }) {
  const overlay = document.createElement('div');
  overlay.className = 'coach';
  overlay.innerHTML = `<div class="coach__message"><p></p><p class="coach__dismiss">${ICONS.tap}<span></span></p></div>`;
  overlay.querySelector('.coach__message p').textContent = message;
  overlay.querySelector('.coach__dismiss span').textContent = dismiss;
  overlay.querySelector('.coach__dismiss').hidden = !dismiss;

  const items = marks.map((m) => {
    const frame = document.createElement('div');
    frame.className = 'coach__frame';
    const label = document.createElement('div');
    label.className = `coach__label coach__label--${m.place || 'below'}`;
    if (m.icon && ICONS[m.icon]) label.innerHTML = ICONS[m.icon];
    label.appendChild(document.createTextNode(m.label));
    overlay.append(frame, label);
    return { ...m, frame, label };
  });

  const layout = () => {
    const base = container.getBoundingClientRect();
    for (const it of items) {
      const r = it.target.getBoundingClientRect();
      const pad = 6;
      const x = r.left - base.left - pad;
      const y = r.top - base.top - pad;
      const w = r.width + pad * 2;
      const h = r.height + pad * 2;
      Object.assign(it.frame.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      const s = it.label.style;
      s.left = s.top = s.right = s.bottom = '';
      if (it.place === 'right') {
        s.left = `${x + w + 10}px`;
        s.top = `${y + h / 2}px`;
      } else if (it.place === 'above') {
        s.left = `${x + w / 2}px`;
        s.top = `${y - 8}px`;
      } else {
        s.left = `${x + w / 2}px`;
        s.top = `${y + h + 8}px`;
      }
    }
  };

  container.appendChild(overlay);
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(container);

  return new Promise((resolve) => {
    overlay.addEventListener(
      'pointerup',
      () => {
        ro.disconnect();
        overlay.classList.add('is-hidden');
        setTimeout(() => overlay.remove(), 400);
        resolve();
      },
      { once: true },
    );
  });
}
