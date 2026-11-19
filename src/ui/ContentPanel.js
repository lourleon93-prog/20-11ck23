const SCALE_KEY = 'ck23.textScale';
const SCALE_MIN = 0.85;
const SCALE_MAX = 1.6;

function readScale() {
  try {
    const v = parseFloat(localStorage.getItem(SCALE_KEY));
    return Number.isFinite(v) ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) : 1;
  } catch {
    return 1;
  }
}

function writeScale(v) {
  try {
    localStorage.setItem(SCALE_KEY, String(v));
  } catch {
    /* bỏ qua khi trình duyệt chặn bộ nhớ */
  }
}

/**
 * Khung nội dung phía dưới (mặc định 1/3 màn hình, giãn tới dưới 1/2 khi chữ lớn).
 * Gồm tiêu đề in đậm ở giữa, nội dung, và thanh chỉnh cỡ chữ.
 * Cỡ chữ dùng chung cho mọi phần qua biến CSS --text-scale.
 */
export class ContentPanel {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'panel';
    this.el.innerHTML = `
      <div class="panel__inner">
        <h2 class="panel__title"></h2>
        <div class="panel__body"></div>
      </div>
      <label class="panel__font">
        <span class="panel__font-a panel__font-a--small" aria-hidden="true">A</span>
        <input type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" step="0.05" aria-label="Cỡ chữ" />
        <span class="panel__font-a panel__font-a--large" aria-hidden="true">A</span>
      </label>`;
    this.inner = this.el.querySelector('.panel__inner');
    this.titleEl = this.el.querySelector('.panel__title');
    this.bodyEl = this.el.querySelector('.panel__body');
    this.fontEl = this.el.querySelector('.panel__font');

    const input = this.fontEl.querySelector('input');
    const scale = readScale();
    input.value = scale;
    document.documentElement.style.setProperty('--text-scale', scale);
    input.addEventListener('input', () => {
      document.documentElement.style.setProperty('--text-scale', input.value);
      writeScale(input.value);
    });
  }

  /** Đổi nội dung, có hiệu ứng chuyển mượt. direction: 1 (tới) | -1 (lùi) | 0 (không hiệu ứng). */
  set({ title, body }, direction = 0) {
    const apply = () => {
      this.titleEl.textContent = title;
      this.bodyEl.textContent = body;
      this.el.scrollTop = 0;
    };
    if (!direction) return apply();
    const inner = this.inner;
    inner.style.setProperty('--dir', direction);
    inner.classList.remove('is-entering');
    inner.classList.add('is-leaving');
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      apply();
      inner.classList.remove('is-leaving');
      void inner.offsetWidth; // khởi động lại animation
      inner.classList.add('is-entering');
    }, 180);
  }
}
