function statusOf(avail) {
  if (!avail) return "unknown";
  if (avail.errors?.length) return "unknown";
  return avail.available ? "free" : "busy";
}

const LABELS = {
  free: "ว่าง",
  busy: "ไม่ว่าง",
  unknown: "—",
};

function RoomCard({ room, avail, onBook }) {
  const status = statusOf(avail);
  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const initials = (name) =>
    (name || "?")
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className={`room-card ${status}`}>
      <div className="room-top">
        <div>
          <div className="room-name">{room.name}</div>
          <div className="room-meta">จุได้ {room.capacity} คน</div>
        </div>
        <span className={`pill ${status}`}>{LABELS[status]}</span>
      </div>

      {room.features?.length > 0 && (
        <div className="feature-tags">
          {room.features.map((f) => (
            <span className="tag" key={f}>{f}</span>
          ))}
        </div>
      )}

      {status === "busy" && avail.busy?.length > 0 && (
        <div className="event-list">
          <div className="event-list-label">มีการจองในช่วงนี้</div>
          {avail.busy.map((b, i) => (
            <div className="event-item" key={i}>
              <span className="event-dot" />
              <div className="event-body">
                <div className="event-time">
                  {fmtTime(b.start)}–{fmtTime(b.end)}
                </div>
                <div className="event-title">{b.title || "ไม่ว่าง"}</div>
                {(b.organizer || b.organizerEmail) && (
                  <div className="event-by">
                    <span className="event-avatar">
                      {initials(b.organizer || b.organizerEmail)}
                    </span>
                    {b.organizer
                      ? `${b.organizer}${b.organizerEmail ? ` · ${b.organizerEmail}` : ""}`
                      : b.organizerEmail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn primary sm block"
        disabled={status !== "free"}
        onClick={() => onBook(room)}
      >
        {status === "free" ? "จองห้องนี้" : status === "busy" ? "ไม่ว่าง" : "ตรวจสอบไม่ได้"}
      </button>
    </div>
  );
}

export default function RoomBoard({ rooms, availability, loading, onBook }) {
  // จัดกลุ่มตามอาคาร แล้ววางห้องว่างขึ้นก่อน
  const groups = {};
  for (const room of rooms) {
    const key = `${room.building}|${room.floor}`;
    (groups[key] ||= []).push(room);
  }

  if (loading) {
    return (
      <div className="room-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton" key={i} style={{ height: 150 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {Object.entries(groups).map(([key, list]) => {
        const [building, floor] = key.split("|");
        const sorted = [...list].sort((a, b) => {
          const sa = statusOf(availability[a.id]) === "free" ? 0 : 1;
          const sb = statusOf(availability[b.id]) === "free" ? 0 : 1;
          return sa - sb;
        });
        return (
          <div className="building-group" key={key}>
            <div className="building-label">
              {building} <span className="floor">{floor}</span>
            </div>
            <div className="room-grid">
              {sorted.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  avail={availability[room.id]}
                  onBook={onBook}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
