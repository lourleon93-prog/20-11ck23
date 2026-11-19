import { assetUrl } from '../../core/AssetLoader.js';

// Biên độ hiệu ứng parallax khi nghiêng tối đa
const SHIFT_X = 6; // % chiều rộng khung
const SHIFT_Y = 3; // % chiều cao khung
const ROTATE = 10; // độ — tạo biến dạng phối cảnh, không chỉ trượt theo một trục

/**
 * Ảnh nhiều lớp phản ứng theo độ nghiêng điện thoại.
 * Lớp có hậu tố số nhỏ nằm xa màn hình (dưới cùng), số lớn nằm gần (trên cùng).
 * motion: 0 = đứng yên, 1 = di chuyển theo hướng nghiêng, -1 = ngược hướng nghiêng.
 */
export class ParallaxSlide {
  constructor({ layers }) {
    this.el = document.createElement('div');
    this.el.className = 'slide slide--parallax';
    const frame = document.createElement('div');
    frame.className = 'parallax';
    this.el.appendChild(frame);

    this.moving = [];
    layers.forEach((layer, i) => {
      const img = document.createElement('img');
      img.className = 'parallax__layer';
      img.src = assetUrl(layer.src);
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      img.style.zIndex = i;
      if (i === 0) {
        img.addEventListener('load', () => frame.style.setProperty('--ratio', img.naturalWidth / img.naturalHeight), {
          once: true,
        });
      }
      frame.appendChild(img);
      if (layer.motion) this.moving.push({ img, motion: layer.motion });
    });
  }

  /** x, y trong [-1, 1]; x < 0 = nghiêng trái. */
  update(x, y) {
    for (const { img, motion } of this.moving) {
      const m = motion;
      img.style.transform =
        `translate3d(${(m * x * SHIFT_X).toFixed(3)}%, ${(m * y * SHIFT_Y).toFixed(3)}%, 0) ` +
        `rotateY(${(m * x * ROTATE).toFixed(3)}deg) rotateX(${(-m * y * ROTATE * 0.6).toFixed(3)}deg)`;
    }
  }
}

/** Một ảnh tĩnh căn giữa vùng hiển thị. */
export class ImageSlide {
  constructor({ src, alt = '' }) {
    this.el = document.createElement('div');
    this.el.className = 'slide slide--image';
    const img = document.createElement('img');
    img.src = assetUrl(src);
    img.alt = alt;
    img.draggable = false;
    img.decoding = 'async';
    this.el.appendChild(img);
  }
}

/** Vị trí đặt khung xem 3D dùng chung (ModelViewer được gắn vào khi slide đang hiện). */
export class ModelSlide {
  constructor({ model, view }) {
    this.model = model;
    this.view = view;
    this.el = document.createElement('div');
    this.el.className = 'slide slide--model';
  }
}

export function createSlide(media) {
  if (media.type === 'parallax') return new ParallaxSlide(media);
  if (media.type === 'image') return new ImageSlide(media);
  if (media.type === 'model') return new ModelSlide(media);
  throw new Error(`Loại media không hỗ trợ: ${media.type}`);
}
