/**
 * Cấu hình trang chủ (danh mục cột chỉ đường).
 * Các giá trị góc tính theo độ; azimuth 0° = camera nằm phía +Z của model.
 *
 * Đã kiểm tra trên models/Home.glb: mỗi biển là 1 mặt phẳng ảnh (4 đỉnh, vật liệu hai mặt)
 * gắn trên một tấm bảng; mặt đọc được nằm theo chiều pháp tuyến của mặt phẳng.
 */
export const HOME_CONFIG = {
  model: 'models/Home.glb',

  // Tên mesh biển hiệu -> mục tương ứng
  signs: [
    { mesh: 'Untitled61_20261117005643', section: 'history', label: 'Lịch sử và ý nghĩa ngày 20/11' },
    { mesh: 'Untitled61_20261117005631', section: 'school', label: 'Thanh xuân có thầy cô' },
    { mesh: 'Untitled61_20261117005624', section: 'crystal', label: 'Tinh thể kí ức' },
  ],

  // 'auto' = đặt giữa cung nhỏ nhất chứa mặt đọc được của cả 3 biển (tính từ model),
  // hoặc nhập số độ để cố định.
  frontAzimuthDeg: 'auto',
  azimuthRangeDeg: 200, // tổng biên độ xoay ngang, chia đều hai phía của mặt trước

  // Góc nhìn ban đầu: nhìn thẳng vào mặt biển của mục này (vẫn nằm trong vùng xoay).
  // Đặt null để bắt đầu ở giữa vùng xoay.
  initialSection: 'history',

  // Hướng mũi tên gợi ý vuốt: 'auto' = chỉ về phía còn nhiều góc xoay hơn tính từ góc ban đầu,
  // 'right' = vuốt trái -> phải, 'left' = vuốt phải -> trái.
  swipeHintDirection: 'auto',

  // 'signs' = khung hình ôm cụm biển hiệu; 'model' = ôm toàn bộ model (cả chân cột)
  frameOn: 'signs',

  initialPolarDeg: 72, // 90° = ngang tầm mắt, nhỏ hơn = nhìn từ trên xuống
  polarMinDeg: 30,
  polarMaxDeg: 88, // không cho nhìn từ dưới chân model lên

  // Giới hạn zoom: bội số của khoảng cách vừa khung hình ban đầu
  zoomMin: 0.55,
  zoomMax: 1.5,
  fitPadding: 1.15,

  // Chạm vào tấm bảng quanh ảnh cũng tính là chọn biển: hệ số nới vùng chạm theo kích thước ảnh
  hitSlack: 0.8,

  // Vuốt xuống thêm đoạn này (px) khi camera đã chạm giới hạn góc trên -> cuộn về tiêu đề
  scrollBackPx: 60,

  focus: {
    duration: 1.6, // giây
    fill: 0.62, // tỉ lệ ảnh biển chiếm khung hình khi focus (chừa chỗ cho viền bảng)
  },
};
