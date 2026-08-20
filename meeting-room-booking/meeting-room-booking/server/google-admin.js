/**
 * google-admin.js
 * =================================================================
 * ตัวช่วยสำหรับฟีเจอร์ "Admin cleanup" (เคลียร์การจองที่ organizer หายไปแล้ว)
 * ใช้ service account + Domain-Wide Delegation (DWD) เพื่อ:
 *   - อ่านสถานะ user (ลบ/suspend) ผ่าน Admin SDK Directory API
 *   - impersonate organizer/attendee เพื่อลบ event ให้ทุกคน (ไม่ใช่แค่ copy ของเรา)
 *
 * *** ตั้งค่า DWD scopes ใน Admin Console (Manage Domain Wide Delegation) ***
 *   ระวัง: ช่อง scope มัน OVERWRITE ไม่ append — ต้องใส่ scope เดิมรวมด้วยในบรรทัดเดียว
 *     https://www.googleapis.com/auth/calendar
 *     https://www.googleapis.com/auth/admin.directory.user.readonly
 *
 * env ที่ต้องมี:
 *   GOOGLE_SERVICE_ACCOUNT_FILE = path ไปยังไฟล์ service account (.json)
 *   GOOGLE_ADMIN_SUBJECT        = อีเมล super admin ที่จะ impersonate สำหรับ
 *                                 อ่าน directory + ลบ event ในปฏิทินห้อง
 *                                 (admin คนนี้ต้องมีสิทธิ์ "Make changes to events"
 *                                  บนปฏิทินห้อง ไม่งั้นลบ copy ของห้องจะเจอ 403)
 */
import { google } from "googleapis";
import fs from "fs";

const SA_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
const ADMIN_SUBJECT = process.env.GOOGLE_ADMIN_SUBJECT;

const SCOPE_CALENDAR = "https://www.googleapis.com/auth/calendar";
const SCOPE_DIR_USER = "https://www.googleapis.com/auth/admin.directory.user.readonly";

let _key = null;
function loadKey() {
  if (_key) return _key;
  if (!SA_FILE || !fs.existsSync(SA_FILE)) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_FILE ไม่ถูกตั้งค่า หรือหาไฟล์ไม่เจอ — ฟีเจอร์ Admin cleanup ต้องใช้ service account"
    );
  }
  _key = JSON.parse(fs.readFileSync(SA_FILE, "utf8"));
  return _key;
}

/** สร้าง JWT client ที่ impersonate `subject` ตาม scopes ที่ระบุ */
function jwtFor(subject, scopes) {
  const key = loadKey();
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes,
    subject,
  });
}

/** พร้อมใช้ไหม (ตั้งค่าครบ) */
export function isAdminConfigured() {
  return !!(SA_FILE && fs.existsSync(SA_FILE) && ADMIN_SUBJECT);
}

export function adminSubject() {
  return ADMIN_SUBJECT;
}

/** Calendar client ในนามของ user คนใดก็ได้ (organizer / attendee / admin) */
export function calendarAs(subject) {
  return google.calendar({
    version: "v3",
    auth: jwtFor(subject, [SCOPE_CALENDAR]),
  });
}

/** Directory client (ใช้ admin subject) สำหรับเช็คสถานะ user */
export function directoryAsAdmin() {
  return google.admin({
    version: "directory_v1",
    auth: jwtFor(ADMIN_SUBJECT, [SCOPE_DIR_USER]),
  });
}
