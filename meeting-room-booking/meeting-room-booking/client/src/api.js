// ทุก request ส่ง cookie ไปด้วย (credentials) เพื่อใช้ session
async function req(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export const api = {
  me: () => req("/api/me"),
  logout: () => req("/auth/logout", { method: "POST" }),
  rooms: () => req("/api/rooms"),
  availability: (start, end, roomIds) =>
    req("/api/availability", {
      method: "POST",
      body: JSON.stringify({ start, end, roomIds }),
    }),
  bookings: () => req("/api/bookings"),
  createBooking: (payload) =>
    req("/api/bookings", { method: "POST", body: JSON.stringify(payload) }),
  updateBooking: (eventId, payload) =>
    req(`/api/bookings/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  cancelBooking: (eventId) =>
    req(`/api/bookings/${eventId}`, { method: "DELETE" }),
  // ตารางทั้งวันของทุกห้อง (มุมมอง Timeline)
  schedule: (date) => req(`/api/schedule?date=${date}`),

  // เปิด stream รับสัญญาณ real-time เมื่อมีการเปลี่ยนแปลง (two-way sync)
  subscribe(onChange) {
    const es = new EventSource("/api/stream", { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "changed") onChange(msg);
      } catch {}
    };
    return () => es.close();
  },
};
