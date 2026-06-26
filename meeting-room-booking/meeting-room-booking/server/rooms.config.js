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
    resourceEmail: "c_1886m7dlqsfhiik4l0vmdj6g4guvg@resource.calendar.google.com",
  },
  {
    id: "ck-2",
    name: "CK-2",
    building: "Center Kitchen",
    floor: "fl.1",
    capacity: 6,
    features: ["TV"],
    resourceEmail: "c_18830j4lserh0j31hv8q3iojdpaei@resource.calendar.google.com",
  },

  // ---- Bearhouse and Sunsu, Rasa Two ชั้น 17 ----
  {
    id: "dubai",
    name: "Dubai",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 4,
    features: ["TV", "Video conference", "Whiteboard"],
    resourceEmail: "c_1882t2scrcaj8g2tl136hlpm7e3fa@resource.calendar.google.com",
  },
  {
    id: "frankfurt",
    name: "Frankfurt",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 10,
    features: ["TV", "Video conference"],
    resourceEmail: "c_1889njakah0uei6iis66ivug7h6uo@resource.calendar.google.com",
  },
  {
    id: "new-york",
    name: "New York",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 3,
    features: ["TV"],
    resourceEmail: "c_1881v31e1dq3ahgllk70ofn5nddk0@resource.calendar.google.com",
  },
  {
    id: "shanghai",
    name: "Shanghai",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 20,
    features: ["TV"],
    resourceEmail: "c_188atdsqj57i2h5ii57hjnq82tuge@resource.calendar.google.com",
  },
  {
    id: "sydney",
    name: "Sydney",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 8,
    features: ["TV"],
    resourceEmail: "c_1882uphqv6ijiid2j5dsjk903r7qi@resource.calendar.google.com",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    building: "Bearhouse and Sunsu",
    floor: "Rasa Two ชั้น 17",
    capacity: 8,
    features: ["Whiteboard"],
    resourceEmail: "c_1888c47vlr34aimqic0eobs1bbjb2@resource.calendar.google.com",
  },
];

// helper maps
export const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const roomByEmail = Object.fromEntries(
  ROOMS.map((r) => [r.resourceEmail.toLowerCase(), r])
);
