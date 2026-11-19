// Kiểm tra các file nội dung trong data/ trước khi build: báo rõ file, dòng, cột khi JSON bị lỗi
// và cảnh báo ảnh được khai báo nhưng không tồn tại.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'data';
let failed = false;

function locate(text, message) {
  const m = /position (\d+)/.exec(message) || /line (\d+) column (\d+)/.exec(message);
  if (!m) return '';
  let line, col;
  if (m.length === 3) [line, col] = [Number(m[1]), Number(m[2])];
  else {
    const before = text.slice(0, Number(m[1]));
    line = before.split('\n').length;
    col = before.length - before.lastIndexOf('\n');
  }
  const src = text.split('\n')[line - 1] ?? '';
  const start = Math.max(0, col - 40);
  return ` (dòng ${line}, cột ${col})\n    …${src.slice(start, col + 40)}…\n    ${' '.repeat(col - start + 1)}^`;
}

function collectImages(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => collectImages(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'src' && typeof v === 'string') out.push(v);
      else collectImages(v, out);
    }
  }
  return out;
}

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const path = join(DIR, file);
  const text = readFileSync(path, 'utf8');
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    failed = true;
    console.error(`✗ ${path}: lỗi định dạng JSON${locate(text, err.message)}`);
    console.error('    Gợi ý: trong nội dung, dùng ngoặc kép cong “ ” thay cho " (hoặc gõ \\").');
    continue;
  }
  for (const src of collectImages(json)) {
    if (!existsSync(src)) console.warn(`! ${path}: không tìm thấy ảnh "${src}"`);
  }
}

if (failed) {
  console.error('\nNội dung có lỗi — sửa các file trên rồi chạy lại.');
  process.exit(1);
}
console.log('✓ Nội dung trong data/ hợp lệ');
