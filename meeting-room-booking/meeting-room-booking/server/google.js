import { google } from "googleapis";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

// Scopes:
//  - openid/email/profile : รู้ว่าใครล็อกอิน
//  - calendar.events       : สร้าง/ลบ event ในปฏิทินของผู้ใช้
//  - calendar.freebusy     : เช็คว่าห้องว่างไหม (รวมอยู่ใน calendar scope แล้ว)
export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline", // ขอ refresh_token เพื่อใช้งานต่อเนื่อง
    prompt: "consent",
    scope: SCOPES,
    hd: process.env.ALLOWED_HOSTED_DOMAIN || undefined,
  });
}

export async function exchangeCode(code) {
  const oauth2 = createOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

/**
 * สร้าง authenticated client จาก tokens ที่เก็บใน session
 * googleapis จะ refresh access_token ให้อัตโนมัติถ้ามี refresh_token
 */
export function clientFromTokens(tokens) {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials(tokens);
  return oauth2;
}

export async function getUserInfo(tokens) {
  const auth = clientFromTokens(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const { data } = await oauth2.userinfo.get();
  return data; // { email, name, picture, hd, ... }
}

export function calendarFor(tokens) {
  return google.calendar({ version: "v3", auth: clientFromTokens(tokens) });
}
