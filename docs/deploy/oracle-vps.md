# Deploy 24/7 ฟรีบน Oracle Cloud (Always Free)

ผลลัพธ์: บอทรันตลอด 24 ชม. บนเซิร์ฟเวอร์ฟรีของ Oracle พร้อม webhook URL **ถาวร** (`https://ชื่อคุณ.duckdns.org/webhook`) — ปิด Mac ได้เลย

ใช้ไฟล์ที่เตรียมไว้แล้วในรีโปนี้: [`apps/backend/Dockerfile`](../../apps/backend/Dockerfile) · [`docker-compose.prod.yml`](../../docker-compose.prod.yml) · [`deploy/Caddyfile`](../Caddyfile)

---

## ขั้นที่ 1 — สมัคร Oracle Cloud (คุณทำเอง ~15 นาที)

1. ไป [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) → **Start for free**
2. ต้องใช้**บัตรเครดิต/เดบิต**ยืนยันตัวตน (Always Free **ไม่เก็บเงิน** — บัตรใช้ยืนยันอย่างเดียว)
3. **Home region เลือก Singapore** (ใกล้ไทย, เปลี่ยนทีหลังไม่ได้)

## ขั้นที่ 2 — สร้างเซิร์ฟเวอร์ (VM)

1. เมนู ☰ → **Compute → Instances → Create instance**
2. **Image**: Ubuntu 22.04 (หรือ 24.04)
3. **Shape**: กด Change shape → **Ampere → VM.Standard.A1.Flex** (2 OCPU / 12 GB ก็เหลือเฟือ — ฟรีสูงสุด 4 OCPU / 24 GB)
   - ⚠️ ถ้าขึ้น **"Out of capacity"** = เครื่องฟรีหมดชั่วคราว → ลองเวลาอื่น หรือใช้ **VM.Standard.E2.1.Micro** (เล็กกว่าแต่พอรันได้)
4. **SSH keys**: เลือก *Generate a key pair* → **ดาวน์โหลด private key เก็บไว้** (ไฟล์ `.key`)
5. Create → รอสถานะ Running → **จด Public IP**

## ขั้นที่ 3 — เปิดพอร์ตเว็บ

Instance → คลิกลิงก์ **Virtual cloud network** → **Security Lists** → Default → **Add Ingress Rules** เพิ่ม 2 กติกา:

| Source CIDR | Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

## ขั้นที่ 4 — โดเมนฟรี (DuckDNS)

1. ไป [duckdns.org](https://www.duckdns.org) → sign in ด้วย Google
2. ตั้งชื่อ subdomain เช่น `mybutler` → **add domain**
3. ช่อง current ip ใส่ **Public IP ของ VM** → update ip

ได้โดเมนถาวร: `mybutler.duckdns.org`

## ขั้นที่ 5 — ติดตั้งบนเซิร์ฟเวอร์ (copy-paste ได้เลย)

จาก Mac เปิด Terminal:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>
```

บนเซิร์ฟเวอร์ (ครั้งแรกครั้งเดียว):

```bash
# 1) ติดตั้ง Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # ออกแล้ว ssh เข้าใหม่ เพื่อให้สิทธิ์ docker ทำงาน
```

```bash
# 2) firewall ภายในเครื่อง Oracle (image ของ Oracle บล็อกพอร์ตไว้อีกชั้น)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
```

## ขั้นที่ 6 — เอาโค้ดขึ้นเซิร์ฟเวอร์

วิธีง่ายสุดโดยไม่ต้องมี GitHub — จาก **Mac** (ในโฟลเดอร์โปรเจกต์):

```bash
cd "/Users/kazelle.z/Desktop/Transaction Bot"
tar --exclude node_modules --exclude .devtools --exclude .git -czf /tmp/bot.tgz .
scp -i ~/Downloads/ssh-key-*.key /tmp/bot.tgz ubuntu@<PUBLIC_IP>:~
```

บน**เซิร์ฟเวอร์**:

```bash
mkdir -p finance-butler && tar xzf bot.tgz -C finance-butler && cd finance-butler
```

## ขั้นที่ 7 — ตั้งค่า + รัน

บนเซิร์ฟเวอร์ สร้างไฟล์ `.env.prod`:

```bash
cat > .env.prod <<'EOF'
NODE_ENV=production
LINE_CHANNEL_ACCESS_TOKEN=ใส่ของจริง
LINE_CHANNEL_SECRET=ใส่ของจริง
JWT_SECRET=สุ่มยาวๆ64ตัวขึ้นไป
POSTGRES_PASSWORD=ตั้งรหัสฐานข้อมูลเอง
DOMAIN=mybutler.duckdns.org
CORS_ORIGINS=https://mybutler.duckdns.org
OCR_PROVIDER=tesseract
# DATABASE_URL / REDIS_URL ไม่ต้องใส่ — docker-compose ตั้งให้เอง
EOF
```

แล้วสตาร์ท (ครั้งแรก build ~5 นาที):

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api   # ดูจนขึ้น "API listening" แล้ว Ctrl-C
```

## ขั้นที่ 8 — ชี้ LINE มาที่เซิร์ฟเวอร์

LINE Developers Console → Messaging API → Webhook URL:

```
https://mybutler.duckdns.org/webhook
```

กด **Verify** → Success → เสร็จ! **ปิด Mac ได้เลย** 🎉

---

## ดูแลระบบ

| ทำอะไร | คำสั่ง (บนเซิร์ฟเวอร์) |
|---|---|
| ดู log | `docker compose -f docker-compose.prod.yml logs -f api worker` |
| รีสตาร์ท | `docker compose -f docker-compose.prod.yml restart` |
| อัปเดตโค้ดเวอร์ชันใหม่ | scp ไฟล์ใหม่ขึ้นมา แล้ว `up -d --build` ซ้ำ |
| แบ็กอัพฐานข้อมูล | `docker exec $(docker ps -qf name=postgres) pg_dump -U postgres finance_butler > backup.sql` |

หมายเหตุ: ทุกอย่าง (`restart: unless-stopped`) ฟื้นเองอัตโนมัติแม้เซิร์ฟเวอร์รีบูต
