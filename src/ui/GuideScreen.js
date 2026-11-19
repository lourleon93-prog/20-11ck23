import { ICONS } from './icons.js';

/**
 * Màn hướng dẫn: tiêu đề + các thẻ (hình minh hoạ, tên, giải thích ngắn) + câu "chạm khi đã hiểu".
 * Đóng khi người dùng chạm/bấm vào màn hình.
 *
 * @param {HTMLElement} container
 * @param {{ title: string, cards: { icon: string, title: string, text: string }[], dismiss: string }} opts
 * @returns {Promise<void>}
 */
export function showGuideScreen(container, { title, cards, dismiss }) {
  const el = document.createElement('div');
  el.className = 'guide';
  el.innerHTML = `<div class="guide__box"><h2 class="guide__title"></h2><div class="guide__cards"></div></div>
    <p class="guide__dismiss">${ICONS.tap}<span></span></p>`;
  el.querySelector('.guide__title').textContent = title;
  el.querySelector('.guide__dismiss span').textContent = dismiss;
  el.querySelector('.guide__cards').append(
    ...cards.map((c) => {
      const card = document.createElement('div');
      card.className = 'guide__card';
      card.innerHTML = `<div class="guide__pic">${ICONS[c.icon] ?? ''}</div><div><h3></h3><p></p></div>`;
      card.querySelector('h3').textContent = c.title;
      card.querySelector('p').textContent = c.text;
      return card;
    }),
  );
  container.appendChild(el);
  return new Promise((resolve) => {
    // Chờ một nhịp để cú chạm vừa mở màn này không đóng nó ngay
    setTimeout(() => {
      el.addEventListener(
        'click',
        () => {
          el.classList.add('is-hidden');
          setTimeout(() => el.remove(), 400);
          resolve();
        },
        { once: true },
      );
    }, 400);
  });
}
