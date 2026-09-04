import fs from "fs";
import path from "path";

/**
 * ⚠️ Cùng lưu ý như catalog-store.ts: cần Railway Volume mount vào /app/data
 * để danh sách dự án và ảnh upload không bị mất khi deploy lại.
 */

export interface ProjectEntry {
  id: string;
  capacity: string;
  type: string;
  location: string;
  imageUrl: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const DEFAULT_PROJECTS: ProjectEntry[] = [
  { id: "p1", capacity: "~6-7 kWp", type: "Hộ gia đình", location: "Miền Tây Nam Bộ", imageUrl: "/images/project-household.jpg" },
  { id: "p2", capacity: "~25-30 kWp", type: "Doanh nghiệp", location: "Miền Tây Nam Bộ", imageUrl: "/images/project-business.jpg" },
  { id: "p3", capacity: "~10-12 kWp", type: "Nhà xưởng", location: "Miền Tây Nam Bộ", imageUrl: "/images/project-factory.jpg" },
];

export function getProjects(): ProjectEntry[] {
  try {
    if (!fs.existsSync(PROJECTS_PATH)) {
      saveProjects(DEFAULT_PROJECTS);
      return DEFAULT_PROJECTS;
    }
    const raw = fs.readFileSync(PROJECTS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PROJECTS;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export function saveProjects(projects: ProjectEntry[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(projects, null, 2), "utf-8");
}

export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
