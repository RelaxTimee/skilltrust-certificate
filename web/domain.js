import { getAddress, isAddress, ZeroAddress } from 'ethers'

/** @param {string} value */
export function requiredId(value) {
  if (!value.trim()) throw new Error('กรุณากรอกรหัสอ้างอิง')
  if (new TextEncoder().encode(value).length > 256) throw new Error('รหัสยาวได้ไม่เกิน 256 bytes')
  // Contract identifiers are case-sensitive. Preserve the exact value, including Unicode.
  return value
}

/** @param {string} value */
export function recipientAddress(value) {
  const address = value.trim()
  if (!isAddress(address) || getAddress(address) === ZeroAddress) {
    throw new Error('กรุณากรอก Wallet Address ที่ถูกต้องและไม่ใช่ Zero Address')
  }
  return getAddress(address)
}

/** @param {File} file */
export async function pdfHash(file) {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.size === 0) {
    throw new Error('กรุณาเลือกไฟล์ PDF ที่ไม่ว่าง')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 20 MB')
  if (!globalThis.crypto?.subtle)
    throw new Error('ต้องเปิดผ่าน HTTPS หรือ localhost เพื่อคำนวณ Hash')
  const bytes = await file.arrayBuffer()
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
    throw new Error('เนื้อหาไฟล์ไม่ใช่ PDF ที่รองรับ')
  }
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return (
    '0x' + Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  )
}

/** @param {unknown} error */
export function errorMessage(error) {
  const value =
    /** @type {{code?: string | number, reason?: string, shortMessage?: string, message?: string, info?: {error?: {code?:number}}}} */ (
      error ?? {}
    )
  if (value.code === 'ACTION_REJECTED' || value.code === 4001 || value.info?.error?.code === 4001)
    return 'ยกเลิกคำขอใน Wallet แล้ว'
  if (value.code === -32002) return 'มีคำขอค้างอยู่ กรุณาเปิด Wallet'
  if (value.code === 'INSUFFICIENT_FUNDS') return 'Sepolia ETH ไม่พอสำหรับค่า Gas'
  if (value.code === 'TIMEOUT') return 'ยังยืนยันผลไม่ได้ กรุณาตรวจลิงก์ธุรกรรมก่อนส่งรายการซ้ำ'
  const reasons = /** @type {Record<string,string>} */ ({
    'Only owner': 'เฉพาะเจ้าของสัญญาเท่านั้นที่ทำรายการนี้ได้',
    'Only issuer': 'บัญชีนี้ไม่มีสิทธิ์ออกใบรับรอง',
    'Course already exists': 'รหัสหลักสูตรนี้มีอยู่แล้ว',
    'Certificate ID already exists': 'รหัสใบรับรองนี้ถูกใช้แล้ว',
    'Course not found': 'ไม่พบหลักสูตรนี้บน Blockchain',
    'Certificate not found': 'ไม่พบใบรับรองนี้บน Blockchain',
    'Already revoked': 'ใบรับรองนี้ถูกเพิกถอนไปแล้ว',
    'Invalid recipient': 'Wallet ผู้รับไม่ถูกต้อง',
    'Hash required': 'ต้องมี Hash ของเอกสาร',
    'Reason required': 'กรุณาระบุเหตุผลการเพิกถอน',
  })
  if (value.reason && reasons[value.reason]) return reasons[value.reason]
  return value.reason ?? value.shortMessage ?? value.message ?? 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'
}

/** @param {string} id @param {string} [base] */
export function certificateUrl(id, base = window.location.href) {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  url.searchParams.set('certificate', requiredId(id))
  return url.href
}

/** @param {string} address */
export function shortAddress(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** @param {bigint} timestamp */
export function certificateDate(timestamp) {
  const milliseconds = Number(timestamp) * 1000
  if (!Number.isSafeInteger(milliseconds) || milliseconds > 8.64e15)
    return 'วันที่อยู่นอกช่วงที่แสดงได้'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: 'Asia/Bangkok' }).format(
    new Date(milliseconds),
  )
}
