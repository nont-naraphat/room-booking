# ระบบจองห้องประชุม + Google Calendar (sync จริง)

ระบบจองห้องประชุมที่ต่อกับ **Google Calendar API** โดยตรง — เมื่อจองห้อง จะสร้าง event
ในปฏิทินของผู้จอง พร้อมเพิ่มห้อง (Workspace resource) เป็นผู้เข้าร่วม ห้องจะตอบรับอัตโนมัติถ้าว่าง
และการจองจะ **sync ขึ้นปฏิทินของทุกคน** ทันที ทั้งฝั่ง Google Calendar และ Room display

รองรับห้องที่มีอยู่แล้ว: `CK-1`, `CK-2` (Center Kitchen ชั้น 1) และ
`Dubai`, `Frankfurt`, `New York`, `Shanghai`, `Sydney`, `Tokyo` (BH ชั้น 17)

```
client (React + Vite)  ──►  server (Express)  ──►  Google Calendar API
   เลือกวันเวลา/ดูห้องว่าง        OAuth + freebusy + events     ปฏิทินจริงของทุกคน
```

---

## ฟีเจอร์

- เข้าสู่ระบบด้วย Google ขององค์กร (จำกัด domain ได้)
- ดูห้องว่าง/ไม่ว่างตามช่วงเวลาที่เลือก (ใช้ Google freebusy แบบ real-time)
- จองห้อง → สร้าง Google Calendar event จริง + ใส่ห้องเป็น resource + เชิญผู้เข้าร่วม
- กันการจองชนกัน (ถ้าห้อง decline ระบบจะยกเลิก event ให้อัตโนมัติ)
- ดู/ยกเลิกการจองของตัวเอง
- UI ภาษาไทย ใช้งานได้บนมือถือ

---

## สิ่งที่ต้องเตรียม

- Node.js 18+
- บัญชี **Google Workspace Admin** (เพื่อหา resource email ของห้อง)
- โปรเจกต์ใน **Google Cloud Console**

---

## ขั้นตอนที่ 1 — ตั้งค่า Google Cloud (OAuth)

1. ไปที่ <https://console.cloud.google.com> → สร้าง/เลือกโปรเจกต์
2. เปิดใช้งาน API: เมนู **APIs & Services → Library** → ค้นหา **Google Calendar API** → กด **Enable**
3. ตั้งค่า **OAuth consent screen**
   - User type: **Internal** (แนะนำ ถ้าใช้ในองค์กร)
   - ใส่ชื่อแอป, support email
   - Scopes: เพิ่ม `.../auth/calendar.events` และ `.../auth/calendar.freebusy`
4. สร้าง **Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs** ใส่:
     ```
     http://localhost:4000/auth/google/callback
     ```
     (ตอนขึ้น production ให้เพิ่ม URL จริง เช่น `https://booking.yourcompany.com/auth/google/callback`)
   - กด Create แล้วก๊อป **Client ID** กับ **Client secret** ไว้

---

## ขั้นตอนที่ 2 — หา Resource Email ของแต่ละห้อง

แต่ละห้องใน Google Workspace มีอีเมลประจำตัว (resource email) ที่ใช้สำหรับจอง

1. ไปที่ <https://admin.google.com> → **Buildings and resources → Manage resources**
2. คลิกที่ห้อง (เช่น `Tokyo`) → จะเห็น **Resource email** หน้าตาแบบ:
   ```
   c_xxxxxxxxxxxxxxxxxxxxxxxx@resource.calendar.google.com
   ```
3. ก๊อปมาใส่ในไฟล์ `server/rooms.config.js` ให้ครบทุกห้อง (ช่อง `resourceEmail`)

> เคล็ดลับ: ถ้าหาในแอดมินยาก ลองเปิด Google Calendar → สร้าง event → ช่อง **Rooms** →
> เลือกห้อง แล้วดูอีเมลของห้องนั้นได้เช่นกัน

---

## ขั้นตอนที่ 3 — ตั้งค่าและรัน Backend

```bash
cd server
cp .env.example .env      # แล้วเปิดแก้ค่าตามด้านล่าง
npm install
npm run dev
```

แก้ไฟล์ `.env`:

| ตัวแปร | ใส่อะไร |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | จากขั้นตอนที่ 1 |
| `GOOGLE_REDIRECT_URI` | `http://localhost:4000/auth/google/callback` |
| `SESSION_KEY1` / `SESSION_KEY2` | สุ่มยาว ๆ เช่น `openssl rand -hex 32` |
| `ALLOWED_HOSTED_DOMAIN` | โดเมนองค์กร เช่น `yourcompany.com` (เว้นว่างได้) |
| `TIMEZONE` | `Asia/Bangkok` |

อย่าลืมใส่ `resourceEmail` ใน `server/rooms.config.js` ให้ครบ

