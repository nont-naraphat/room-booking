/**
 * Two-way sync helpers
 * =====================
 * 1) SSE (Server-Sent Events): ฝั่ง client เปิด stream ค้างไว้ที่ /api/stream
 *    เมื่อมีการจอง/แก้ไข/ยกเลิกจากใครก็ตามในแอป เราจะ broadcast ให้ทุกคนรีเฟรช
 *    => ทุกคนเห็นตารางตรงกันแบบ real-time
 *
 * 2) (ออปชัน) Google push notifications: ถ้าตั้งค่า service account + public URL ไว้
 *    Google จะยิง webhook มาเมื่อปฏิทินห้องเปลี่ยน (เช่นมีคนจองตรงใน Google Calendar)
 *    แล้วเราจะ broadcast ให้ client รีเฟรชเช่นกัน => sync สองทางแบบ real-time เต็มรูปแบบ
 *    ดูวิธีเปิดใช้งานใน README ("Real-time push")
 */

const clients = new Set();

export function addClient(res) {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

export function broadcast(payload) {
  const msg = `data: ${JSON.stringify({ ...payload, at: Date.now() })}\n\n`;
  for (const res of clients) {
    try {
      res.write(msg);
    } catch {
      clients.delete(res);
    }
  }
}

export function clientCount() {
  return clients.size;
}
