# ---------- Stage 1: build the React frontend ----------
FROM node:20-alpine AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---------- Stage 2: backend + serve the built frontend ----------
FROM node:20-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# ติดตั้งเฉพาะ dependency ของ server
COPY server/package*.json ./
RUN npm install --omit=dev

# ก๊อปโค้ด server + ไฟล์ frontend ที่ build แล้ว
COPY server/ ./
COPY --from=client /client/dist ./client-dist

EXPOSE 4000
CMD ["node", "index.js"]
