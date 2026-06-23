import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { getAuthUrl, exchangeCode, getUserInfo } from "./google.js";
import roomsRouter from "./routes/rooms.js";
import bookingsRouter from "./routes/bookings.js";
import scheduleRouter from "./routes/schedule.js";
import { addClient, broadcast } from "./sync.js";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.set("trust proxy", 1);
app.use(express.json());
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(
  cookieSession({
    name: "rb_session",
    keys: [
      process.env.SESSION_KEY1 || "dev-key-1",
      process.env.SESSION_KEY2 || "dev-key-2",
    ],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
  })
);

// ---------- Auth ----------
app.get("/auth/google", (req, res) => {
  res.redirect(getAuthUrl());
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error || !code) return res.redirect(`${CLIENT_URL}/?auth=failed`);

    const tokens = await exchangeCode(code);
    const user = await getUserInfo(tokens);

    // จำกัดเฉพาะ domain ขององค์กร (ถ้าตั้งค่าไว้)
    const allowed = process.env.ALLOWED_HOSTED_DOMAIN;
    if (allowed && user.hd !== allowed) {
      return res.redirect(`${CLIENT_URL}/?auth=domain`);
    }

    req.session.tokens = tokens;
    req.session.user = {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    res.redirect(`${CLIENT_URL}/`);
  } catch (err) {
    console.error("auth callback error:", err?.message);
    res.redirect(`${CLIENT_URL}/?auth=failed`);
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

app.post("/auth/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---------- Google push notifications webhook (ออปชัน) ----------
// Google จะ POST มาที่นี่เมื่อปฏิทินห้องเปลี่ยน (ดูวิธีตั้งค่าใน README)
// endpoint นี้ไม่ต้องล็อกอิน เพราะ Google เป็นผู้เรียก
app.post("/notifications/google", (req, res) => {
  // header สำคัญ: x-goog-resource-state = "exists" เมื่อมีการเปลี่ยนแปลง
  if (req.headers["x-goog-resource-state"] !== "sync") {
    broadcast({ type: "changed", source: "google" });
  }
  res.sendStatus(200);
});

// ---------- Auth guard for /api ----------
app.use("/api", (req, res, next) => {
  if (req.path === "/me") return next();
  if (!req.session?.tokens) {
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  }
  next();
});

app.use("/api", roomsRouter);
app.use("/api", bookingsRouter);
app.use("/api", scheduleRouter);

// ---------- Real-time stream (SSE) ----------
// client เปิด EventSource("/api/stream") ค้างไว้ เพื่อรับสัญญาณว่ามีการเปลี่ยนแปลง
app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "ready" })}\n\n`);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  res.on("close", () => clearInterval(ping));
  addClient(res);
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ---------- Serve built frontend (production / single container) ----------
const clientDir = path.join(__dirname, "client-dist");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  // SPA fallback: ส่ง index.html สำหรับทุก route ที่ไม่ใช่ /api, /auth, /health
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`✅ Room booking server running on http://localhost:${PORT}`);
});
