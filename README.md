# SkillTrust Academy — Digital Certificate

Assignment 10: เว็บภาษาไทยสำหรับออกและตรวจสอบใบรับรองบน **Ethereum Sepolia** ใช้ HTML, CSS และ JavaScript แบบ strict JSDoc พร้อม **Ethers.js 6** และ build เป็น static website สำหรับ GitHub Pages

[เปิดเว็บไซต์](https://relaxtimee.github.io/skilltrust-certificate/) · [GitHub repository](https://github.com/RelaxTimee/skilltrust-certificate) · [ผลตรวจและการ Deploy](https://github.com/RelaxTimee/skilltrust-certificate/actions/workflows/pages.yml)

**Contract:** [`0x261d3AcB0599f162162ae5e8032686b18E1Db5f0`](https://sepolia.etherscan.io/address/0x261d3AcB0599f162162ae5e8032686b18E1Db5f0#code) · Chain ID `11155111`

ลิงก์โค้ดที่ได้รับ (`0x34FDB2B9...`) เป็น AgriTraceability ของงานเกษตร โปรเจกต์นี้ใช้ source/ABI ที่ verified จาก Address ใบรับรองจริง และตรวจ executable bytecode ตรงกับ deployment แล้ว ดู [ผล review](docs/CONTRACT_REVIEW.md)

## เปิดใช้งาน

ใช้ Node.js 22.12 ขึ้นไป จากโฟลเดอร์นี้:

```sh
npm ci
npm run dev
```

เปิด URL ที่ Vite แสดง ปกติเป็น `http://localhost:5177/` หากพอร์ตถูกใช้จะเลือกพอร์ตถัดไป ไม่ต้องตั้ง private key, API key หรือเซิร์ฟเวอร์ Backend การอ่านใช้ public RPC และการเขียนใช้ Wallet ของผู้ใช้

```sh
npm test                 # Unit, UI, adapter และสัญญาจริงบน Anvil ในเครื่อง
npm run build           # ตรวจ TypeScript / JavaScript strict และ build ลง dist/
npm run preview         # แสดง production build
npm run verify:sepolia   # ตรวจ deployment ผ่าน RPC แบบอ่านอย่างเดียว
```

ติดตั้ง Anvil เป็น optional dependency ตาม Windows, Linux หรือ macOS จึงห้ามใช้ `--omit=optional` เมื่อต้องรันทดสอบ Contract การทดสอบใช้ local chain ไม่มี Gas บน Sepolia และไม่ใช้ private key จริง

## ฟังก์ชันใช้งานจริง

- **ตรวจสอบใบรับรอง:** ค้นหารหัสแบบแยกตัวพิมพ์ แสดงหลักสูตร ผู้รับ ผู้ออก เวลา Block และสถานะเพิกถอน ไม่ต้องเชื่อม Wallet
- **ตรวจ PDF:** คำนวณ SHA-256 ของ bytes ทั้งไฟล์ในอุปกรณ์ แล้วเรียก checkHash พร้อมตรวจสถานะปัจจุบัน ไฟล์และชื่อไฟล์ไม่ถูกอัปโหลด
- **QR / ลิงก์:** สร้างในเบราว์เซอร์ ลิงก์ `?certificate=...` รักษา path ของ Pages และ refresh ได้โดยไม่ต้องมี server routing
- **ใบรับรองของฉัน:** อ่าน getCertificatesOf ของ Wallet รวมใบที่เพิกถอนแล้ว แบ่งรายละเอียดครั้งละ 9 ใบ
- **หลักสูตร:** อ่าน CourseCreated จาก deployment block แบบแบ่งช่วง และ getCourse แต่ละรหัส เจ้าของสัญญาสร้างหลักสูตรได้
- **ออกใบรับรอง:** owner หรือ issuer เลือกหลักสูตร ระบุรหัส Wallet ผู้รับ และ PDF วันที่ออกใช้เวลา Block จริง
- **เพิกถอน:** เฉพาะ owner พร้อมเหตุผล คงข้อมูลการออกและ Hash เดิม
- **จัดการ issuer:** owner เรียก setIssuer เพื่อให้หรือถอนสิทธิ์ Wallet
- **ธุรกรรม:** ให้ตรวจข้อมูลก่อนเปิด Wallet จำลองการเรียกก่อนส่ง ตรวจบัญชี/Chain ID รอ receipt และแสดง Etherscan รองรับปฏิเสธ ยกเลิก แทนที่ และ timeout โดยไม่รายงาน success ล่วงหน้า

รองรับ injected EIP-1193/EIP-6963 เช่น MetaMask หากอยู่ผิดเครือข่าย เว็บยังอ่านผ่าน public RPC ได้ แต่ปิดการเขียนจนเปลี่ยนเป็น Sepolia การ disconnect ในแอปไม่ใช่ถอน site permission ในกระเป๋า

## เริ่มใช้งาน Contract

ขณะตรวจยังไม่มีหลักสูตร owner ต้องทำขั้นตอนเริ่มต้นก่อน:

1. owner เชื่อม Wallet และเลือก Sepolia แล้วสร้างหลักสูตรใน **หลักสูตรการอบรม**
2. หากใช้ผู้ออกแยกจาก owner เปิด **จัดการสิทธิ์ผู้ออก** แล้วให้สิทธิ์ Wallet นั้น
3. owner/issuer เปิด **ออกใบรับรอง** กรอกรหัสหลักสูตรให้ตรง เลือก PDF แล้วตรวจและยืนยันใน Wallet
4. ผู้รับเปิด **ใบรับรองของฉัน** หรือใช้รหัส/ลิงก์/QR เพื่อดูสถานะและตรวจ PDF

owner ที่อ่านได้ตอนตรวจคือ `0x6124E88b9DBE3c7b3F1e53686224d44668C65933` หน้าเว็บอ่านสิทธิ์จาก Contract ไม่ใช้บัญชีสาธิตหรือ localStorage มาตัดสินสิทธิ์

## โครงสร้าง

```text
.github/              CI, Pages workflow และ PR template
contracts/            Solidity source เดิมและ provenance; reference/ เป็นสัญญาเกษตร
docs/                 ผล review, deployment guide, Sepolia check และคู่มือ demo เดิม
public/               favicon และ PDF fixture สำหรับทดสอบ
scripts/              compiler helper และ read-only deployment verification
web/                  HTML / CSS / JavaScript / Ethers.js สำหรับเว็บจริง
src/                  React / viem โหมดสาธิตเดิมสำหรับ reference
tests/                Domain, UI, wallet, adapter และ local-EVM contract tests
vite.pages.config.ts  เว็บจริง ใช้ relative base สำหรับ repository subpath
```

Address, RPC และ deployment block อยู่ใน `web/config.js` ABI อยู่ใน `web/abi.json` หาก deploy รุ่นใหม่ต้องเปลี่ยนให้ตรงกันทั้งหมด ไม่มีการรับ Address/RPC ผ่าน URL

React demo เดิมยังอยู่ แต่ไม่ใช่เว็บที่ workflow เผยแพร่ ใช้ `npm run dev:demo` / `npm run build:demo` ดู [คู่มือ demo](docs/DEMO.md) ทั้งสอง build ใช้ dist เดียวกัน ต้องรัน `npm run build` ก่อน preview/เผยแพร่เว็บจริงเสมอ

## ข้อควรเข้าใจ

- เป็น **Testnet** ไม่ใช่การรับรองคุณวุฒิ production ต้องใช้ Sepolia ETH เฉพาะตอนเขียน
- Hash ตรงกันยืนยันว่า bytes ตรงกับหลักฐานของผู้ออก ไม่ยืนยันความถูกต้องของการอบรมเอง และใบที่เพิกถอนยังไม่มีผลใช้งานแม้ Hash ตรง
- Contract ไม่ระบุ algorithm จึงต้องใช้ SHA-256 ของ PDF bytes เป็นนโยบายร่วมกัน เว็บนี้ส่งเป็น bytes32 (`0x` + hex 64 ตัวอักษร) หากเอกสารเดิมใช้ algorithm อื่นจะไม่จับคู่ให้ผิดโดยเงียบ ๆ
- Contract แยกรหัสด้วยตัวพิมพ์และช่องว่าง เว็บรักษารหัสตามที่กรอก แต่ไม่รับช่องว่างล้วนหรือรหัสเกิน 256 UTF-8 bytes
- ห้ามใส่ข้อมูลส่วนบุคคลในรหัส รายละเอียด หรือเหตุผลเพิกถอน เพราะ Public Blockchain อ่านได้แม้ mapping เป็น private และ Wallet อาจเชื่อมโยงบุคคลได้
- Public RPC อาจขัดข้องหรือจำกัด log query เว็บแยก error จากกรณีไม่พบใบรับรอง การ scan หลักสูตรแบ่งช่วง แต่เมื่อข้อมูลมากควรมี indexer; getCertificatesOf ยังคืนรหัสทั้งชุดตามข้อจำกัด Contract
- Hash ต้องใช้ HTTPS หรือ localhost GitHub Pages มี HTTPS อยู่แล้ว QR localhost ใช้ข้ามอุปกรณ์ไม่ได้
- ไม่มีการสร้าง PDF หรือ upload server ต้องใช้ PDF ต้นฉบับที่ออกจากระบบภายนอกและมี bytes เดิม

## เผยแพร่

ดู [คำสั่ง Git และวิธีเปิด Pages](docs/DEPLOYMENT.md) workflow ทดสอบและ build ก่อน deploy main ส่วน PR ตรวจอย่างเดียว Repository ของกลุ่มคือ `RelaxTimee/skilltrust-certificate` และเผยแพร่ผ่าน GitHub Pages โดยติดตามผลแต่ละครั้งได้จาก Actions

อ้างอิง: [Ethers.js v6](https://docs.ethers.org/v6/getting-started/), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Verified Contract](https://sepolia.etherscan.io/address/0x261d3AcB0599f162162ae5e8032686b18E1Db5f0#code)
