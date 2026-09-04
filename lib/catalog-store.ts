import fs from "fs";
import path from "path";
import type { EquipmentCatalog } from "./catalog-types";

/**
 * ⚠️ LƯU Ý QUAN TRỌNG VỀ LƯU TRỮ:
 * File này lưu bảng giá vào data/catalog.json trên ổ đĩa của container Railway.
 * Container Railway mặc định KHÔNG lưu dữ liệu qua các lần deploy lại (ephemeral) —
 * nghĩa là nếu deploy code mới (git push), bảng giá admin đã nhập sẽ bị mất, quay về
 * mặc định ban đầu.
 *
 * ĐỂ BẢNG GIÁ KHÔNG BỊ MẤT: vào Railway → Service → Settings → Volumes → thêm 1 Volume,
 * mount vào đường dẫn /app/data. Sau đó dữ liệu sẽ được giữ nguyên qua các lần deploy.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");

const DEFAULT_CATALOG: EquipmentCatalog = {
  panels: [
    { id: "aiko-655", brand: "AIKO", wattage: 655, lengthMm: 2382, widthMm: 1134, priceVnd: 0 },
    { id: "leapton-715", brand: "LEAPTON", wattage: 715, lengthMm: 2384, widthMm: 1303, priceVnd: 0 },
  ],
  inverters: [
    { id: "solis-3", brand: "Solis", capacityKw: 3, priceVnd: 0 },
    { id: "solis-5", brand: "Solis", capacityKw: 5, priceVnd: 0 },
    { id: "solis-6", brand: "Solis", capacityKw: 6, priceVnd: 0 },
    { id: "solis-8", brand: "Solis", capacityKw: 8, priceVnd: 0 },
    { id: "solis-10", brand: "Solis", capacityKw: 10, priceVnd: 0 },
    { id: "sofar-3", brand: "Sofar", capacityKw: 3, priceVnd: 0 },
    { id: "sofar-5", brand: "Sofar", capacityKw: 5, priceVnd: 0 },
    { id: "sofar-6", brand: "Sofar", capacityKw: 6, priceVnd: 0 },
    { id: "sofar-8", brand: "Sofar", capacityKw: 8, priceVnd: 0 },
    { id: "sofar-10", brand: "Sofar", capacityKw: 10, priceVnd: 0 },
  ],
  batteries: [
    { id: "dyness-14336", brand: "Dyness", moduleKwh: 14.336, priceVnd: 0 },
    { id: "sofar-16", brand: "Sofar", moduleKwh: 16, priceVnd: 0 },
  ],
  otherPricing: {
    framePerKwpApMai: 0,
    framePerKwpGiaDoNghieng: 0,
    dcCablePerMeter: 0,
    acCablePerMeter: 0,
    acDcCabinetPrice: 0,
    laborPerKwp: 0,
    shippingPerTrip: 0,
  },
};

export function getCatalog(): EquipmentCatalog {
  try {
    if (!fs.existsSync(CATALOG_PATH)) {
      saveCatalog(DEFAULT_CATALOG);
      return DEFAULT_CATALOG;
    }
    const raw = fs.readFileSync(CATALOG_PATH, "utf-8");
    return JSON.parse(raw) as EquipmentCatalog;
  } catch {
    return DEFAULT_CATALOG;
  }
}

export function saveCatalog(catalog: EquipmentCatalog): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");
}
