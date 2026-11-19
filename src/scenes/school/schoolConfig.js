/**
 * Cấu hình Mục 2 – Thanh xuân có thầy cô.
 * Đã kiểm tra trên model: waypoint wp.* và điểm Mball* trong CQT.glb trùng toạ độ với
 * data/waypoints.json; Mball* là node rỗng (metaball của Blender không xuất ra glTF)
 * nên quả cầu được vẽ bằng code tại đúng vị trí đó.
 */
export const SCHOOL_CONFIG = {
  // Bản nén giữ nguyên hình dạng (bản gốc vẫn ở models/)
  model: 'models/optimized/CQT.glb',
  hdri: 'kloofendal_48d_partly_cloudy_puresky_1k.exr',
  exposure: 1,

  // Trên điện thoại: texture lớn hơn mức này được thu nhỏ khi tải để không vượt bộ nhớ GPU.
  // Máy tính giữ nguyên độ phân giải gốc. Nếu điện thoại bị tải lại trang/crash, giảm xuống 1024.
  mobileMaxTextureSize: 2048,
  mobileMaxPixelRatio: 1.5,

  startWaypoint: 'wp.',
  cameraFov: 65,

  spheres: [
    { node: 'Mball', type: 'gallery', data: 'Mball', color: 0xffc66b },
    { node: 'Mball.001', type: 'gallery', data: 'Mball.001', color: 0xffc66b },
    { node: 'Mball.002', type: 'gallery', data: 'Mball.002', color: 0xffc66b },
    { node: 'Mball.003', type: 'memorial', data: 'Mball.003', color: 0xcfd8ff },
  ],
  sphereRadius: 0.028,
  sphereFocusDistance: 0.16, // khoảng cách camera tới quả cầu khi focus

  markerSize: 0.03,

  memorial: {
    model: 'models/optimized/Thayy.glb',
    flower: 'models/optimized/flower.glb',
    photoMesh: 'FB_IMG_1794075035707', // ảnh người thầy — camera focus vào đây
    fill: 0.5, // tỉ lệ ảnh chiếm khung hình
    azimuthRangeDeg: 50, // xoay ngang giới hạn
    polarRangeDeg: 24, // xoay dọc giới hạn quanh tầm mắt
    zoomMin: 0.65,
    zoomMax: 1.3,
    damping: 0.025, // càng nhỏ càng "trễ"
  },
};
