import { Router } from "express";
import { roomById, roomByEmail } from "../rooms.config.js";
import { calendarFor } from "../google.js";
import { broadcast } from "../sync.js";

const router = Router();
const TZ = process.env.TIMEZONE || "Asia/Bangkok";

/**
 * POST /api/bookings
 * body: { roomId, title, start, end, guests?: string[], description? }
 * -> สร้าง event ในปฏิทินของผู้จอง พร้อมเพิ่มห้องเป็น resource
 *    ห้องจะ auto-accept ถ้าว่าง และ event จะ sync ไปทุกคนที่เกี่ยวข้อง
 */
router.post("/bookings", async (req, res) => {
  try {
    const { roomId, title, start, end, guests = [], description } = req.body;
    const room = roomById[roomId];

    if (!room) return res.status(400).json({ error: "ไม่พบห้องนี้" });
    if (!title?.trim()) return res.status(400).json({ error: "กรุณาใส่หัวข้อการประชุม" });
    if (!start || !end) return res.status(400).json({ error: "ต้องระบุเวลาเริ่ม-สิ้นสุด" });
    if (new Date(start) >= new Date(end))
      return res.status(400).json({ error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" });

    const calendar = calendarFor(req.session.tokens);

    const attendees = [
      { email: room.resourceEmail, resource: true },
      ...guests
        .filter((g) => g && g.includes("@"))
        .map((email) => ({ email })),
    ];

    const { data: event } = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      requestBody: {
        summary: title.trim(),
        description: description?.trim() || undefined,
        location: `${room.name} · ${room.building} ${room.floor}`,
        start: { dateTime: start, timeZone: TZ },
        end: { dateTime: end, timeZone: TZ },
        attendees,
      },
    });

    // เช็คว่าห้อง accept หรือ decline (ชนกับคิวอื่น)
    const roomStatus = (event.attendees || []).find(
      (a) => a.email?.toLowerCase() === room.resourceEmail.toLowerCase()
    )?.responseStatus;

    if (roomStatus === "declined") {
      // ห้องไม่ว่าง -> ลบ event ที่เพิ่งสร้างทิ้งเพื่อไม่ให้ค้าง
      await calendar.events.delete({
        calendarId: "primary",
        eventId: event.id,
        sendUpdates: "all",
      });
      return res
        .status(409)
        .json({ error: `ห้อง ${room.name} ถูกจองในช่วงเวลานี้แล้ว` });
    }

    broadcast({ type: "changed", roomId: room.id }); // แจ้งผู้ใช้คนอื่นให้รีเฟรช
    res.status(201).json({ booking: toBooking(event) });
  } catch (err) {
    console.error("create booking error:", err?.message);
    res.status(500).json({ error: "สร้างการจองไม่สำเร็จ" });
  }
});

/**
 * PATCH /api/bookings/:eventId
 * body: { title?, start?, end?, description?, guests? }
 * -> แก้ไข/เลื่อนเวลาการจอง แล้วเขียนกลับไป Google Calendar (two-way)
 */
router.patch("/bookings/:eventId", async (req, res) => {
  try {
    const { title, start, end, description, guests } = req.body;
    const calendar = calendarFor(req.session.tokens);

    // ดึง event เดิมมาก่อนเพื่อรักษา attendee ห้องไว้
    const { data: current } = await calendar.events.get({
      calendarId: "primary",
      eventId: req.params.eventId,
    });

    if (start && end && new Date(start) >= new Date(end))
      return res.status(400).json({ error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" });

    const patch = {};
    if (title) patch.summary = title.trim();
    if (description !== undefined) patch.description = description?.trim() || "";
    if (start) patch.start = { dateTime: start, timeZone: TZ };
    if (end) patch.end = { dateTime: end, timeZone: TZ };
    if (Array.isArray(guests)) {
      const roomAtt = (current.attendees || []).filter((a) => a.resource);
      patch.attendees = [
        ...roomAtt,
        ...guests.filter((g) => g && g.includes("@")).map((email) => ({ email })),
      ];
    }

    const { data: event } = await calendar.events.patch({
      calendarId: "primary",
      eventId: req.params.eventId,
      sendUpdates: "all",
      requestBody: patch,
    });

    // ถ้าเลื่อนเวลาแล้วห้องชนคิวอื่น Google จะ decline
    const room = (event.attendees || []).find((a) => a.resource);
    if (room?.responseStatus === "declined") {
      return res.status(409).json({
        error: "ช่วงเวลาใหม่ห้องไม่ว่าง — การจองเดิมยังอยู่ กรุณาเลือกเวลาอื่น",
      });
    }

    broadcast({ type: "changed" });
    res.json({ booking: toBooking(event) });
  } catch (err) {
    console.error("update booking error:", err?.message);
    res.status(500).json({ error: "แก้ไขการจองไม่สำเร็จ" });
  }
});

/**
 * GET /api/bookings -> รายการจองของผู้ใช้ (เฉพาะ event ที่มีห้องของเรา) ตั้งแต่ตอนนี้เป็นต้นไป
 */
router.get("/bookings", async (req, res) => {
  try {
    const calendar = calendarFor(req.session.tokens);
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const bookings = (data.items || [])
      .filter((ev) =>
        (ev.attendees || []).some(
          (a) => roomByEmail[a.email?.toLowerCase()]
        )
      )
      .map(toBooking);

    res.json({ bookings });
  } catch (err) {
    console.error("list bookings error:", err?.message);
    res.status(500).json({ error: "ดึงรายการจองไม่สำเร็จ" });
  }
});

/**
 * DELETE /api/bookings/:eventId -> ยกเลิกการจอง
 */
router.delete("/bookings/:eventId", async (req, res) => {
  try {
    const calendar = calendarFor(req.session.tokens);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: req.params.eventId,
      sendUpdates: "all",
    });
    broadcast({ type: "changed" });
    res.json({ ok: true });
  } catch (err) {
    console.error("cancel booking error:", err?.message);
    res.status(500).json({ error: "ยกเลิกการจองไม่สำเร็จ" });
  }
});

// แปลง Google event -> รูปแบบที่ frontend ใช้
function toBooking(ev) {
  const roomAttendee = (ev.attendees || []).find(
    (a) => roomByEmail[a.email?.toLowerCase()]
  );
  const room = roomAttendee
    ? roomByEmail[roomAttendee.email.toLowerCase()]
    : null;

  return {
    id: ev.id,
    title: ev.summary || "(ไม่มีหัวข้อ)",
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    htmlLink: ev.htmlLink,
    organizer: ev.organizer?.email,
    isOrganizer: !!ev.organizer?.self,
    roomId: room?.id || null,
    roomName: room?.name || null,
    roomStatus: roomAttendee?.responseStatus || null,
    guests: (ev.attendees || [])
      .filter((a) => !a.resource && !a.self)
      .map((a) => a.email),
  };
}

export default router;
