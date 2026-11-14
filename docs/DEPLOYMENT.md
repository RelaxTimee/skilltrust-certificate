# นำขึ้น GitHub และเปิด GitHub Pages

Repository ของกลุ่ม: [RelaxTimee/skilltrust-certificate](https://github.com/RelaxTimee/skilltrust-certificate) · [เว็บไซต์ GitHub Pages](https://relaxtimee.github.io/skilltrust-certificate/)

สำหรับโปรเจกต์ปัจจุบันที่ตั้ง Git และ remote แล้ว ให้ใช้ขั้นตอนอัปเดตในข้อ 5 ไม่ต้องสร้าง repository หรือ git init ซ้ำ ส่วนข้อ 2–3 เก็บไว้สำหรับการตั้งค่า repository ใหม่หรือ fork

## 1. ตรวจในเครื่อง

ใช้ Node.js 22.12 ขึ้นไป เปิด PowerShell:

```powershell
cd "D:\Team DATA\CSI301\skilltrust-certificate"
npm ci
npm test
npm run build
npm run dev
```

เปิด URL ที่ Vite แสดง ปกติเป็น `http://localhost:5177/` หน้าเริ่มต้นใหม่เป็น HTML/CSS/JavaScript + Ethers.js ที่อ่านสัญญาจริง ส่วน React โหมดสาธิตเดิมใช้ `npm run dev:demo`

## 2. สร้าง repository ว่าง

เข้า GitHub แล้วกด New repository ตั้งชื่อ `skilltrust-certificate` สำหรับ GitHub Free ให้ใช้ Public หากต้องการ Pages แบบไม่เสียค่าใช้จ่าย อย่าเลือกสร้าง README, .gitignore หรือ LICENSE จากหน้า GitHub เพราะมีไฟล์ในเครื่องอยู่แล้ว เลือก license ของโค้ดแอปตามสิทธิ์ของทีมก่อนเผยแพร่ ต้นฉบับ Solidity ที่นำมามี SPDX MIT ซึ่งคงไว้ตามเดิม

คำสั่งต่อไปนี้ใช้เมื่อสร้าง repository ใหม่จากโฟลเดอร์ที่ยังไม่มี `.git` เท่านั้น แทน `YOUR_USERNAME` ด้วยชื่อบัญชีจริง:

```powershell
cd "D:\Team DATA\CSI301\skilltrust-certificate"
git init -b main
git add .
git diff --cached --stat
git status
git commit -m "Add DigitalCertificate frontend, contract tests and Pages workflow"
git remote add origin https://github.com/YOUR_USERNAME/skilltrust-certificate.git
git push -u origin main
```

ตรวจรายการก่อน commit ให้แน่ใจว่าไม่มี private key, `.env.local`, PDF ใบรับรองของบุคคลจริง หรือไฟล์ส่วนตัวติดไปด้วย `node_modules/` และ `dist/` ถูก ignore โดย workflow จะ build จาก source เอง ใช้ GitHub authentication ผ่าน Git Credential Manager หรือ SSH ตามที่ตั้งค่าไว้ ห้ามวาง token ลง URL หรือ commit ลงไฟล์

หาก Git ขอชื่อผู้เขียน ตั้งค่าระดับ repository หลัง git init:

```powershell
git config user.name "YOUR_NAME"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
```

หากมี remote อยู่แล้ว ให้ตรวจ `git remote -v` และเลือก repository ให้ถูกต้องก่อน ไม่ต้องรัน git init/remote add ซ้ำและไม่ต้องใช้ force push

## 3. เปิด GitHub Pages

1. เปิด repository → **Settings → Pages**
2. ใน **Build and deployment → Source** เลือก **GitHub Actions**
3. เปิดแท็บ **Actions** → workflow **Check and deploy GitHub Pages** หากรันแรกไม่ผ่านเพราะยังไม่ได้เปิด Pages ให้กด **Re-run all jobs** หลังตั้งค่า หรือเลือก **Run workflow** บน branch main
4. รอ jobs build และ deploy ผ่าน หาก environment `github-pages` ตั้งให้ reviewer อนุมัติ ให้ reviewer อนุมัติ deployment
5. เปิด URL จาก job deploy หรือ Settings → Pages ปกติคือ `https://YOUR_USERNAME.github.io/skilltrust-certificate/`

workflow ใช้ checkout/setup-node ที่ pin commit SHA, ติดตั้งด้วย lockfile, รันทดสอบ Anvil ในเครื่อง runner, ตรวจ TypeScript/JavaScript strict, build ลง `dist/` แล้วส่ง artifact ไป Pages โดยให้ `pages: write` และ `id-token: write` เฉพาะ deploy job ส่วน Pull Request ตรวจและ build เท่านั้น ไม่ publish

อ้างอิง [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) และ [การตั้งค่า publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 4. ทดสอบหลังเปิดเว็บ

- เปิดทั้งหน้าแรกและ URL `?certificate=YOUR_CERT_ID` บน Pages แล้ว refresh ต้องยังอ่านได้
- รูป ฟอนต์ JavaScript และ CSS ต้องโหลดจาก repository subpath ได้ เพราะใช้ Vite `base: './'` และ QR ใช้ URL ปัจจุบัน
- ค้นหารหัสที่ไม่มีอยู่ต้องแสดงไม่พบ ไม่รายงานว่า RPC ขัดข้องเป็นใบรับรองไม่ถูกต้อง
- เชื่อม Wallet บน Sepolia บัญชีทั่วไปดูใบรับรองตนเองได้ แต่ไม่มีสิทธิ์เขียน
- เจ้าของสัญญาสร้างหลักสูตรและตั้ง issuer ก่อน จากนั้นผู้ออกออกใบรับรองจริงโดยเลือก PDF ต้นฉบับ ผู้ใช้ต้องยืนยันธุรกรรมใน Wallet เอง
- คัดลอกลิงก์/สแกน QR จากมือถือ แล้วเลือก PDF เดิมตรวจ Hash ใบที่เพิกถอนต้องยังแสดงว่าไม่มีผลใช้งานแม้ Hash ตรงกัน

GitHub Pages เป็น static hosting การเขียนข้อมูลเกิดจาก Wallet → Sepolia โดยตรง ไม่ต้องมี Node server หรือเก็บ private key บน GitHub ไม่มี GitHub secret ที่จำเป็นสำหรับ workflow นี้

## 5. อัปเดตครั้งถัดไป

```powershell
npm test
npm run build
git add .
git diff --cached --stat
git commit -m "Describe the actual change"
git push
```

สำหรับงานทีม ให้เปิด branch แล้วทำ Pull Request เพื่อใช้ผล CI และ code review ก่อน merge main จากนั้น workflow จะ deploy version ใหม่

## แก้ปัญหาที่พบบ่อย

- **Actions บอก Pages ยังไม่เปิด**: ตรวจ Settings → Pages → Source เป็น GitHub Actions แล้ว rerun
- **404 หรือ asset หาย**: เปิด URL ที่มีชื่อ repository และ slash ปิดท้าย, ตรวจว่า workflow upload `dist/` ไม่ใช่ source `web/`
- **ไม่พบหลักสูตร**: ณ เวลาตรวจ deployment นี้ยังไม่มี CourseCreated เจ้าของต้องสร้างหลักสูตรก่อน
- **เขียนไม่ได้**: ใช้ Wallet ที่เป็น owner/issuer ตาม Contract จริง ไม่ใช่บัญชีสาธิต และเลือก Sepolia พร้อม Sepolia ETH
- **อ่าน RPC ไม่สำเร็จ**: ลองโหลดใหม่ Public RPC อาจจำกัดการใช้งาน เปลี่ยน endpoint สาธารณะใน `web/config.js` และ build ใหม่ ห้ามใส่ secret RPC API key ใน frontend
- **npm test หา Anvil ไม่พบ**: ต้องอนุญาต optional dependencies และมีแพ็กเกจ Anvil ตรง platform ห้ามใช้ `npm ci --omit=optional` ใน CI
- **ต้องการใช้งาน main branch ชื่ออื่น**: แก้ branches ใน `.github/workflows/pages.yml` ให้ตรงกับ branch ที่ใช้เผยแพร่
