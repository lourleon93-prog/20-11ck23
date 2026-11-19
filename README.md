# CK23 – Chào mừng ngày Nhà giáo Việt Nam 20/11

Website 3D cho điện thoại (Vite + Three.js). Yêu cầu chi tiết: xem `PROJECT_SPEC.md`.

---

## 1. Chạy thử trên máy tính

Cần cài: [Node.js](https://nodejs.org) (bản 20 trở lên) và [Git LFS](https://git-lfs.com).

```bash
git lfs install
git lfs pull
npm install
npm run dev
```

Mở địa chỉ `http://localhost:5173` mà terminal in ra.

- Muốn xem trên **điện thoại cùng mạng Wi-Fi**: mở địa chỉ `Network: http://192.168.x.x:5173` mà terminal in ra.
  Lưu ý: hiệu ứng **nghiêng điện thoại** (mốc 1953, 1957) chỉ chạy trên **HTTPS**, nên khi mở bằng
  địa chỉ `http://` trên điện thoại sẽ không nghiêng được — hãy thử bằng link GitHub Pages (mục 4).
  Trên máy tính, di chuột để mô phỏng việc nghiêng.
- Kiểm tra bản build hoàn chỉnh: `npm run build` rồi `npm run preview`.

## 2. Nhập nội dung

Tất cả nội dung chữ nằm trong thư mục `data/`, định dạng JSON. Chỉ sửa phần chữ **trong dấu ngoặc kép
bên phải**, giữ nguyên tên trường bên trái, dấu `:` và dấu `,`. Muốn xuống dòng trong nội dung, gõ `\n`.
Trong nội dung muốn có dấu ngoặc kép thì dùng “ ” (ngoặc kép cong) hoặc gõ `\"`.

Sau khi sửa, trang đang mở bằng `npm run dev` sẽ tự cập nhật.

Nếu file nội dung bị lỗi định dạng, `npm run dev` / `npm run build` (và lượt đăng web trong tab Actions) sẽ dừng
và báo rõ **file nào, dòng nào, cột nào** bị lỗi. Có thể tự kiểm tra bất cứ lúc nào bằng `npm run check-content`.
Lỗi hay gặp nhất: dùng dấu ngoặc kép thẳng `"` bên trong nội dung — hãy dùng “ ”.

### Mục 1 – `data/history.json`

```json
{
  "intro": "Câu hiện ở lớp hướng dẫn khi vào Mục 1",
  "milestones": [
    {
      "id": "1953",                 ← mã nội bộ, không cần sửa
      "title": "1953",              ← MỐC THỜI GIAN (in đậm, giữa phía trên khung nội dung)
      "body": "Nội dung …",         ← NỘI DUNG của mốc
      "media": { … }                ← ảnh/mô hình của mốc, không cần sửa
    },
    …
  ]
}
```

Thứ tự các mốc trên web = thứ tự trong file. Mốc cuối (`"id": "meaning"`) là phần **Ý nghĩa**.

### Mục 2 – các quả cầu: `data/Mball.json`, `data/Mball.001.json`, `data/Mball.002.json`

```json
{
  "title": "Tên quả cầu",           ← tiêu đề trên màn hình danh sách ảnh
  "photos": [
    {
      "src": "images/Mball/dt1.jpg", ← đường dẫn ảnh (thư mục images/…)
      "title": "Tiêu đề ảnh",        ← in đậm
      "body": "Nội dung ảnh"
    },
    …
  ]
}
```

Thêm ảnh: chép ảnh vào thư mục `images/Mball…/` tương ứng, rồi thêm một khối `{ "src": …, "title": …, "body": … }`
vào danh sách `photos` (các khối cách nhau bằng dấu phẩy).

Khu vực tưởng nhớ thầy – `data/Mball.003.json`: chữ trên các nút (`offerButton` – “Dâng hoa”,
`offeredButton` – sau khi dâng, `backButton` – nút về sân trường).

### Mục 3 – `data/crystal.json`

```json
{
  "hint": "Gợi ý khi thấy khối tinh thể",
  "latticeHint": "Gợi ý khi vào mạng tinh thể",
  "ending": { "title": "Tiêu đề phần kết", "body": "Nội dung phần kết" },
  "photos": [
    { "src": "images/class/2010.jpg", "title": "Tiêu đề ảnh", "body": "Nội dung ảnh" },
    …
  ]
}
```

Mỗi ảnh là một “nguyên tử” trong mạng tinh thể. Thêm ảnh vào `photos` thì mạng tinh thể tự lớn thêm.

### Câu hướng dẫn trên màn hình – `data/guide.json`

Mọi câu hướng dẫn (lớp hướng dẫn, dòng gợi ý, màn “Cách tham quan sân trường”, bong bóng ở nút Home…) nằm ở đây.
Câu nào có hai bản thì `"touch"` dùng cho điện thoại (chạm, chụm ngón), `"mouse"` dùng cho máy tính (bấm, cuộn chuột).

## 3. Các thông số có thể chỉnh

| File | Ý nghĩa |
|---|---|
| `src/scenes/home/homeConfig.js` | Trang chủ: biển nào dẫn tới mục nào, góc nhìn ban đầu, giới hạn xoay/zoom |
| `data/history.json` → `media.view` | Góc xoay/zoom của mô hình 1958 và Ý nghĩa |
| `src/scenes/school/schoolConfig.js` | Mục 2: model, HDRI, kích thước quả cầu/chấm, giới hạn ở phòng tưởng nhớ, `mobileMaxTextureSize` |
| `data/waypoints.json` | Toạ độ và liên kết các waypoint (trùng với các điểm `wp.*` trong CQT.glb) |

Nếu điện thoại bị tải lại trang hoặc thoát khi vào Mục 2, giảm `mobileMaxTextureSize` từ `2048` xuống `1024`.

## 4. Đưa lên mạng (GitHub Pages)

1. Trên GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Đưa code lên nhánh `main`. Workflow `.github/workflows/deploy.yml` sẽ tự build và đăng.
   Có thể chạy tay ở tab **Actions → Deploy GitHub Pages → Run workflow**.
3. Link web có dạng `https://<tên-tài-khoản>.github.io/20-11ck23/`.

Lưu ý hạn mức Git LFS miễn phí của GitHub (khoảng 1 GB băng thông/tháng): mỗi lần build tải khoảng 270 MB
model, nên hạn chế build lại liên tục.

## 5. Model 3D

- `models/` – bản gốc (không sửa).
- `models/optimized/` – bản tối ưu dùng trên web, giữ nguyên ngoại hình:
  - `CQT.glb` (sân trường), `Thayy.glb` (phòng tưởng nhớ – máy tính), `Thayy.mobile.glb` (phòng tưởng nhớ – điện thoại), `flower.glb`.
  - Gộp dữ liệu trùng, ảnh WebP (giữ độ phân giải), nén hình khối Meshopt, instancing cho vật lặp lại.
  - Chỉ giảm tam giác ở mesh cực dày (≥ 100 000 tam giác, vd. hoa trang trí, tán cây) với sai số dưới nửa điểm ảnh
    tại vị trí camera gần nhất có thể; đường viền hở (chữ, cánh hoa) được khoá nguyên.
  - Cột cổng bên phải (Mirror modifier chưa apply trong file gốc) được tạo lại bằng phép đối xứng gương của cột trái.
- Khi sửa model trong Blender (nhớ **apply modifier** trước khi xuất), tạo lại bản tối ưu bằng
  `scripts/models/optimize.mjs` — cách chạy ghi ở đầu file đó.
