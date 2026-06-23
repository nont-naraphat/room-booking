export default function MyBookings({ bookings, loading, onCancel }) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return (
    <aside className="sidebar">
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>การจองของฉัน</h2>
        <span className="count">{bookings.length}</span>
      </div>

      {loading ? (
        <>
          <div className="skeleton" style={{ height: 70, marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 70 }} />
        </>
      ) : bookings.length === 0 ? (
        <div className="empty">ยังไม่มีการจองที่กำลังจะถึง</div>
      ) : (
        bookings.map((b) => (
          <div className="booking-item" key={b.id}>
            <div className="b-title">{b.title}</div>
            {b.roomName && <span className="b-room">{b.roomName}</span>}
            <div className="b-time">
              {fmt(b.start)} – {fmtTime(b.end)}
            </div>
            <div className="b-actions">
              {b.htmlLink && (
                <a href={b.htmlLink} target="_blank" rel="noreferrer">
                  เปิดในปฏิทิน ↗
                </a>
              )}
              {b.isOrganizer && (
                <button
                  className="btn ghost-danger sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => onCancel(b)}
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </aside>
  );
}
