const HOME_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-6h4v6" />
  </svg>`;

/** Nút Home cố định góc trên bên trái. */
export function createHomeButton(onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'home-btn';
  btn.setAttribute('aria-label', 'Trở về trang chủ');
  btn.innerHTML = HOME_ICON;
  btn.addEventListener('click', onClick);
  return btn;
}
