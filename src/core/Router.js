/**
 * Điều hướng giữa các phần của website bằng hash (#/history, #/school, …).
 * Dùng hash để chạy được trên GitHub Pages và hỗ trợ nút Back của trình duyệt.
 *
 * Mỗi view: { el: HTMLElement, enter?(): void, leave?(): void }
 */
export class Router {
  constructor(views, { home = 'home' } = {}) {
    this.views = views;
    this.home = home;
    this.current = null;
    window.addEventListener('hashchange', () => this._sync());
  }

  start() {
    for (const [id, view] of Object.entries(this.views)) view.el.hidden = id !== this.home;
    this._sync();
  }

  go(id) {
    const hash = id === this.home ? '' : `#/${id}`;
    if (location.hash === hash || (hash === '' && location.hash === '#/')) return this._sync();
    if (hash === '') history.pushState(null, '', location.pathname + location.search);
    else location.hash = hash;
    if (hash === '') this._sync(); // pushState không phát hashchange
  }

  _sync() {
    const id = location.hash.replace(/^#\/?/, '') || this.home;
    const next = this.views[id] ? id : this.home;
    if (next === this.current) return;
    const prev = this.current && this.views[this.current];
    prev?.leave?.();
    if (prev) prev.el.hidden = true;
    const view = this.views[next];
    view.el.hidden = false;
    this.current = next;
    view.enter?.();
  }
}
