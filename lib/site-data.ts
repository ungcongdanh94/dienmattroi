/**
 * DỮ LIỆU TRANG MARKETING — CÔNG THẢNH
 * ----------------------------------------------------------------
 * ⚠️ SOLUTIONS/PROCESS bên dưới vẫn là nội dung cố định trong code.
 * Dự án đã thực hiện giờ quản lý qua /admin (xem lib/projects-store.ts).
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

/** Dự án đã thực hiện giờ được quản lý qua /admin (lib/projects-store.ts + /api/projects),
 * không còn dùng dữ liệu tĩnh ở đây nữa. */
