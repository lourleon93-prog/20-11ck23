const HOME_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9v11h13V9" />
    <path d="M10 20v-6h4v6" />
  </svg>`;

/**
 * Báo hiệu nút Home (khi đã xem hết một mục): nút nhấp nháy + bong bóng chữ bên cạnh.
 * Gọi lại với text = '' để tắt.
 */
export function setHomeAttention(btn, text) {
  btn.classList.toggle('is-attention', !!text);
  let bubble = btn.parentElement?.querySelector(`.home-bubble[data-for="${btn.dataset.id}"]`);
  if (!text) {
    bubble?.remove();
    return;
  }
  if (!bubble) {
    bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'home-bubble';
    bubble.dataset.for = btn.dataset.id;
    bubble.addEventListener('click', () => btn.click());
    btn.after(bubble);
  }
  bubble.textContent = text;
}

let nextId = 0;

/** Nút Home cố định góc trên bên trái. */
export function createHomeButton(onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'home-btn';
  btn.dataset.id = String(nextId++);
  btn.setAttribute('aria-label', 'Trở về trang chủ');
  btn.innerHTML = HOME_ICON;
  btn.addEventListener('click', onClick);
  return btn;
}