---

## ขั้นตอนที่ 4 — รัน Frontend

เปิด terminal ใหม่:

```bash
cd client
npm install
npm run dev
```

เปิดเบราว์เซอร์ที่ <http://localhost:5173> → กด "ดำเนินการต่อด้วย Google" → ใช้งานได้เลย

(ตอน dev ฝั่ง client จะ proxy `/api` และ `/auth` ไปที่ backend พอร์ต 4000 ให้อัตโนมัติ)

---

## การ sync สองทาง (two-way) ทำงานยังไง

**ฝั่งเขียน (แอป → Google)**
- **จอง** → `events.insert` ลงปฏิทินผู้จอง + ใส่ห้องเป็น `resource: true` (ห้อง auto-accept ถ้าว่าง / decline ถ้าชน)
- **แก้ไข / เลื่อนเวลา** → `events.patch` เขียนทับ event เดิม (ถ้าเวลาใหม่ห้องไม่ว่างจะแจ้งเตือนและไม่แก้)
- **ยกเลิก** → `events.delete` พร้อมแจ้งผู้เข้าร่วม

**ฝั่งอ่าน (Google → แอป)**
- ทุกครั้งที่เปิด/รีเฟรช แอปอ่านสถานะจริงจาก Google (`freebusy` / `events.list`) เสมอ
  → ถ้ามีคนจองห้องตรงใน Google Calendar แอปก็จะเห็นว่าไม่ว่างทันที

**Real-time (อัปเดตสด)**
- แอปเปิด SSE stream ที่ `/api/stream` ค้างไว้ เมื่อมีใครจอง/แก้/ยกเลิก *ในแอป*
  เซิร์ฟเวอร์จะ broadcast ให้ทุกคนรีเฟรชทันที + รีเฟรชอัตโนมัติเมื่อกลับมาที่หน้าต่าง
- ใช้งานได้เลยโดยไม่ต้องตั้งค่าอะไรเพิ่ม

### (ออปชัน) Real-time push จาก Google เต็มรูปแบบ

ถ้าต้องการให้แอปอัปเดต *ทันที* แม้มีการเปลี่ยนแปลงเกิดขึ้นใน Google Calendar โดยตรง
(ไม่ผ่านแอป) ให้เปิด Google push notifications:

1. มี service account + เปิด **domain-wide delegation** ให้ scope `calendar.readonly`
   (ใช้ watch ปฏิทินห้องเบื้องหลัง) แล้วตั้ง `GOOGLE_SERVICE_ACCOUNT_FILE`
2. Deploy เซิร์ฟเวอร์ให้มี **HTTPS public URL** และ **verify domain** ใน Google Search Console
3. ตั้ง `WEBHOOK_URL=https://<โดเมน>/notifications/google`
4. เรียก `events.watch` กับปฏิทินแต่ละห้อง (ตั้ง cron ต่ออายุทุก ~7 วัน)

Google จะ POST มาที่ `/notifications/google` เมื่อปฏิทินห้องเปลี่ยน → เซิร์ฟเวอร์ broadcast
ผ่าน SSE → ทุก client รีเฟรชทันที กลายเป็น two-way real-time เต็มรูปแบบ

---

## ขึ้น Production (สรุป)

1. Deploy `server` (เช่น Cloud Run / a VM) ตั้ง `NODE_ENV=production`
2. เพิ่ม production redirect URI ใน Google Cloud และตั้ง `GOOGLE_REDIRECT_URI` ให้ตรง
3. `cd client && npm run build` แล้ว serve โฟลเดอร์ `dist` (เสิร์ฟจาก backend หรือ static host ก็ได้)
4. ตั้ง `CLIENT_URL` ให้เป็นโดเมนจริง และเปิด cookie `secure`
5. แนะนำเปลี่ยน session store จาก cookie เป็น store ที่เหมาะกับ scale ที่ใหญ่ขึ้น

---

## โครงสร้างไฟล์

```
meeting-room-booking/
├── server/
│   ├── index.js              # Express + auth + SSE stream + webhook
│   ├── google.js             # OAuth + Calendar helpers
│   ├── sync.js               # SSE broadcaster (real-time)
│   ├── rooms.config.js       # ★ ใส่ resourceEmail ของห้องที่นี่
│   └── routes/
│       ├── rooms.js          # list rooms + availability (freebusy)
│       ├── bookings.js       # create / list / update / cancel
│       └── schedule.js       # ตารางทั้งวันของทุกห้อง (timeline)
└── client/
    ├── public/logo.png       # โลโก้ SUNSU
    └── src/
        ├── App.jsx           # state + controls + live subscribe
        ├── api.js            # เรียก backend + SSE
        └── components/       # Login, RoomBoard, BookingModal, MyBookings
```
