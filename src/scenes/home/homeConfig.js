/**
 * Cấu hình trang chủ (danh mục cột chỉ đường).
 * Các giá trị góc tính theo độ; azimuth 0° = camera nằm phía +Z của model (quy ước glTF "front").
 * Hướng thật của model chưa kiểm tra được (GLB đang nằm trên Git LFS) — chỉnh frontAzimuthDeg
 * nếu góc nhìn ban đầu không đúng mặt trước.
 */
export const HOME_CONFIG = {
  model: 'models/Home.glb',

  // Tên mesh biển hiệu -> mục tương ứng
  signs: [
    { mesh: 'Untitled61_20261117005643', section: 'history', label: 'Lịch sử và ý nghĩa ngày 20/11' },
    { mesh: 'Untitled61_20261117005631', section: 'school', label: 'Thanh xuân có thầy cô' },
    { mesh: 'Untitled61_20261117005624', section: 'crystal', label: 'Tinh thể kí ức' },
  ],

  frontAzimuthDeg: 0,
  azimuthRangeDeg: 200, // tổng biên độ xoay ngang, chia đều hai phía của mặt trước

  initialPolarDeg: 72, // 90° = ngang tầm mắt, nhỏ hơn = nhìn từ trên xuống
  polarMinDeg: 30,
  polarMaxDeg: 88, // không cho nhìn từ dưới chân model lên

  // Giới hạn zoom: bội số của khoảng cách vừa khung hình ban đầu
  zoomMin: 0.55,
  zoomMax: 1.5,
  fitPadding: 1.08,

  focus: {
    duration: 1.6, // giây
    fill: 0.75, // tỉ lệ biển chiếm khung hình khi focus
  },
};
