import { Router } from "express";
import { ROOMS, roomByEmail } from "../rooms.config.js";
import { calendarFor } from "../google.js";

const router = Router();

// GET /api/rooms  -> รายชื่อห้องทั้งหมด (ไม่เปิดเผย resourceEmail)
router.get("/rooms", (req, res) => {
  const rooms = ROOMS.map(({ resourceEmail, ...pub }) => pub);
  res.json({ rooms });
});

/**
 * POST /api/availability
 * body: { start: ISOString, end: ISOString, roomIds?: string[] }
 * -> เช็คห้องว่าง/ไม่ว่าง + ดึงหัวข้อ event และคนจอง
 *
 * พยายามใช้ events.list (ได้หัวข้อ + ผู้จอง) ก่อน
 * ถ้าห้องนั้นแชร์แบบ free/busy อย่างเดียว/ไม่มีสิทธิ์ -> fallback เป็น freebusy (ไม่มีหัวข้อ)
 */
function eventsToBusy(items) {
  return (items || [])
    .filter((ev) => ev.status !== "cancelled")
    .map((ev) => ({
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      title: ev.summary || null, // null = แชร์แบบ free/busy (ไม่เห็นหัวข้อ)
      organizer: ev.organizer?.displayName || ev.creator?.displayName || null,
      organizerEmail: ev.organizer?.email || ev.creator?.email || null,
    }));
}

router.post("/availability", async (req, res) => {
  try {
    const { start, end, roomIds } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: "ต้องระบุ start และ end" });
    }

    const targetRooms = roomIds?.length
      ? ROOMS.filter((r) => roomIds.includes(r.id))
      : ROOMS;

    const calendar = calendarFor(req.session.tokens);

    const availability = await Promise.all(
      targetRooms.map(async (room) => {
        // 1) ลองดึง event แบบมีรายละเอียดก่อน
        try {
          const { data } = await calendar.events.list({
            calendarId: room.resourceEmail,
            timeMin: start,
            timeMax: end,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 20,
          });
          const busy = eventsToBusy(data.items);
          return {
            roomId: room.id,
            available: busy.length === 0,
            busy,
            errors: [],
            detail: true,
          };
        } catch (err) {
          // 2) fallback: freebusy (ได้แค่ช่วงเวลา ไม่มีหัวข้อ/ผู้จอง)
          try {
            const { data } = await calendar.freebusy.query({
              requestBody: {
                timeMin: start,
                timeMax: end,
                items: [{ id: room.resourceEmail }],
              },
            });
            const entry = data.calendars?.[room.resourceEmail] || {};
            const busy = (entry.busy || []).map((b) => ({
              start: b.start,
              end: b.end,
              title: null,
              organizer: null,
              organizerEmail: null,
            }));
            return {
              roomId: room.id,
              available: busy.length === 0 && (entry.errors || []).length === 0,
              busy,
              errors: entry.errors || [],
              detail: false,
            };
          } catch (e2) {
            return {
              roomId: room.id,
              available: false,
              busy: [],
              errors: [{ reason: "unavailable" }],
              detail: false,
            };
          }
        }
      })
    );

    res.json({ start, end, availability });
  } catch (err) {
    console.error("availability error:", err?.message);
    res.status(500).json({ error: "เช็คสถานะห้องไม่สำเร็จ" });
  }
});

export default router;
export { roomByEmail };
