/**
 * Nhận diện vuốt ngang trên một phần tử. Bỏ qua khi bắt đầu trên phần tử khớp `ignore`
 * (vd. canvas 3D đang dùng thao tác xoay, thanh trượt cỡ chữ).
 * cb(direction): 1 = vuốt sang trái (tới), -1 = vuốt sang phải (lùi).
 */
export function onHorizontalSwipe(el, cb, { ignore = '', minDistance = 50 } = {}) {
  let start = null;
  const down = (e) => {
    if (!e.isPrimary || (ignore && e.target.closest(ignore))) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const up = (e) => {
    if (!start || !e.isPrimary) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = performance.now() - start.t;
    start = null;
    if (Math.abs(dx) >= minDistance && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 900) cb(dx < 0 ? 1 : -1);
  };
  const cancel = () => (start = null);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
