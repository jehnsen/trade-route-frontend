import type { Helper, StaffMember } from "@/types";

/** The demo clock. All "today" logic in TradeLoop is anchored here so the data stays consistent. */
export const TODAY = "2026-09-25";
export const NOW = "2026-09-25T07:48";
export const TOMORROW = "2026-09-26";

export const PLATFORM = {
  name: "TradeLoop",
  tagline: "Wholesale Trading & Logistics, Connected.",
};

export const COMPANY = {
  name: "Lucena Fresh Trading & Logistics",
  shortName: "Lucena Fresh",
  address: "Km. 134 Maharlika Highway, Brgy. Ibabang Dupay, Lucena City, Quezon 4301",
  warehouse: "Lucena Main Warehouse (Bodega)",
  phone: "(042) 710-4418",
  mobile: "0917 842 6150",
  messenger: "m.me/lucenafreshtrading",
  email: "orders@lucenafresh.ph",
  tin: "487-219-553-000",
  businessHours: "Mon–Sat, 2:00 AM – 9:00 PM",
  bankAccountMasked: "•••• •••• 2210",
  gcashMasked: "0917 ••• 6150",
};

export const STAFF: StaffMember[] = [
  { id: "ST-01", name: "Rodel Samonte", role: "owner", title: "Owner / General Manager", phone: "0917 530 2281", initials: "RS" },
  { id: "ST-02", name: "Kristine Ramos", role: "sales", title: "Sales Lead", phone: "0918 224 7710", initials: "KR" },
  { id: "ST-03", name: "Jerome Bautista", role: "sales", title: "Sales Staff (Metro Manila)", phone: "0927 611 0845", initials: "JB" },
  { id: "ST-04", name: "Aileen Macaraeg", role: "sales", title: "Sales Staff (Cavite & Laguna)", phone: "0995 402 1837", initials: "AM" },
  { id: "ST-05", name: "Noel Pascual", role: "dispatcher", title: "Dispatcher", phone: "0919 338 5402", initials: "NP" },
  { id: "ST-06", name: "Edwin Manalo", role: "procurement", title: "Procurement Officer", phone: "0928 715 3309", initials: "EM" },
  { id: "ST-07", name: "Bong Esguerra", role: "warehouse", title: "Warehouse Supervisor", phone: "0936 180 4427", initials: "BE" },
  { id: "ST-08", name: "Grace Lontoc", role: "accounting", title: "Accounting & Collections", phone: "0917 903 5518", initials: "GL" },
];

export const HELPERS: Helper[] = [
  { id: "HL-01", name: "Jun-Jun Aguilar", phone: "0946 552 1180" },
  { id: "HL-02", name: "Paolo Dimaculangan", phone: "0975 310 8826" },
  { id: "HL-03", name: "Ariel Sarmiento", phone: "0938 447 2091" },
  { id: "HL-04", name: "Rey Obispo", phone: "0966 205 7734" },
];

export const staffById = (id: string) => STAFF.find((s) => s.id === id);
export const helperById = (id: string) => HELPERS.find((h) => h.id === id);
