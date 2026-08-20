import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";

const STATUS_LABEL = {
  DELETED_USER: "บัญชีถูกลบ",
  SUSPENDED_USER: "ถูก suspend",
  NO_ORGANIZER: "ไม่มี organizer",
};

const fmt = (iso) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminCleanup({ onToast }) {
  const [daysAhead, setDaysAhead] = useState(365);
  const [loading, setLoading] = useState(false);
  const [orphans, setOrphans] = useState([]);
  const [roomErrors, setRoomErrors] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [busyId, setBusyId] = useState(null); // eventId ที่กำลังยกเลิก

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const { orphans, roomErrors } = await api.adminOrphans(daysAhead);
      setOrphans(orphans);
      setRoomErrors(roomErrors || []);
      setScanned(true);
    } catch (e) {
      onToast?.(e.message, "err");
    } finally {
      setLoading(false);
    }
  }, [daysAhead, onToast]);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancelOne(row) {
    const parts = [
      `ยกเลิกการจอง "${row.title}"`,
      `ห้อง: ${row.roomName}`,
      `organizer: ${row.organizer || "(ไม่มี)"} — ${STATUS_LABEL[row.status] || row.status}`,
      row.isRecurring ? "⚠️ เป็นการจองแบบประจำ (recurring) — จะลบทั้งชุด" : "",
      row.externalCount > 0
        ? `⚠️ มีผู้ร่วม ${row.externalCount} คนนอกโดเมน — เราลบ copy ของเขาไม่ได้ (Google จำกัด)`
        : "",
      "",
      "ระบบจะ backup event ก่อนลบ และลบให้ทุกคนในโดเมนเท่าที่ทำได้",
      "ลบแล้วยังกู้จาก Trash ของปฏิทินได้ภายใน 30 วัน",
      "",
      "ยืนยันลบจริง?",
    ]
      .filter(Boolean)
      .join("\n");

    if (!confirm(parts)) return;

    setBusyId(row.eventId);
    try {
      const { report } = await api.adminCancelOrphan({
        roomEmail: row.roomEmail,
        eventId: row.eventId,
        organizer: row.organizer,
      });

      // สรุปผล
      let msg;
      if (report.cancelledForAll) {
        msg = `ยกเลิกให้ทุกคนแล้ว (ส่ง cancellation ครบ) — ${row.roomName}`;
      } else {
        const bits = [];
        if (report.clearedRoom) bits.push("ปล่อยห้องคืนแล้ว");
        if (report.clearedInternal.length)
          bits.push(`ลบให้คนในโดเมน ${report.clearedInternal.length} คน`);
        if (report.externalRemaining.length)
          bits.push(`เหลือคนนอกโดเมน ${report.externalRemaining.length} คน (ลบไม่ได้)`);
        if (report.failedInternal.length)
          bits.push(`ล้มเหลว ${report.failedInternal.length} คน`);
        msg = bits.join(" · ") || "ดำเนินการแล้ว";
      }
      onToast?.(msg, report.failedInternal?.length ? "err" : "ok");
      setOrphans((prev) => prev.filter((r) => r.eventId !== row.eventId));
    } catch (e) {
      onToast?.(e.message, "err");
    } finally {
      setBusyId(null);
    }
  }

  const total = orphans.length;

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <h2>เคลียร์การจองที่เจ้าของหายไปแล้ว</h2>
          <p className="admin-sub">
            การจองในห้องที่ organizer ถูกลบ / suspend / ไม่มี organizer — กั๊ก slot คนอื่น
          </p>
        </div>
        <div className="admin-controls">
          <label className="field">
            <span>มองไปข้างหน้า</span>
            <select
              value={daysAhead}
              onChange={(e) => setDaysAhead(Number(e.target.value))}
            >
              <option value={90}>90 วัน</option>
              <option value={180}>180 วัน</option>
              <option value={365}>365 วัน</option>
              <option value={730}>730 วัน</option>
            </select>
          </label>
          <button className="btn" onClick={scan} disabled={loading}>
            {loading ? "กำลังสแกน…" : "↻ สแกนใหม่"}
          </button>
        </div>
      </div>

      <div className="admin-note">
        <b>ทำงานยังไง:</b> ถ้า organizer <u>ยังอยู่</u> (แค่ suspend) จะ impersonate เพื่อ
        ยกเลิกให้ทุกคนแบบสะอาด · ถ้า organizer <u>ถูกลบไปแล้ว</u> จะลบ copy ของห้อง +
        ไล่ลบของผู้ร่วมในโดเมนทีละคน (คนนอกโดเมนลบไม่ได้) · <b>backup + กู้ได้ 30 วันจาก Trash</b>
      </div>

      {roomErrors.length > 0 && (
        <div className="admin-warn">
          อ่านบางห้องไม่ได้: {roomErrors.map((r) => r.room).join(", ")} — เช็คว่า admin
          มีสิทธิ์บนปฏิทินห้องหรือยัง
        </div>
      )}

      {loading && orphans.length === 0 ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : !scanned ? null : total === 0 ? (
        <div className="empty">🎉 ไม่พบการจองค้างที่ต้องเคลียร์</div>
      ) : (
        <>
          <div className="section-head" style={{ marginTop: 4 }}>
            <h2 style={{ fontSize: 15 }}>พบ {total} รายการ</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>หัวข้อ</th>
                  <th>เวลา</th>
                  <th>Organizer</th>
                  <th>ผู้ร่วม</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orphans.map((r) => (
                  <tr key={r.roomEmail + r.eventId}>
                    <td>
                      <b>{r.roomName}</b>
                    </td>
                    <td>
                      {r.title}
                      {r.isRecurring && <span className="tag">ประจำ</span>}
                    </td>
                    <td className="nowrap">{fmt(r.start)}</td>
                    <td>
                      <div className="org-email">{r.organizer || "—"}</div>
                      <span className={`badge ${r.status}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="nowrap">
                      <span title="ในโดเมน">👤 {r.internalCount}</span>
                      {r.externalCount > 0 && (
                        <span className="ext" title={r.externalGuests.join(", ")}>
                          {" "}
                          · นอก {r.externalCount}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn ghost-danger sm"
                        onClick={() => cancelOne(r)}
                        disabled={busyId === r.eventId}
                      >
                        {busyId === r.eventId ? "กำลังลบ…" : "ยกเลิก (ลบจริง)"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
