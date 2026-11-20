/**
 * Cấu hình Mục 2 – Thanh xuân có thầy cô.
 * Đã kiểm tra trên model: waypoint wp.* và điểm Mball* trong CQT.glb trùng toạ độ với
 * data/waypoints.json; Mball* là node rỗng (metaball của Blender không xuất ra glTF)
 * nên quả cầu được vẽ bằng code tại đúng vị trí đó.
 */
export const SCHOOL_CONFIG = {
  // Bản tối ưu giữ nguyên ngoại hình (bản gốc vẫn ở models/), tạo bằng scripts/models/optimize.mjs.
  // Bản .mobile (nếu có) có sai số hình học dưới nửa điểm ảnh trên màn hình điện thoại.
  model: { desktop: 'models/optimized/CQT.glb', mobile: 'models/optimized/CQT.mobile.glb' },
  hdri: 'kloofendal_48d_partly_cloudy_puresky_1k.exr',
  exposure: 1,

  // Trên điện thoại: texture lớn hơn mức này được thu nhỏ khi tải để không vượt bộ nhớ GPU.
  // Máy tính giữ nguyên độ phân giải gốc. Nếu điện thoại bị tải lại trang/crash, giảm xuống 1024.
  mobileMaxTextureSize: 2048,
  mobileMaxPixelRatio: 1.5,
  mobileMotionPixelRatio: 1, // độ phân giải lúc đang di chuyển/xoay trên điện thoại (đứng yên thì nét lại)

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
    model: { desktop: 'models/optimized/Thayy.glb', mobile: 'models/optimized/Thayy.mobile.glb' },
    flower: 'models/optimized/flower.glb',
    photoMesh: 'FB_IMG_1794075035707', // ảnh người thầy — camera focus vào đây
    wallMesh: 'Plane.003', // bức tường treo ảnh: khung hình không được vượt ra ngoài tường này
    floorMesh: 'Plane', // sàn: phía dưới tường được phép thấy sàn
    frameMeshes: ['Legs and Rails_0', 'Table Top_0'], // ảnh + bàn là vùng cần thấy khi mới vào
    fov: 40,
    fill: 0.88, // tỉ lệ vùng ảnh + bàn chiếm khung hình
    wallMargin: 0.06, // chừa mép tường (đơn vị model)
    azimuthRangeDeg: 40, // xoay ngang giới hạn
    polarRangeDeg: 20, // xoay dọc giới hạn quanh tầm mắt
    zoomMin: 0.6, // phóng to tối đa (bội số khoảng cách ban đầu); không thu nhỏ hơn ban đầu
    damping: 0.025, // càng nhỏ càng "trễ"
  },
};
