import { useState } from "react";

export default function BookingModal({ room, start, end, onClose, onConfirm }) {
  const [title, setTitle] = useState("");
  const [guests, setGuests] = useState("");
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
        guests: guests
          .split(/[,\s]+/)
          .map((g) => g.trim())
          .filter(Boolean),
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
          {fmt(start)} – {new Date(end).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
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
          <label>ผู้เข้าร่วม (อีเมล คั่นด้วยเว้นวรรค)</label>
          <input
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            placeholder="a@company.com b@company.com"
          />
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
