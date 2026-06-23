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
 * -> เช็คว่าห้องไหนว่าง/ไม่ว่าง ในช่วงเวลาที่เลือก ผ่าน Google freebusy
 */
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
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: start,
        timeMax: end,
        items: targetRooms.map((r) => ({ id: r.resourceEmail })),
      },
    });

    const calendars = data.calendars || {};
    const availability = targetRooms.map((room) => {
      const entry = calendars[room.resourceEmail] || {};
      const busy = entry.busy || [];
      const errors = entry.errors || [];
      return {
        roomId: room.id,
        available: errors.length === 0 && busy.length === 0,
        busy, // [{ start, end }]
        errors, // เช่น ไม่มีสิทธิ์เห็นห้องนี้
      };
    });

    res.json({ start, end, availability });
  } catch (err) {
    console.error("freebusy error:", err?.message);
    res.status(500).json({ error: "เช็คสถานะห้องไม่สำเร็จ" });
  }
});

export default router;
export { roomByEmail };
