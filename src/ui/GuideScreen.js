import { ICONS } from './icons.js';

/**
 * Màn hướng dẫn: tiêu đề + các thẻ (hình minh hoạ, tên, giải thích ngắn) + dòng dưới cùng.
 * Có thể dùng làm màn chờ tải: truyền `waitFor` (Promise) — trong lúc chờ, dòng dưới cùng hiện
 * tiến độ tải (gọi setProgress) và chưa đóng được; tải xong mới hiện câu "chạm khi đã hiểu".
 *
 * @param {HTMLElement} container
 * @param {{ title: string, cards: { icon: string, title: string, text: string }[], dismiss: string,
 *           waitFor?: Promise<boolean>, loadingText?: string, errorText?: string }} opts
 * @returns {{ closed: Promise<boolean>, setProgress(p: number): void }}
 *   closed: true nếu người dùng đóng sau khi tải xong, false nếu tải lỗi.
 */
export function showGuideScreen(container, { title, cards, dismiss, waitFor, loadingText = '', errorText = '' }) {
  const el = document.createElement('div');
  el.className = 'guide';
  el.innerHTML = `<div class="guide__box"><h2 class="guide__title"></h2><div class="guide__cards"></div></div>
    <div class="guide__loading" hidden><span class="guide__loading-text"></span><div class="guide__bar"><i></i></div></div>
    <p class="guide__dismiss" hidden>${ICONS.tap}<span></span></p>`;
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

  const loading = el.querySelector('.guide__loading');
  const loadingLabel = el.querySelector('.guide__loading-text');
  const bar = el.querySelector('.guide__bar i');
  const dismissEl = el.querySelector('.guide__dismiss');

  const setProgress = (p) => {
    p = Math.max(0, Math.min(1, p));
    loadingLabel.textContent = `${loadingText} ${Math.round(p * 100)}%`;
    bar.style.transform = `scaleX(${p})`;
  };

  const close = () => {
    el.classList.add('is-hidden');
    setTimeout(() => el.remove(), 400);
  };

  const closed = new Promise((resolve) => {
    const allowDismiss = () => {
      dismissEl.hidden = false;
      // Chờ một nhịp để cú chạm vừa mở màn này (hoặc chạm trong lúc tải) không đóng nó ngay
      setTimeout(() => {
        el.addEventListener(
          'click',
          () => {
            close();
            resolve(true);
          },
          { once: true },
        );
      }, 400);
    };

    if (!waitFor) return allowDismiss();
    el.classList.add('guide--loading');
    loading.hidden = false;
    setProgress(0);
    waitFor.then((ok) => {
      loading.hidden = true;
      el.classList.remove('guide--loading');
      if (ok === false) {
        loadingLabel.textContent = errorText;
        loading.hidden = !errorText;
        bar.parentElement.hidden = true;
        el.addEventListener('click', () => (close(), resolve(false)), { once: true });
        return;
      }
      allowDismiss();
    });
  });

  return { closed, setProgress };
}
