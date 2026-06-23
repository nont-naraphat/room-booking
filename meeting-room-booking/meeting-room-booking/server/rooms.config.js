/**
 * Room configuration
 * =================================================================
 * แต่ละห้องต้องใส่ `resourceEmail` ให้ตรงกับ Resource ใน Google Workspace
 *
 * วิธีหา resourceEmail:
 *   1) เปิด Google Admin (admin.google.com)
 *   2) Buildings and resources > Manage resources
 *   3) คลิกที่ห้อง > จะเห็น "Resource email" หน้าตาประมาณ
 *        c_xxxxxxxxxxxxxxxxxxxxxx@resource.calendar.google.com
 *   4) ก๊อปมาวางในช่อง resourceEmail ด้านล่าง
 *
 * (อีกวิธี: เปิด Google Calendar > สร้าง event > ช่อง "Rooms" > เลือกห้อง
 *  แล้วดู email ของห้องนั้น)
 *
 * capacity / features ใส่เองได้ตามจริง ใช้แสดงผลใน UI เฉยๆ
 */

export const ROOMS = [
  // ---- Center Kitchen, ชั้น 1 ----
  {
    id: "ck-1",
    name: "CK-1",
    building: "Center Kitchen",
    floor: "fl.1",
    capacity: 8,
    features: ["TV", "Whiteboard"],
    resourceEmail: "REPLACE_ME_CK1@resource.calendar.google.com",
  },
  {
    id: "ck-2",
    name: "CK-2",
    building: "Center Kitchen",
    floor: "fl.1",
    capacity: 6,
    features: ["TV"],
    resourceEmail: "REPLACE_ME_CK2@resource.calendar.google.com",
  },

  // ---- BH, ชั้น 17 ----
  {
    id: "dubai",
    name: "Dubai",
    building: "BH",
    floor: "fl.17",
    capacity: 12,
    features: ["TV", "Video conference", "Whiteboard"],
    resourceEmail: "REPLACE_ME_DUBAI@resource.calendar.google.com",
  },
  {
    id: "frankfurt",
    name: "Frankfurt",
    building: "BH",
    floor: "fl.17",
    capacity: 10,
    features: ["TV", "Video conference"],
    resourceEmail: "REPLACE_ME_FRANKFURT@resource.calendar.google.com",
  },
  {
    id: "new-york",
    name: "New York",
    building: "BH",
    floor: "fl.17",
    capacity: 8,
    features: ["TV"],
    resourceEmail: "REPLACE_ME_NEWYORK@resource.calendar.google.com",
  },
  {
    id: "shanghai",
    name: "Shanghai",
    building: "BH",
    floor: "fl.17",
    capacity: 6,
    features: ["TV"],
    resourceEmail: "REPLACE_ME_SHANGHAI@resource.calendar.google.com",
  },
  {
    id: "sydney",
    name: "Sydney",
    building: "BH",
    floor: "fl.17",
    capacity: 4,
    features: ["TV"],
    resourceEmail: "REPLACE_ME_SYDNEY@resource.calendar.google.com",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    building: "BH",
    floor: "fl.17",
    capacity: 4,
    features: ["Whiteboard"],
    resourceEmail: "REPLACE_ME_TOKYO@resource.calendar.google.com",
  },
];

// helper maps
export const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const roomByEmail = Object.fromEntries(
  ROOMS.map((r) => [r.resourceEmail.toLowerCase(), r])
);
