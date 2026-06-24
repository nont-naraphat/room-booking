import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import RoomBoard from "./components/RoomBoard.jsx";
import MyBookings from "./components/MyBookings.jsx";
import BookingModal from "./components/BookingModal.jsx";

// ---------- time helpers ----------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function nextHalfHour() {
  const d = new Date();
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  return d.toTimeString().slice(0, 5);
}
function addHour(time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h + 1, m, 0, 0);
  return d.toTimeString().slice(0, 5);
}
// รวม date + time (เวลาท้องถิ่น) -> ISO
function toISO(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=logged out
  const [rooms, setRooms] = useState([]);
  const [availability, setAvailability] = useState({});
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(nextHalfHour());
  const [endTime, setEndTime] = useState(addHour(nextHalfHour()));

  const [modalRoom, setModalRoom] = useState(null);
  const [toast, setToast] = useState(null);
  const [lastSync, setLastSync] = useState(null); // เวลา sync สำเร็จล่าสุด (Google)
  const [syncError, setSyncError] = useState(false);

  const showToast = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- initial load ----------
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.rooms().then(({ rooms }) => setRooms(rooms)).catch(() => {});
    loadBookings();

    // real-time: รีเฟรชเมื่อมีการเปลี่ยนแปลงจากใครก็ตาม (รวมถึงจาก Google โดยตรง)
    const unsub = api.subscribe(() => {
      loadBookings();
      checkAvailability();
    });
    // รีเฟรชเมื่อกลับมาที่หน้าต่าง (เผื่อพลาด event)
    const onFocus = () => {
      loadBookings();
      checkAvailability();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const { bookings } = await api.bookings();
      setBookings(bookings);
    } catch (e) {
      // ignore
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // ---------- availability ----------
  const checkAvailability = useCallback(async () => {
    const start = toISO(date, startTime);
    const end = toISO(date, endTime);
    if (new Date(start) >= new Date(end)) {
      showToast("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม", "err");
      return;
    }
    setLoadingAvail(true);
    try {
      const { availability } = await api.availability(start, end);
      const map = {};
      for (const a of availability) map[a.roomId] = a;
      setAvailability(map);
      setLastSync(new Date());
      setSyncError(false);
    } catch (e) {
      setSyncError(true);
      showToast(e.message, "err");
    } finally {
      setLoadingAvail(false);
    }
  }, [date, startTime, endTime]);

  // auto-check เมื่อโหลดห้องเสร็จ และเมื่อเวลาเปลี่ยน (debounced)
  useEffect(() => {
    if (!user || rooms.length === 0) return;
    const t = setTimeout(checkAvailability, 350);
    return () => clearTimeout(t);
  }, [user, rooms, checkAvailability]);

  // ---------- actions ----------
  async function confirmBooking(payload) {
    await api.createBooking(payload);
    setModalRoom(null);
    showToast(`จอง ${modalRoom.name} สำเร็จ — เพิ่มลงปฏิทินแล้ว`);
    loadBookings();
    checkAvailability();
  }

  async function cancelBooking(b) {
    if (!confirm(`ยกเลิกการจอง "${b.title}" ?`)) return;
    try {
      await api.cancelBooking(b.id);
      showToast("ยกเลิกการจองแล้ว");
      loadBookings();
      checkAvailability();
    } catch (e) {
      showToast(e.message, "err");
    }
  }

  async function logout() {
    await api.logout();
    setUser(null);
    window.location.href = "/";
  }

  // ---------- render ----------
  if (user === undefined) {
    return <div className="login-wrap"><div className="empty">กำลังโหลด…</div></div>;
  }
  if (user === null) return <Login />;

  const freeCount = Object.values(availability).filter((a) => a.available).length;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="dot"><img src="/logo.png" alt="SUNSU" /></span> จองห้องประชุม
        </div>

        <div className="sync-cluster">
          <div className="sync-chip">
            <span className="sync-ic"><img src="/gcal.png" alt="Google Calendar" /></span>
            <span className={`sync-dot ${syncError ? "err" : "ok"} ${loadingAvail ? "live" : ""}`} />
            <span className="sync-tx">
              <b>Google Calendar</b>
              <span>
                {loadingAvail
                  ? "กำลังซิงค์…"
                  : syncError
                  ? "เชื่อมต่อไม่ได้"
                  : lastSync
                  ? `ซิงค์ล่าสุด ${lastSync.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`
                  : "เชื่อมต่อแล้ว"}
              </span>
            </span>
          </div>
          {/* Lark: แสดงสถานะไว้ก่อน (ยังไม่ได้ต่อ API จริง) */}
          <div className="sync-chip">
            <span className="sync-ic"><img src="/lark.png" alt="Lark" /></span>
            <span className="sync-dot ok" />
            <span className="sync-tx">
              <b>Lark</b>
              <span>เชื่อมต่อแล้ว</span>
            </span>
          </div>
        </div>

        <div className="user-chip">
          {user.picture && <img src={user.picture} alt="" referrerPolicy="no-referrer" />}
          <div>
            <div className="name">{user.name}</div>
            <div className="email">{user.email}</div>
          </div>
          <button className="linkbtn" onClick={logout}>ออกจากระบบ</button>
        </div>
      </header>

      <div className="shell">
        <main>
          <div className="controls">
            <div className="field">
              <label>วันที่</label>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาเริ่ม</label>
              <input
                type="time"
                className="time-mono"
                value={startTime}
                step="900"
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาสิ้นสุด</label>
              <input
                type="time"
                className="time-mono"
                value={endTime}
                step="900"
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <button className="btn" onClick={checkAvailability}>
              ↻ เช็คห้องว่าง
            </button>
          </div>

          <div className="section-head">
            <h2>ห้องประชุม</h2>
            <span className="count">
              {loadingAvail ? "กำลังตรวจสอบ…" : `ว่าง ${freeCount} / ${rooms.length} ห้อง`}
            </span>
          </div>

          <RoomBoard
            rooms={rooms}
            availability={availability}
            loading={loadingAvail && Object.keys(availability).length === 0}
            onBook={setModalRoom}
          />
        </main>

        <MyBookings
          bookings={bookings}
          loading={loadingBookings}
          onCancel={cancelBooking}
        />
      </div>

      {modalRoom && (
        <BookingModal
          room={modalRoom}
          start={toISO(date, startTime)}
          end={toISO(date, endTime)}
          onClose={() => setModalRoom(null)}
          onConfirm={confirmBooking}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type === "err" ? "err" : ""}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
