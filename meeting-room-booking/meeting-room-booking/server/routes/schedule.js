import { Router } from "express";
import { ROOMS } from "../rooms.config.js";
import { calendarFor } from "../google.js";

const router = Router();
const TZ = process.env.TIMEZONE || "Asia/Bangkok";

/**
 * GET /api/schedule?date=YYYY-MM-DD
 * -> คิวของทุกห้องตลอดทั้งวัน (ใช้ในมุมมอง Timeline)
 *
 * ใช้ freebusy ซึ่งอ่านได้เสมอ (ได้ช่วงเวลาที่ไม่ว่าง)
 * ถ้าปฏิทินห้องถูกแชร์แบบ "เห็นรายละเอียดทั้งหมด" ให้ทั้งโดเมน
 * สามารถสลับไปใช้ events.list เพื่อดึงหัวข้อ event ได้ (ดูคอมเมนต์ด้านล่าง)
 */
router.get("/schedule", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const timeMin = new Date(`${date}T00:00:00`).toISOString();
    const timeMax = new Date(`${date}T23:59:59`).toISOString();

    const calendar = calendarFor(req.session.tokens);
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: TZ,
        items: ROOMS.map((r) => ({ id: r.resourceEmail })),
      },
    });

    const schedule = ROOMS.map((r) => ({
      roomId: r.id,
      busy: data.calendars?.[r.resourceEmail]?.busy || [], // [{ start, end }]
    }));

    res.json({ date, schedule });
  } catch (err) {
    console.error("schedule error:", err?.message);
    res.status(500).json({ error: "ดึงตารางทั้งวันไม่สำเร็จ" });
  }
});

/* ----------------------------------------------------------------
 * ทางเลือก: ดึงหัวข้อ event ด้วย (ต้องแชร์ปฏิทินห้องแบบเห็นรายละเอียด)
 *
 *   const all = await Promise.all(ROOMS.map(async (r) => {
 *     const { data } = await calendar.events.list({
 *       calendarId: r.resourceEmail,
 *       timeMin, timeMax, singleEvents: true, orderBy: "startTime",
 *     });
 *     return { roomId: r.id, events: (data.items||[]).map(e => ({
 *       title: e.summary, start: e.start?.dateTime, end: e.end?.dateTime,
 *     })) };
 *   }));
 * ---------------------------------------------------------------- */

export default router;
