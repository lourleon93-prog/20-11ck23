# CLAUDE.md — CK23 Website

## 1. Project Overview

CK23 là website mobile tương tác 3D nhân dịp Ngày Nhà giáo Việt Nam 20/11.

Tài liệu mô tả yêu cầu chính thức của dự án nằm tại `PROJECT_SPEC.md`.

Trước khi triển khai bất kỳ chức năng nào, hãy đọc tài liệu này và kiểm tra tài nguyên hiện có.

## 2. Working Principles

- Ưu tiên dùng tài nguyên có sẵn.
- Không tự ý thay đổi thiết kế đã được duyệt.
- Không xóa, đổi tên hoặc di chuyển asset nếu chưa được cho phép.
- Không tự ý cài dependency mới.
- Không viết toàn bộ logic vào một file.
- Không triển khai nhiều phân hệ lớn cùng lúc.
- Không tự đưa ra giả định về tọa độ, kích thước hoặc hướng của model khi chưa kiểm tra.

## 3. Technical Principles

- Vite được sử dụng làm công cụ phát triển và build.
- Three.js phụ trách các nội dung 3D.
- HTML/CSS phụ trách giao diện 2D.
- JavaScript quản lý logic, trạng thái và tương tác.
- GLB là định dạng model 3D chính.
- JSON được sử dụng cho dữ liệu có cấu trúc như waypoint và nội dung.
- Thiết kế ưu tiên trải nghiệm trên điện thoại.
- Tối ưu tài nguyên GPU, texture, draw calls và bộ nhớ.

## 4. Architecture

Duy trì kiến trúc module rõ ràng.

Các thành phần nên được tách biệt:
- Core systems.
- Scene management.
- Camera management.
- Asset management.
- Interaction systems.
- UI components.
- Individual website scenes.

Không tạo module rỗng nếu chưa có nhu cầu thực tế.

## 5. Implementation Workflow

Với mỗi nhiệm vụ:

1. Đọc yêu cầu và các file liên quan.
2. Khảo sát tài nguyên cần sử dụng.
3. Đưa ra phương án triển khai.
4. Chỉ chỉnh sửa sau khi được duyệt.
5. Kiểm tra lỗi build và console.
6. Báo cáo những file đã thay đổi.
7. Nêu rõ các chức năng đã kiểm tra và chưa kiểm tra.

## 6. Important Restrictions

- Không tự ý thay đổi nội dung trong PROJECT_SPEC.md.
- Không triển khai chức năng ngoài phạm vi nhiệm vụ.
- Không sửa trực tiếp asset gốc.
- Không tuyên bố đã kiểm thử trên thiết bị thật nếu chưa thực hiện.
- Khi gặp vấn đề chưa rõ, hãy hỏi người dùng thay vì tự giả định.

## 7. Communication

Giải thích ngắn gọn:
- Phương án kỹ thuật.
- Lý do lựa chọn.
- Những file cần thay đổi.
- Các rủi ro có thể xảy ra.

Ưu tiên giải pháp dễ bảo trì, dễ mở rộng và phù hợp với quy mô dự án CK23.