/**
 * routes/admin.js
 * =================================================================
 * ฟีเจอร์ "Admin cleanup" — เคลียร์การจองห้องที่ organizer หายไปแล้ว
 * (ลบบัญชี / suspend / ไม่มี organizer) ซึ่งกั๊ก slot คนอื่น
 *
 * GET  /api/admin/orphans           -> สแกนทุกห้อง หา booking ที่ organizer มีปัญหา
 * POST /api/admin/orphans/cancel    -> ยกเลิก "จริง" (ลบให้ทุกคนที่ถูกยิงไป เท่าที่ทำได้)
 *
 * เข้าได้เฉพาะอีเมลใน ADMIN_EMAILS เท่านั้น
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { ROOMS, roomByEmail } from "../rooms.config.js";
import { broadcast } from "../sync.js";
import {
  isAdminConfigured,
  adminSubject,
  calendarAs,
  directoryAsAdmin,
} from "../google-admin.js";

const router = Router();
const BACKUP_DIR = path.join(process.cwd(), "backups");

// ---------- helpers ----------
function getOurDomains() {
  const raw = process.env.OUR_DOMAINS || process.env.ALLOWED_HOSTED_DOMAIN || "";
  return new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  );
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// guard: เฉพาะ admin
function adminOnly(req, res, next) {
  const email = req.session?.user?.email?.toLowerCase();
  const admins = adminEmails();
  if (!email || admins.length === 0 || !admins.includes(email)) {
    return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (ADMIN_EMAILS) เท่านั้น" });
  }
  next();
}

function httpStatus(e) {
  return e?.code || e?.response?.status || null;
}

// เช็คสถานะ organizer (cache ต่อ request)
async function orgStatus(dir, email, ourDomains, cache) {
  if (!email) return { status: "NO_ORGANIZER", name: "" };
  const key = email.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const domain = key.split("@")[1] || "";
  let out;
  if (!ourDomains.has(domain)) {
    out = { status: "EXTERNAL", name: "" };
  } else {
    try {
      const { data } = await dir.users.get({
        userKey: email,
        projection: "basic",
        fields: "suspended,name/fullName",
      });
      out = {
        status: data.suspended ? "SUSPENDED_USER" : "ACTIVE",
        name: data.name?.fullName || "",
      };
    } catch (e) {
      if (httpStatus(e) === 404) out = { status: "DELETED_USER", name: "" };
      else throw e;
    }
  }
  cache.set(key, out);
  return out;
}

function saveBackup(calendarId, eventId, event) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const safe = `${calendarId}__${eventId}`.replace(/[^\w.-]/g, "_");
    const file = path.join(BACKUP_DIR, `${safe}__${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ calendarId, event }, null, 2), "utf8");
    return path.basename(file);
  } catch (e) {
    console.error("backup error:", e?.message);
    return null;
  }
}

function splitGuests(attendees, ourDomains) {
  const internal = [];
  const external = [];
  for (const a of attendees || []) {
    if (a.resource) continue;
    const email = a.email || "";
    const domain = email.split("@")[1]?.toLowerCase() || "";
    (ourDomains.has(domain) ? internal : external).push(email);
  }
  return { internal, external };
}

// ================================================================
// GET /api/admin/orphans?daysAhead=365
// ================================================================
router.get("/admin/orphans", adminOnly, async (req, res) => {
  if (!isAdminConfigured()) {
    return res.status(400).json({
      error:
        "ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_FILE / GOOGLE_ADMIN_SUBJECT (ดู .env.example)",
    });
  }
  try {
    const daysAhead = Math.min(
      parseInt(req.query.daysAhead || "365", 10) || 365,
      1095
    );
    const ourDomains = getOurDomains();
    const cal = calendarAs(adminSubject());
    const dir = directoryAsAdmin();

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + daysAhead * 86400000).toISOString();

    const cache = new Map();
    const rows = [];
    const roomErrors = [];

    for (const room of ROOMS) {
      let pageToken;
      do {
        let data;
        try {
          ({ data } = await cal.events.list({
            calendarId: room.resourceEmail,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            showDeleted: false,
            maxResults: 250,
            pageToken,
          }));
        } catch (e) {
          roomErrors.push({ room: room.name, error: e?.message || String(e) });
          break;
        }

        for (const ev of data.items || []) {
          if (ev.status === "cancelled") continue;
          const org = ev.organizer || {};
          const orgEmail = org.email || "";
          // organizer = ห้องเอง -> ข้าม
          if (org.self || orgEmail.toLowerCase() === room.resourceEmail.toLowerCase())
            continue;

          const st = await orgStatus(dir, orgEmail, ourDomains, cache);
          // organizer ยัง active หรือเป็นคนนอกโดเมน -> ไม่ใช่ orphan ของเรา ไม่แตะ
          if (st.status === "ACTIVE" || st.status === "EXTERNAL") continue;

          const { internal, external } = splitGuests(ev.attendees, ourDomains);
          rows.push({
            roomId: room.id,
            roomName: room.name,
            roomEmail: room.resourceEmail,
            eventId: ev.recurringEventId || ev.id,
            title: ev.summary || "(ไม่มีหัวข้อ)",
            start: ev.start?.dateTime || ev.start?.date,
            end: ev.end?.dateTime || ev.end?.date,
            organizer: orgEmail,
            organizerName: st.name || "",
            status: st.status, // DELETED_USER | SUSPENDED_USER | NO_ORGANIZER
            isRecurring: !!ev.recurringEventId,
            internalCount: internal.length,
            externalCount: external.length,
            externalGuests: external,
            htmlLink: ev.htmlLink || null,
          });
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }

    // dedupe recurring (per room + eventId)
    const seen = new Set();
    const orphans = [];
    for (const r of rows) {
      const k = `${r.roomEmail}|${r.eventId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      orphans.push(r);
    }
    orphans.sort((a, b) =>
      `${a.roomName}${a.start}`.localeCompare(`${b.roomName}${b.start}`)
    );

    res.json({ orphans, roomErrors, scannedRooms: ROOMS.length, daysAhead });
  } catch (e) {
    console.error("orphans scan error:", e?.message);
    res.status(500).json({ error: "สแกนไม่สำเร็จ: " + (e?.message || "") });
  }
});

// ================================================================
// POST /api/admin/orphans/cancel
// body: { roomEmail, eventId, organizer }
// ยกเลิก "จริง" ให้ทุกคนเท่าที่ทำได้
// ================================================================
router.post("/admin/orphans/cancel", adminOnly, async (req, res) => {
  if (!isAdminConfigured()) {
    return res.status(400).json({ error: "ยังไม่ได้ตั้งค่า service account / admin subject" });
  }
  try {
    const { roomEmail, eventId, organizer } = req.body || {};
    if (!roomEmail || !eventId) {
      return res.status(400).json({ error: "ต้องมี roomEmail และ eventId" });
    }
    const ourDomains = getOurDomains();
    const dir = directoryAsAdmin();
    const adminCal = calendarAs(adminSubject());

    const report = {
      method: null,
      cancelledForAll: false,
      clearedRoom: false,
      clearedInternal: [],
      failedInternal: [],
      externalRemaining: [],
      backup: null,
      note: null,
    };

    // ดึง event เต็มจาก copy ของห้อง (ไว้ backup + อ่าน attendee)
    let roomEvent = null;
    try {
      const { data } = await adminCal.events.get({ calendarId: roomEmail, eventId });
      roomEvent = data;
      report.backup = saveBackup(roomEmail, eventId, data);
    } catch (e) {
      if (httpStatus(e) === 403) {
        return res.status(403).json({
          error:
            "admin ไม่มีสิทธิ์แก้ปฏิทินห้องนี้ (403) — เปิด Google Calendar ของห้อง > Settings and sharing > เพิ่ม " +
            adminSubject() +
            " เป็น 'Make changes to events'",
        });
      }
      // 404/410 = event หายไปแล้ว
    }

    const attendees = (roomEvent?.attendees || []).filter((a) => !a.resource);

    // สถานะ organizer
    const st = organizer
      ? await orgStatus(dir, organizer, ourDomains, new Map())
      : { status: "NO_ORGANIZER" };

    // ---- ทางที่ 1: organizer ยังอยู่ (active/suspended) -> ยกเลิกให้ทุกคนแบบสะอาด ----
    if (st.status === "ACTIVE" || st.status === "SUSPENDED_USER") {
      try {
        const orgCal = calendarAs(organizer);
        await orgCal.events.delete({
          calendarId: "primary",
          eventId,
          sendUpdates: "all", // ส่ง cancellation ถึงทุก attendee + ปล่อยห้อง
        });
        report.method = "organizer-cancel";
        report.cancelledForAll = true;
        report.clearedRoom = true;
        broadcast({ type: "changed", roomId: roomByEmail[roomEmail.toLowerCase()]?.id });
        return res.json({ ok: true, report });
      } catch (e) {
        // impersonate organizer ไม่ได้ (เช่น suspended เข้าไม่ได้) -> ตกไป fallback
        report.note =
          "impersonate organizer ไม่ได้ (" +
          (e?.message || httpStatus(e)) +
          ") — ใช้วิธีลบรายคนแทน";
      }
    }

    // ---- ทางที่ 2 (fallback): organizer ถูกลบ/เข้าไม่ได้ ----
    // 2a) ลบ copy ของห้อง (ปล่อย slot คืน)
    try {
      await adminCal.events.delete({ calendarId: roomEmail, eventId, sendUpdates: "none" });
      report.clearedRoom = true;
    } catch (e) {
      const s = httpStatus(e);
      if (s === 404 || s === 410) report.clearedRoom = true;
      else report.roomError = `${s || ""} ${e?.message || ""}`.trim();
    }

    // 2b) ไล่ลบ copy ของ attendee ในโดเมนเราทีละคน
    for (const a of attendees) {
      const email = a.email || "";
      const domain = email.split("@")[1]?.toLowerCase() || "";
      if (!ourDomains.has(domain)) {
        report.externalRemaining.push(email); // นอกโดเมน = บังคับลบไม่ได้
        continue;
      }
      if (email.toLowerCase() === (organizer || "").toLowerCase()) continue; // organizer ลบไม่ได้อยู่แล้ว
      try {
        const uc = calendarAs(email);
        await uc.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" });
        report.clearedInternal.push(email);
      } catch (e) {
        const s = httpStatus(e);
        if (s === 404 || s === 410) report.clearedInternal.push(email);
        else report.failedInternal.push(email);
      }
    }

    report.method = "per-attendee";
    broadcast({ type: "changed", roomId: roomByEmail[roomEmail.toLowerCase()]?.id });
    res.json({ ok: true, report });
  } catch (e) {
    console.error("cancel orphan error:", e?.message);
    res.status(500).json({ error: "ยกเลิกไม่สำเร็จ: " + (e?.message || "") });
  }
});

export default router;
