/**
 * Mũi tên chớp nháy chậm chỉ hướng vuốt. Ẩn vĩnh viễn sau khi gọi dismiss().
 */
export class SwipeHint {
  constructor(container, { label = 'Vuốt để xoay' } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'swipe-hint';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <svg viewBox="0 0 96 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12h86M78 4l10 8-10 8" />
      </svg>
      <span>${label}</span>`;
    container.appendChild(this.el);
    this.dismissed = false;
  }

  dismiss() {
    if (this.dismissed) return;
    this.dismissed = true;
    this.el.classList.add('is-hidden');
    setTimeout(() => this.el.remove(), 600);
  }
}
