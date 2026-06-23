import { useState } from "react";

const DOMAIN = "@21sunpassion.com";

export default function BookingModal({ room, start, end, onClose, onConfirm }) {
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState([""]); // เริ่มด้วย 1 แถวว่าง
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fmt = (iso) =>
    new Date(iso).toLocaleString("th-TH", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  // มี @ อยู่แล้ว = ใช้ตามนั้น / ไม่มี = เติมโดเมน
  const resolveEmail = (v) => {
    const t = v.trim();
    if (!t) return "";
    return t.includes("@") ? t : t + DOMAIN;
  };

  const setAttendee = (i, v) =>
    setAttendees((a) => a.map((x, idx) => (idx === i ? v : x)));
  const addAttendee = () => setAttendees((a) => [...a, ""]);
  const removeAttendee = (i) =>
    setAttendees((a) => (a.length === 1 ? [""] : a.filter((_, idx) => idx !== i)));

  async function submit() {
    if (!title.trim()) return setError("กรุณาใส่หัวข้อการประชุม");
    setSaving(true);
    setError("");
    try {
      await onConfirm({
        roomId: room.id,
        title: title.trim(),
        start,
        end,
        description: description.trim(),
        guests: attendees.map(resolveEmail).filter(Boolean),
      });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>จอง {room.name}</h3>
        <p className="sub">
          {room.building} {room.floor} · จุได้ {room.capacity} คน
          <br />
          {fmt(start)} –{" "}
          {new Date(end).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <div className="field">
          <label>หัวข้อการประชุม</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น Weekly sync"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div className="field">
          <label>ผู้เข้าร่วม</label>
          {attendees.map((v, i) => {
            const full = v.includes("@");
            return (
              <div className="attendee-row" key={i}>
                <div className="attendee-input">
                  <input
                    value={v}
                    onChange={(e) => setAttendee(i, e.target.value)}
                    placeholder="ชื่อผู้ใช้ เช่น somchai"
                  />
                  {!full && <span className="attendee-suffix">{DOMAIN}</span>}
                </div>
                <button
                  type="button"
                  className="attendee-remove"
                  onClick={() => removeAttendee(i)}
                  aria-label="ลบ"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button type="button" className="attendee-add" onClick={addAttendee}>
            + เพิ่มผู้เข้าร่วม
          </button>
          <div className="attendee-hint">
            พิมพ์แค่ชื่อผู้ใช้ ระบบจะเติม {DOMAIN} ให้ · หรือพิมพ์อีเมลเต็ม (มี @) ก็ได้
          </div>
        </div>

        <div className="field">
          <label>รายละเอียด (ไม่บังคับ)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="วาระการประชุม, ลิงก์เอกสาร ฯลฯ"
          />
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>
          <button className="btn primary" onClick={submit} disabled={saving}>
            {saving ? "กำลังจอง…" : "ยืนยันการจอง"}
          </button>
        </div>
      </div>
    </div>
  );
}
