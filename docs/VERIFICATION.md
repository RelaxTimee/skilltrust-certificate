# ผลตรวจการทำงาน

ตรวจในเครื่องวันที่ 15 พฤศจิกายน 2569 (Asia/Bangkok)

| ส่วนที่ตรวจ | ผล |
| --- | --- |
| `npm test` | ผ่าน 52 กรณี ใน 8 test files ครอบคลุม React demo เดิมและเว็บจริงใหม่ |
| `npm run build` | ผ่าน TypeScript ของโปรเจกต์เดิม, JavaScript strict JSDoc ของเว็บจริง และ Vite production build |
| Dependency audit | ไม่พบ vulnerability หลัง pin compiler 0.8.26 และ override dependency `tmp` เป็น 0.2.7 |
| Local EVM | คอมไพล์ source ที่ verified และ deploy บน Anvil ทดสอบสิทธิ์ การออก เพิกถอน และพฤติกรรมขอบเขต |
| Ethers adapter | ทดสอบ BrowserProvider → preflight → local transaction → receipt สำหรับสร้างหลักสูตร ออก และเพิกถอน |
| Sepolia | อ่าน chain, owner, deployment receipt, code และเปรียบเทียบ executable bytecode ผ่าน ไม่ส่งธุรกรรมจริง |
| Browser → Sepolia | แสดงการเชื่อมต่อจริง ค้นหารหัสที่ไม่มีอยู่ และอ่าน CourseCreated โดยไม่มี console error |
| การจำกัดสิทธิ์ | แบบฟอร์มเขียนถูกปิดเมื่อไม่เชื่อม Wallet; ทดสอบ wrong chain, ปฏิเสธ และการยืนยันก่อนส่งด้วย provider จำลอง |
| หน้าเว็บจริง | ทดสอบแสดงข้อมูลอย่างปลอดภัยจาก HTML injection, exact-case ID, Hash ของไฟล์, revoke reason, issue payload และการเพิกถอนหลังยืนยัน |
| Mobile | ตรวจที่ viewport 390 px ไม่มี document horizontal overflow และฟอร์มยังอ่านได้ |
| Pages subpath | เปิด production build ที่ `/skilltrust-certificate/` พร้อม query deep link, assets โหลดครบ และไม่มี console error |

ข้อมูล Sepolia ณ block ที่ตรวจอยู่ใน `sepolia-check.json` ผลด้านบนเป็นการตรวจในเครื่อง ส่วนผล CI และ deployment ของแต่ละ commit ดูได้ที่ [GitHub Actions](https://github.com/RelaxTimee/skilltrust-certificate/actions/workflows/pages.yml) ซึ่งทดสอบและ build ซ้ำบน Ubuntu ก่อน deploy Pages

ไม่มีการทดสอบโดยลงชื่อหรือส่งธุรกรรมจาก Wallet จริงของผู้ใช้ การยืนยันธุรกรรม Sepolia ครั้งแรกต้องทำโดยเจ้าของสัญญา/issuer ตามคู่มือ ไม่มีหลักสูตรบน deployment ขณะตรวจ จึงไม่สร้างข้อมูลจริงเพื่อสาธิตแทนผู้ใช้
