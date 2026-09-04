/**
 * DỮ LIỆU TRANG MARKETING — CÔNG THẢNH
 * ----------------------------------------------------------------
 * ⚠️ Các mảng dưới đây (PRODUCTS, PROJECTS) là DỮ LIỆU MẪU vì source hiện tại
 * chưa có dữ liệu sản phẩm/dự án thật. Thay bằng dữ liệu, hình ảnh thật của
 * công ty trước khi đưa vào sử dụng chính thức.
 */

export const COMPANY = {
  fullName: "CÔNG TY TNHH THƯƠNG MẠI SẢN XUẤT CÔNG THẢNH",
  hotline: "0908229977",
  website: "congthanhco.com",
  address: "595A Trần Hưng Đạo - P.Bình Đức - An Giang",
};

export const BRAND_PARTNERS = ["Deye", "Solis", "Dyness", "Astronergy", "Trina", "AE Solar"];

export const SOLUTIONS = [
  {
    id: "gia-dinh",
    title: "Hộ gia đình",
    range: "3 - 10 kWp",
    description: "Giảm hoá đơn tiền điện hàng tháng, chủ động nguồn điện cho sinh hoạt gia đình.",
  },
  {
    id: "doanh-nghiep",
    title: "Doanh nghiệp",
    range: "10 - 100 kWp",
    description: "Tối ưu chi phí vận hành văn phòng, cửa hàng, kho bãi với hệ thống quy mô vừa.",
  },
  {
    id: "nha-xuong",
    title: "Nhà xưởng",
    range: "100 kWp trở lên",
    description: "Giải pháp công suất lớn cho sản xuất công nghiệp, tối ưu chi phí điện giờ cao điểm.",
  },
];

export const PROCESS_STEPS = [
  { step: "01", title: "Khảo sát", description: "Đo đạc mái, phân tích hoá đơn điện và nhu cầu sử dụng thực tế." },
  { step: "02", title: "Tư vấn & thiết kế", description: "Đề xuất công suất, thiết bị và phương án tài chính phù hợp." },
  { step: "03", title: "Lắp đặt", description: "Thi công bởi đội ngũ kỹ thuật có kinh nghiệm, đúng tiến độ cam kết." },
  { step: "04", title: "Bàn giao & giám sát", description: "Nghiệm thu, hướng dẫn vận hành và giám sát hiệu suất dài hạn." },
];

/** Ảnh thật do khách hàng/công ty cung cấp. Công suất là ƯỚC TÍNH từ số tấm pin
 * nhìn thấy trong ảnh (không phải số liệu ghi nhận chính thức) — nên cập nhật lại
 * chính xác khi có hồ sơ dự án. Địa điểm để chung "miền Tây Nam Bộ" vì chưa xác nhận
 * huyện/tỉnh cụ thể. */
export const PROJECTS = [
  { id: 1, capacity: "~6-7 kWp", type: "Hộ gia đình", location: "Miền Tây Nam Bộ", image: "/images/project-household.jpg" },
  { id: 2, capacity: "~25-30 kWp", type: "Doanh nghiệp", location: "Miền Tây Nam Bộ", image: "/images/project-business.jpg" },
  { id: 3, capacity: "~10-12 kWp", type: "Nhà xưởng", location: "Miền Tây Nam Bộ", image: "/images/project-factory.jpg" },
];
