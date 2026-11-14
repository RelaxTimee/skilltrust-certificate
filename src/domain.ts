import { getAddress, isAddress, type Address } from 'viem'
import { z } from 'zod'

export const idSchema = z
  .string()
  .trim()
  .min(1, 'กรุณากรอกรหัส')
  .max(64, 'รหัสยาวได้ไม่เกิน 64 ตัวอักษร')
  .regex(/^[A-Za-z0-9_-]+$/, 'รหัสใช้ได้เฉพาะ A-Z, 0-9, ขีดกลาง และขีดล่าง')
  .transform((value) => value.toUpperCase())
export const addressSchema = z
  .string()
  .trim()
  .refine((value) => isAddress(value), 'รูปแบบ Wallet Address ไม่ถูกต้อง')
  .transform((value) => getAddress(value))
export const hashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Hash ต้องเป็น SHA-256 ขนาด 64 ตัวอักษร')
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  }, 'วันที่ไม่ถูกต้อง')
export const courseInputSchema = z.object({
  code: idSchema,
  name: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกชื่อหลักสูตร')
    .max(120, 'ชื่อหลักสูตรยาวได้ไม่เกิน 120 ตัวอักษร'),
  description: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกรายละเอียด')
    .max(1000, 'รายละเอียดยาวได้ไม่เกิน 1,000 ตัวอักษร'),
})
export const certificateInputSchema = z.object({
  id: idSchema,
  courseCode: idSchema,
  recipient: addressSchema,
  issuedOn: dateSchema,
  documentHash: hashSchema,
})
export const courseSchema = courseInputSchema.extend({ createdAt: z.string().datetime() })
export const certificateSchema = certificateInputSchema.extend({
  issuer: addressSchema,
  createdAt: z.string().datetime(),
  revocation: z.object({ at: z.string().datetime(), by: addressSchema }).nullable(),
})
export const databaseSchema = z
  .object({
    version: z.literal(1),
    courses: z.array(courseSchema).max(500),
    certificates: z.array(certificateSchema).max(5000),
  })
  .superRefine((database, context) => {
    const codes = new Set(database.courses.map((course) => course.code))
    const ids = new Set(database.certificates.map((certificate) => certificate.id))
    if (
      codes.size !== database.courses.length ||
      ids.size !== database.certificates.length ||
      database.certificates.some((certificate) => !codes.has(certificate.courseCode))
    ) {
      context.addIssue({ code: 'custom', message: 'ข้อมูลอ้างอิงหรือรหัสซ้ำไม่ถูกต้อง' })
    }
  })

export type CourseInput = z.input<typeof courseInputSchema>
export type CertificateInput = z.input<typeof certificateInputSchema>
export type Course = z.infer<typeof courseSchema>
export type Certificate = z.infer<typeof certificateSchema>
export type Database = z.infer<typeof databaseSchema>
export type Role = 'admin' | 'issuer' | 'recipient' | 'visitor'
export type Permissions = {
  role: Role
  canCreateCourse: boolean
  canIssue: boolean
  canRevoke: boolean
}
export type CertificateDetails = { certificate: Certificate; course: Course }

export interface CertificateService {
  listCourses(): Promise<Course[]>
  listCertificates(recipient?: Address): Promise<Certificate[]>
  findCertificate(id: string): Promise<CertificateDetails | null>
  permissions(account?: Address): Promise<Permissions>
  createCourse(account: Address, input: CourseInput): Promise<Course>
  issueCertificate(account: Address, input: CertificateInput): Promise<Certificate>
  revokeCertificate(account: Address, id: string): Promise<Certificate>
}

export function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function readableError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
}

export function verificationUrl(id: string, base = window.location.href): string {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  url.searchParams.set('certificate', idSchema.parse(id))
  return url.href
}
