import guide from '../../data/guide.json';

/** Thiết bị cảm ứng (dùng ngón tay) hay chuột. */
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/**
 * Lấy câu hướng dẫn trong data/guide.json theo đường dẫn "a.b.c".
 * Nếu câu có hai bản { touch, mouse } thì tự chọn theo thiết bị.
 */
export function t(path) {
  let v = guide;
  for (const k of path.split('.')) v = v?.[k];
  if (v && typeof v === 'object' && ('touch' in v || 'mouse' in v)) v = isTouch ? v.touch : v.mouse;
  return typeof v === 'string' ? v : '';
}
