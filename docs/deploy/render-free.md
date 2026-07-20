# Deploy ฟรีบน Render + Supabase (ไม่ต้องใช้บัตร)

ผลลัพธ์: บอทรันในคลาวด์ 24 ชม. ปิด Mac ได้ ใช้แค่ 2 บริการฟรี (Render รันโค้ด + Supabase เก็บฐานข้อมูล) — ไม่ต้องมี Redis เพราะบอทรองรับ "inline mode" ในโปรเซสเดียวแล้ว

⚠️ ข้อจำกัดของฟรี tier ที่ต้องยอมรับ: เงียบเกิน ~15 นาที บอทจะหลับ ข้อความแรกหลังตื่นตอบช้า ~50 วินาที (ลดได้ด้วย UptimeRobot ดูท้ายไฟล์)

---

## ขั้นที่ 1 — เอาโค้ดขึ้น GitHub

1. ไป [github.com/new](https://github.com/new) → Repository name: `finance-butler` → เลือก **Private** → **Create repository** (ไม่ต้องติ๊ก README)
2. เปิด Terminal บน Mac รันทีละบรรทัด (เปลี่ยน `USERNAME` เป็นชื่อ GitHub ของคุณ):

```bash
cd "/Users/kazelle.z/Desktop/Transaction Bot"
git remote add origin https://github.com/USERNAME/finance-butler.git
git push -u origin main
```

ครั้งแรก macOS จะให้ล็อกอิน GitHub (เด้ง browser) — ล็อกอินแล้ว push จะวิ่งเอง

## ขั้นที่ 2 — สร้างฐานข้อมูลฟรีที่ Supabase

1. [supabase.com](https://supabase.com) → sign in ด้วย GitHub → **New project**
2. Region: **Southeast Asia (Singapore)** · ตั้ง **Database password** แล้ว**จดไว้**
3. พอสร้างเสร็จ กดปุ่ม **Connect** (บนขวา) → แท็บ **ORMs** (หรือเลือก Session pooler)
4. คัดลอก URI แบบ **Session pooler** (port **5432**) หน้าตาประมาณ:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
5. แทน `[YOUR-PASSWORD]` ด้วยรหัสที่ตั้งไว้ — นี่คือค่า `DATABASE_URL`

## ขั้นที่ 3 — สร้าง Web Service ที่ Render

1. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → เชื่อม GitHub → เลือก repo `finance-butler`
2. ตั้งค่าตามนี้:

| ช่อง | ค่า |
|---|---|
| Language | Node |
| Branch | `main` |
| Root Directory | *(เว้นว่าง)* |
| **Build Command** | `npm ci --include=dev && npm run build:render` |
| **Start Command** | `npm run start:render` |
| Instance Type | **Free** |

3. **Environment Variables** (กด Add):

| Key | Value |
|---|---|
| `DATABASE_URL` | URI จากขั้นที่ 2 |
| `LINE_CHANNEL_ACCESS_TOKEN` | ก๊อปจาก `apps/backend/.env` บน Mac |
| `LINE_CHANNEL_SECRET` | ก๊อปจาก `apps/backend/.env` บน Mac |
| `JWT_SECRET` | ก๊อปจาก `apps/backend/.env` บน Mac |
| `NODE_ENV` | `production` |

   **ไม่ต้องใส่ `REDIS_URL`** — ปล่อยว่าง บอทจะเข้าโหมด inline อัตโนมัติ

4. (แนะนำ) Settings → Health Check Path: `/healthz`
5. กด **Deploy Web Service** → รอ build ~5 นาที → ดู log จนขึ้น `Finance Butler API listening`

## ขั้นที่ 4 — ชี้ LINE มาที่ Render

Render จะให้ URL ถาวร เช่น `https://finance-butler-xxxx.onrender.com`

LINE Developers Console → Messaging API → **Webhook URL**:

```
https://finance-butler-xxxx.onrender.com/webhook
```

กด **Verify** → Success → **เสร็จ ปิด Mac ได้เลย** 🎉

## เสริม — ลดอาการหลับ (ฟรี)

สมัคร [uptimerobot.com](https://uptimerobot.com) (ฟรี) → New Monitor → HTTP(s) → URL = `https://…onrender.com/healthz` → interval 5 นาที
บอทจะโดนปลุกทุก 5 นาทีจนแทบไม่หลับเลย

## อัปเดตโค้ดในอนาคต

โค้ดใหม่ → `git push` → Render deploy ให้เองอัตโนมัติ
