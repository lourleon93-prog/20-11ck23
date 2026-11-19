// Biểu tượng hướng dẫn (SVG nội tuyến, dùng currentColor). Có lớp CSS chuyển động đi kèm (ui.css).

const svg = (body, cls = '') =>
  `<svg class="gicon ${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// Bàn tay chỉ một ngón
const HAND = `<path d="M20 30V13a3 3 0 0 1 6 0v12"/><path d="M26 24a3 3 0 0 1 6 0v3"/><path d="M32 26a3 3 0 0 1 6 0v6c0 7-5 12-11 12h-2c-4 0-6-2-9-5l-5-6a3 3 0 0 1 4-4l3 3"/>`;

export const ICONS = {
  /** Chạm */
  tap: svg(`<g class="gicon__tap">${HAND}</g><circle class="gicon__ripple" cx="23" cy="10" r="5"/>`, 'gicon--tap'),
  /** Vuốt ngang (trái/phải) */
  swipe: svg(
    `<path d="M6 8h36M6 8l5-4M6 8l5 4M42 8l-5-4M42 8l-5 4"/><g class="gicon__slide" transform="translate(0 3)">${HAND}</g>`,
    'gicon--swipe',
  ),
  /** Kéo để xoay */
  rotate: svg(
    `<path d="M10 12a17 17 0 0 1 28 0"/><path d="M38 12l-1-6M38 12l-6 1"/><g class="gicon__slide" transform="translate(0 3)">${HAND}</g>`,
    'gicon--swipe',
  ),
  /** Chụm hai ngón để phóng to */
  pinch: svg(
    `<g class="gicon__pinch"><circle cx="16" cy="24" r="4"/><circle cx="32" cy="24" r="4"/></g><path d="M5 24h4M39 24h4M7 21l-2 3 2 3M41 21l2 3-2 3"/>`,
    'gicon--pinch',
  ),
  /** Nghiêng điện thoại */
  tilt: svg(`<g class="gicon__tilt"><rect x="16" y="6" width="16" height="30" rx="3"/><path d="M22 31h4"/></g><path d="M8 40c5 3 11 4 16 4s11-1 16-4"/>`, 'gicon--tilt'),
  /** Chuột */
  mouse: svg(`<rect x="15" y="6" width="18" height="30" rx="9"/><path class="gicon__wheel" d="M24 12v6"/>`, 'gicon--mouse'),
  /** Chấm sáng waypoint */
  waypoint: `<span class="gicon gicon--waypoint" aria-hidden="true"><i></i></span>`,
  /** Quả cầu kỉ niệm */
  sphere: `<span class="gicon gicon--sphere" aria-hidden="true"><i></i></span>`,
};
