import { hashSchema } from './domain'

export const MAX_PDF_SIZE = 20 * 1024 * 1024

export async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('การคำนวณ Hash ต้องเปิดผ่าน HTTPS หรือ localhost')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashPdf(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('กรุณาเลือกไฟล์ PDF เท่านั้น')
  if (file.size === 0) throw new Error('ไฟล์ว่าง กรุณาเลือกไฟล์ใหม่')
  if (file.size > MAX_PDF_SIZE) throw new Error('ไฟล์ PDF ต้องมีขนาดไม่เกิน 20 MB')
  const bytes = await file.arrayBuffer()
  const header = new TextDecoder().decode(bytes.slice(0, 5))
  if (header !== '%PDF-') throw new Error('เนื้อหาไฟล์ไม่ใช่ PDF ที่รองรับ')
  return sha256(bytes)
}

export function hashesMatch(actual: string, expected: string): boolean {
  return hashSchema.parse(actual.toLowerCase()) === hashSchema.parse(expected.toLowerCase())
}
