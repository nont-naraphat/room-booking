# Admin Cleanup — เคลียร์การจองที่ organizer หายไปแล้ว

หน้าใหม่ (แท็บ **🧹 เคลียร์ค้าง** บน header, เห็นเฉพาะ admin) สำหรับกวาดการจองห้องที่
เจ้าของ (organizer) ถูกลบ / suspend / ไม่มี organizer — พวกที่กั๊ก slot คนอื่นแต่ไม่มีใครใช้แล้ว

## "ลบจริง" หมายถึงอะไร (สำคัญ)

Google Calendar: จะยกเลิกแล้วส่ง cancellation ถึง **ทุกคน** ได้ ต้องทำในฐานะ **organizer** เท่านั้น
โค้ดเลยแยก 2 เคส:

| เคส | สิ่งที่ทำ | ผล |
|---|---|---|
| organizer **ยังอยู่** (แค่ suspend) | impersonate organizer → `delete sendUpdates=all` | ยกเลิกให้ทุกคนสะอาด (รวมคนนอกโดเมน) ✅ |
| organizer **ถูกลบแล้ว** / เข้าไม่ได้ | ลบ copy ของห้อง + ไล่ลบ copy ของผู้ร่วม **ในโดเมน**ทีละคน | ห้องว่าง + คนในโดเมนหาย · **คนนอกโดเมนลบไม่ได้** (Google จำกัด) จะรายงานให้เห็น ⚠️ |

## เซฟตี้

- **Backup ก่อนลบทุกครั้ง** → เก็บ JSON ที่ `server/backups/`
- **กู้คืนได้ 30 วัน** จาก Trash ของปฏิทินห้อง (admin คนเดียวกันที่มีสิทธิ์แก้ event กู้ได้)
- หน้าเว็บ **สแกนก่อน** ให้เห็นรายการทั้งหมด กดลบทีละรายการ (มี confirm ที่บอกด้วยว่าเป็น recurring / มีคนนอกโดเมนกี่คน)

## ตั้งค่า (ครั้งเดียว)

### 1. Service account + DWD
มี service account (.json) อยู่แล้วจาก sharedrive-audit ก็ใช้ได้ ตั้ง path ที่ env:
```
GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/sa-21sun.json
```
เพิ่ม DWD scopes ใน Admin Console → Security → Access and data control → API controls →
Manage Domain Wide Delegation → แก้ client เดิม
> ⚠️ ช่อง scope **overwrite ไม่ append** — ต้องใส่ scope เดิมทั้งหมดรวมกับ 2 ตัวนี้ในบรรทัดเดียว (comma)
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/admin.directory.user.readonly
```

### 2. Admin subject
```
GOOGLE_ADMIN_SUBJECT=admin@21sunpassion.com
```
admin คนนี้ต้องมีสิทธิ์ **"Make changes to events"** บนปฏิทินห้องทุกห้อง
(ถ้าเจอ 403 ตอนลบ copy ห้อง = ยังไม่ได้เปิดสิทธิ์ห้องนั้น → Google Calendar ห้อง > Settings and sharing > Share with specific people)

### 3. โดเมน + ใครเข้าได้
```
OUR_DOMAINS=21sunpassion.com,office21sun.com
ADMIN_EMAILS=nont.naraphat@21sunpassion.com
```
`ADMIN_EMAILS` เว้นว่าง = ไม่มีใครเห็นแท็บนี้เลย (ปลอดภัยไว้ก่อน)

## ทดสอบ (แนะนำ pilot)

1. ใส่ `ADMIN_EMAILS` เป็นอีเมลตัวเองคนเดียวก่อน
2. เปิดแท็บ 🧹 เคลียร์ค้าง → กดสแกน → ดูรายการ
3. ลองกดยกเลิก **1 รายการที่ organizer ถูกลบชัวร์ๆ** → เช็คว่าห้องว่างจริง
4. ถ้าพลาด → Google Calendar ห้องนั้น > เฟือง > Trash > Restore (ภายใน 30 วัน)
5. โอเคแล้วค่อยไล่เคลียร์ที่เหลือ

## API ที่เพิ่ม

- `GET  /api/admin/orphans?daysAhead=365` — สแกนทุกห้อง
- `POST /api/admin/orphans/cancel` — body `{ roomEmail, eventId, organizer }`

ทั้งคู่กันด้วย `ADMIN_EMAILS` (403 ถ้าไม่ใช่ admin)
