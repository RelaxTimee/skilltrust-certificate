# ตรวจ Smart Contract — Assignment 10

ตรวจวันที่ 15 พฤศจิกายน 2569 (Asia/Bangkok) โดยอ่าน source ที่ verified บน Etherscan คอมไพล์ด้วย Solidity 0.8.26 และรันกับ Anvil จริงในเครื่อง ไม่ใช่เพียงการสมมติผล และไม่ได้ส่งธุรกรรมบน Sepolia

## ต้องแยกสัญญาสองตัว

| ข้อมูลที่ได้รับ                                      | สัญญาที่พบ           | การใช้ในงานนี้                                                        |
| ---------------------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Address `0x261d3AcB0599f162162ae5e8032686b18E1Db5f0` | `DigitalCertificate` | ใช้กับ frontend ใบรับรอง                                              |
| ลิงก์ `0x34FDB2B9A3EF9A2250e8cDEd86237FbCA1eFC7dE`   | `AgriTraceability`   | ตรวจแยกเป็น reference ของงานเกษตร ห้ามใช้ ABI นี้กับ Address ใบรับรอง |

แหล่งต้นฉบับ: [DigitalCertificate บน Sepolia](https://sepolia.etherscan.io/address/0x261d3AcB0599f162162ae5e8032686b18E1Db5f0#code), [AgriTraceability จากลิงก์ที่ได้รับ](https://sepolia.etherscan.io/address/0x34FDB2B9A3EF9A2250e8cDEd86237FbCA1eFC7dE#code)

เก็บ source เดิมใน `contracts/` และข้อมูลที่มา/Hash ใน `contracts/provenance.json` โดยปรับเฉพาะ line endings เป็น LF ไม่แก้ logic ของสัญญาที่ deploy แล้ว ผลตรวจออนไลน์ที่รันซ้ำได้อยู่ใน `docs/sepolia-check.json` และคำสั่ง `npm run verify:sepolia`

## ผลคอมไพล์และการตรวจ deployment

- คอมไพล์ทั้งสองสัญญาด้วย `solc 0.8.26+commit.8a97fa7a`, optimizer ปิด, EVM Cancun ตามค่า default ของ compiler รุ่นนี้ ผ่านโดยไม่มี compiler error
- ABI ที่ compiler สร้างสำหรับ DigitalCertificate ตรงกับ ABI ที่ดาวน์โหลดจาก Address ใบรับรอง
- executable bytecode ที่คอมไพล์ได้ตรงกับ runtime ของ deployment บน Sepolia เปรียบเทียบโดยตัด CBOR metadata ซึ่งอาจเปลี่ยนจาก line endings ของ source
- DigitalCertificate มี runtime 9,936 bytes, deployment block `12132406` และ owner ที่อ่านได้คือ `0x6124E88b9DBE3c7b3F1e53686224d44668C65933`
- ขณะตรวจยังไม่พบ CourseCreated จึงไม่มีหลักสูตรให้แสดง เจ้าของต้องสร้างหลักสูตรก่อนออกใบรับรอง ส่วนนี้เป็นข้อมูล ณ block ที่บันทึกในรายงาน ไม่ใช่ข้อสมมติถาวร

## ข้อสังเกตของ DigitalCertificate

| ระดับ                   | ตำแหน่ง                                      | หลักฐานและผลกระทบ                                                                                                      | แนวทางปรับปรุง                                                                                                                                      |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| สำคัญต่อการเชื่อมต่อ    | ABI / Address                                | ลิงก์โค้ดเป็นคนละสัญญา การใช้ ABI เกษตรจะเรียกฟังก์ชันใบรับรองไม่ได้                                                   | ใช้ source และ ABI จาก Address ใบรับรองจริง ซึ่ง frontend นี้แก้ให้แล้ว                                                                             |
| ควรปรับก่อนใช้จริง      | `owner`, `onlyOwner()`                       | ไม่มีการโอนหรือกู้คืนเจ้าของ ถ้า key สูญหายจะสร้างหลักสูตร จัดการผู้ออก และเพิกถอนไม่ได้                               | รุ่นใหม่ใช้ multisig เป็น owner และพิจารณา Ownable2Step หรือ role admin ที่หมุนเวียนได้                                                             |
| ควรปรับ                 | `createCourse()`                             | ตรวจเฉพาะรหัสไม่ว่าง แต่ยอมรับชื่อ/รายละเอียดว่าง และรหัสเป็นช่องว่างอย่างเดียว                                        | เพิ่ม validation ของชื่อและนโยบายรหัสบน Contract หน้าเว็บป้องกันการกรอกว่างแล้ว แต่ผู้ใช้ยังเรียกสัญญาโดยตรงได้                                     |
| ข้อกำหนดที่ต้องตกลง     | `issueCertificate()` และรหัสหลักสูตร         | `CERT001` กับ `cert001` เป็นคนละรหัส และช่องว่างก็เป็น bytes ที่มีความหมาย                                             | กำหนด canonical ID ก่อน deploy รุ่นใหม่ ห้าม frontend เดิมบังคับ uppercase กับข้อมูลที่มีอยู่แล้ว เว็บนี้รักษาตัวพิมพ์และรหัสตรงตาม Contract        |
| สำคัญต่อ UX             | `checkHash()` เทียบกับ `verifyCertificate()` | หลัง revoke แล้ว `checkHash(id, hash)` ยังคืน true หาก bytes ตรงกัน เพราะตรวจเฉพาะความเหมือนของเอกสาร                  | เป็น semantics ของฟังก์ชัน ไม่ใช่การยืนยันว่ามีผลใช้งาน ต้องอ่านสถานะ revocation ประกอบ หน้าเว็บตรวจทั้งสองและแสดงคำเตือนชัดเจน                     |
| ข้อจำกัดของการออกแบบ    | `certHash`                                   | สัญญารับ bytes32 ที่ไม่เป็นศูนย์ แต่ไม่บังคับ algorithm และไม่พิสูจน์ว่า Hash สร้างจาก PDF หรือผู้รับได้รับการอบรมจริง | กำหนด SHA-256 ของ bytes ทั้งไฟล์เป็นนโยบายที่ผู้ออกต้องใช้ เว็บนี้เข้ารหัสเป็น `0x` + hex 64 ตัวอักษร ต้องให้ความสำคัญกับกระบวนการอนุมัติผู้ออกด้วย |
| ควรเตรียมเมื่อขยายระบบ  | `getCertificatesOf()`                        | คืน array ทั้งหมดในครั้งเดียว จึงอาจชน gas/response limit ของ RPC เมื่อบัญชีมีรายการจำนวนมาก                           | รุ่นใหม่เพิ่ม pagination; เว็บนี้แบ่งอ่านรายละเอียดครั้งละ 9 ใบ แต่ getter รายการรหัสยังมีข้อจำกัดเดิม                                              |
| ควรเตรียมเมื่อขยายระบบ  | `courses` เป็น private mapping               | ไม่มี getter สำหรับรายการหลักสูตรทั้งหมด                                                                               | เว็บนี้ scan CourseCreated จาก deployment block แบบแบ่งช่วง และอ่าน getCourse ของแต่ละรหัส; เมื่อข้อมูลมากควรใช้ indexer หรือ getter แบบแบ่งหน้า    |
| เพื่อการตรวจสอบย้อนหลัง | `Certificate` / `CertificateRevoked`         | เก็บเหตุผล แต่ไม่มี revokedAt/revokedBy ใน struct/event โดยตรง จึงต้องดู block/transaction หากต้องการเวลา/ผู้ส่ง       | รุ่นใหม่เพิ่ม timestamp และ actor ให้ event; เว็บไม่แต่งวันเพิกถอนขึ้นเอง                                                                           |
| ความเป็นส่วนตัว         | รหัส รายละเอียดหลักสูตร เหตุผล และ Wallet    | `private` ไม่ทำให้ข้อมูลบน Public Blockchain เป็นความลับ และ Wallet อาจเชื่อมโยงบุคคลได้                               | หลีกเลี่ยงชื่อ อีเมล และข้อมูลส่วนบุคคลใน string ทุกช่อง เก็บ PDF และข้อมูลระบุตัวบุคคลนอก chain โดยออกแบบสิทธิ์เข้าถึงแยกต่างหาก                   |
| ประสิทธิภาพ             | string ใน storage / optimizer ปิด            | ไม่มีขนาด string สูงสุดใน Contract และ compiler ปิด optimizer จึงมีโอกาสเสีย Gas เกินจำเป็น                            | ทดสอบ Gas และกำหนดเพดานข้อมูลก่อน deploy รุ่นใหม่ ไม่เปลี่ยน ABI ของ deployment ปัจจุบันโดยพลการ                                                    |

สัญญาไม่มี external call ในฟังก์ชันเขียนที่ตรวจ จึงไม่พบเส้นทาง reentrancy แบบการโอน ETH จากโค้ดนี้ การตรวจครั้งนี้ไม่ใช่ formal audit และไม่ได้รับประกันว่าปลอดภัยสำหรับ production ทุกกรณี

## บั๊กที่จำลองได้ใน AgriTraceability จากลิงก์เดิม

`transferCustody()` ห้ามส่งต่อเมื่อสถานะเป็น Delivered แต่ `acceptCustody()` ไม่ตรวจ Delivered:

1. Farmer ลงทะเบียนล็อต
2. Farmer ขอส่งให้ Transporter ทำให้มี `pendingHolder`
3. Farmer เปลี่ยนสถานะเป็น Delivered ก่อนผู้รับกดยืนยัน
4. Transporter ยังเรียก acceptCustody สำเร็จและเปลี่ยนผู้ครอบครองหลัง Delivered ได้

ทดสอบบน Anvil และยืนยันผลแล้วใน `tests/contracts.test.ts` หาก Delivered ต้องเป็นสถานะสิ้นสุด ควรเพิ่ม guard ใน acceptCustody และตกลงนโยบายว่าจะล้างหรือยกเลิก pending transfer เมื่อ Delivered/Recall อย่างไร

ข้อสังเกตเพิ่มเติม: updateStatus ตรวจเพียงค่ามากกว่าเดิม จึงข้ามสถานะจาก Harvested ไป Delivered ได้ หากโจทย์ต้องบังคับทุกขั้นต้องตรวจ next status โดยตรง; traceHistory คืนประวัติทั้งหมดไม่มี pagination; บทบาทที่ลงทะเบียนแล้วแก้/ถอนออกไม่ได้ และไม่มี ownership rotation

## สิ่งที่ทดสอบจริง

- สิทธิ์ owner/issuer/ผู้ไม่มีสิทธิ์ การให้และถอน issuer และ zero address
- สร้างหลักสูตร ค้นหาหลักสูตร รหัสซ้ำ รหัสว่าง และพฤติกรรม metadata ว่าง
- ออกใบรับรองด้วยเวลา block, Hash, issuer และ recipient ที่ถูกต้อง
- ปฏิเสธรหัสว่าง/ซ้ำ หลักสูตรไม่พบ ผู้รับศูนย์ Hash ศูนย์ และการออกโดยไม่มีสิทธิ์
- คืนรายการตาม Wallet และตรวจ Hash ที่ตรง/ไม่ตรง/ไม่พบ
- เพิกถอนพร้อมเหตุผล คงหลักฐานเดิม ปฏิเสธเพิกถอนซ้ำและรหัส reuse
- ยืนยันว่า Hash ยังตรงหลังเพิกถอน ตัวพิมพ์เล็ก-ใหญ่เป็นคนละ ID และ Hash ซ้ำข้ามใบไม่ถูกห้าม
- ทำซ้ำบั๊ก pending custody หลัง Delivered ของสัญญาเกษตร

การแก้ source ใน repository ไม่แก้สัญญาที่ deploy ไปแล้ว หากปรับ Contract ต้อง deploy Address ใหม่ Verify บน Etherscan และเปลี่ยน Address, ABI และ deployment block ใน frontend ให้ตรงกัน
