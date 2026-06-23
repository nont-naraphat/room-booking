# Deploy ขึ้น Portainer — ทีละขั้น

แอปนี้แพ็กเป็น **คอนเทนเนอร์เดียว** (Node เสิร์ฟทั้ง API และหน้าเว็บที่ build แล้ว)
ฟังที่พอร์ต `4000` ภายใน — แนะนำวางหลัง reverse proxy (HTTPS) เช่น Nginx Proxy Manager / Traefik

```
ผู้ใช้ ──HTTPS──► Reverse Proxy ──http://roombook:4000──► คอนเทนเนอร์ roombook
                (booking.yourcompany.com)                 (API + เว็บ + Google Calendar)
```

---

## 0) เตรียมก่อน

- มี Portainer + Docker host พร้อมใช้งาน
- มีโดเมน เช่น `booking.yourcompany.com` ชี้มาที่เซิร์ฟเวอร์ + ใบ SSL (ผ่าน reverse proxy)
- ทำ Google Cloud OAuth + ใส่ `resourceEmail` ของห้องใน `server/rooms.config.js` เรียบร้อย
  (ดู README หลัก)

> **สำคัญ:** ต้องเป็น HTTPS เพราะ production ใช้ cookie แบบ `secure`
> และ Google OAuth ต้องการ redirect URI ที่ตรงเป๊ะ

---

## 1) ตั้งค่า Google Cloud สำหรับ production

ใน Google Cloud Console → Credentials → OAuth client → เพิ่ม **Authorized redirect URI**:

```
https://booking.yourcompany.com/auth/google/callback
```

(เก็บ Client ID / Secret ไว้ใส่ใน Portainer ตอนถัดไป)

---

## 2) Deploy บน Portainer

มี 2 วิธี เลือกอันที่สะดวก

### วิธี A — Stack จาก Git repository (Portainer build ให้, ง่ายสุด)

1. อัปโค้ดทั้งโปรเจกต์ขึ้น Git (GitHub/GitLab/Gitea) — ต้องมี `Dockerfile` กับ
   `docker-compose.yml` อยู่ที่ root (มีให้แล้ว)
2. Portainer → **Stacks → + Add stack**
3. ตั้งชื่อ stack เช่น `roombook`
4. Build method เลือก **Repository**
   - Repository URL: ใส่ลิงก์ repo
   - Compose path: `docker-compose.yml`
   - ถ้า repo เป็น private ใส่ credential ด้วย
5. เลื่อนลงมาที่ **Environment variables** → กด *Add an environment variable* ใส่ทีละตัว
   (ดูตารางข้อ 3)
6. กด **Deploy the stack** — Portainer จะ build image แล้วรันให้

### วิธี B — Build เองแล้ว push image ขึ้น registry

ถ้า Docker host build ไม่ได้/ไม่อยากต่อ Git:

```bash
# บนเครื่องที่มี Docker + โค้ดโปรเจกต์
docker build -t your-registry/roombook:latest .
docker push your-registry/roombook:latest
```

แล้วใน Portainer → **Stacks → + Add stack → Web editor** วาง compose นี้
(แก้ `build: .` เป็น `image:` ของคุณ):

```yaml
services:
  roombook:
    image: your-registry/roombook:latest
    container_name: roombook
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: "4000"
      TIMEZONE: Asia/Bangkok
      CLIENT_URL: ${CLIENT_URL}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
      SESSION_KEY1: ${SESSION_KEY1}
      SESSION_KEY2: ${SESSION_KEY2}
      ALLOWED_HOSTED_DOMAIN: ${ALLOWED_HOSTED_DOMAIN}
```

ใส่ Environment variables (ข้อ 3) แล้ว **Deploy the stack**

---

## 3) Environment variables ที่ต้องใส่ใน Portainer

| ตัวแปร | ตัวอย่างค่า |
|---|---|
| `CLIENT_URL` | `https://booking.yourcompany.com` |
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `xxxxxxxx` |
| `GOOGLE_REDIRECT_URI` | `https://booking.yourcompany.com/auth/google/callback` |
| `SESSION_KEY1` | สุ่มยาว ๆ (เช่น `openssl rand -hex 32`) |
| `SESSION_KEY2` | สุ่มอีกอัน |
| `ALLOWED_HOSTED_DOMAIN` | `yourcompany.com` (เว้นว่างได้) |

---

## 4) ต่อ reverse proxy ให้เป็น HTTPS

ตั้ง proxy ให้โดเมน `booking.yourcompany.com` ชี้ไปที่คอนเทนเนอร์ พอร์ต `4000`

**Nginx Proxy Manager:** Add Proxy Host
- Domain: `booking.yourcompany.com`
- Forward Hostname: `roombook` (ชื่อคอนเทนเนอร์ ถ้าอยู่ network เดียวกัน) หรือ IP ของ host
- Forward Port: `4000`
- เปิด **Websockets Support** (สำหรับ SSE/real-time)
- แท็บ SSL: ขอ Let's Encrypt + Force SSL

> ถ้า proxy กับคอนเทนเนอร์อยู่คนละ Docker network ให้ใช้ `IP_ของ_host:4000`
> หรือเอาทั้งสองไปไว้ใน network เดียวกันแล้วเรียกด้วยชื่อ `roombook`

**Traefik (labels):** เพิ่มใน service `roombook` ของ compose

```yaml
    labels:
      - traefik.enable=true
      - traefik.http.routers.roombook.rule=Host(`booking.yourcompany.com`)
      - traefik.http.routers.roombook.entrypoints=websecure
      - traefik.http.routers.roombook.tls.certresolver=le
      - traefik.http.services.roombook.loadbalancer.server.port=4000
```

---

## 5) ตรวจสอบหลัง deploy

1. เปิด `https://booking.yourcompany.com/health` → ควรได้ `{"ok":true}`
2. เปิดหน้าแอป → กด “ดำเนินการต่อด้วย Google” → ล็อกอินได้
3. ลองจองห้อง → เช็คใน Google Calendar ว่ามี event ขึ้นจริง
4. เปิดแอปสองแท็บ จองในแท็บหนึ่ง → อีกแท็บควรอัปเดตเอง (real-time ผ่าน SSE)

---

## 6) อัปเดตเวอร์ชันใหม่

- **วิธี A (Git):** push โค้ดใหม่ → Portainer → Stack `roombook` → **Pull and redeploy**
  (เปิด *Re-pull image and redeploy* / Re-build)
- **วิธี B (registry):** build+push image tag ใหม่ → Stack → **Update the stack**

---

## หมายเหตุ

- แอปนี้ไม่ต้องใช้ฐานข้อมูล/volume (session เก็บใน signed cookie) — ลบ/สร้าง container ใหม่ได้ไม่กระทบข้อมูล
- ถ้าจะเปิด **Real-time push จาก Google** เต็มรูปแบบ (service account + webhook)
  ดูหัวข้อ “Real-time push” ใน README หลัก แล้วเพิ่ม env `WEBHOOK_URL`, `GOOGLE_SERVICE_ACCOUNT_FILE`
  (ต้อง mount ไฟล์ service account เข้า container เพิ่ม)
