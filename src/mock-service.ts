import type { Address } from 'viem'
import {
  certificateInputSchema,
  courseInputSchema,
  databaseSchema,
  idSchema,
  today,
  type CertificateInput,
  type CertificateService,
  type CourseInput,
  type Database,
  type Permissions,
} from './domain'
import { demoAccounts, seedDatabase } from './seed'

export const STORAGE_KEY = 'skilltrust.demo.v1'
export type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

export class MockCertificateService implements CertificateService {
  constructor(private readonly storage: StoragePort) {}

  private read(): Database {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch {
      throw new Error('ไม่สามารถอ่านข้อมูลสาธิตได้ กรุณาอนุญาต localStorage ในเบราว์เซอร์')
    }
    if (raw === null) return seedDatabase()
    try {
      return databaseSchema.parse(JSON.parse(raw) as unknown)
    } catch {
      throw new Error('ข้อมูลสาธิตเสียหายหรือเป็นเวอร์ชันที่ไม่รองรับ กรุณารีเซ็ตข้อมูลสาธิต')
    }
  }

  private save(database: Database): void {
    const validated = databaseSchema.parse(database)
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(validated))
    } catch {
      throw new Error('บันทึกข้อมูลไม่สำเร็จ พื้นที่จัดเก็บอาจเต็มหรือถูกปิดใช้งาน')
    }
  }

  async reset(): Promise<void> {
    this.save(seedDatabase())
  }
  async listCourses() {
    return this.read().courses
  }
  async listCertificates(recipient?: Address) {
    return this.read()
      .certificates.filter(
        (certificate) =>
          !recipient || certificate.recipient.toLowerCase() === recipient.toLowerCase(),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  async findCertificate(id: string) {
    const normalized = idSchema.parse(id)
    const database = this.read()
    const certificate = database.certificates.find((item) => item.id === normalized)
    if (!certificate) return null
    const course = database.courses.find((item) => item.code === certificate.courseCode)
    if (!course) throw new Error('ไม่พบหลักสูตรที่อ้างอิง')
    return { certificate, course }
  }
  async permissions(account?: Address): Promise<Permissions> {
    const normalized = account?.toLowerCase()
    const role =
      normalized === demoAccounts.admin
        ? 'admin'
        : normalized === demoAccounts.issuer
          ? 'issuer'
          : normalized === demoAccounts.recipient
            ? 'recipient'
            : 'visitor'
    return {
      role,
      canCreateCourse: role === 'admin',
      canIssue: role === 'admin' || role === 'issuer',
      canRevoke: role === 'admin',
    }
  }
  async createCourse(account: Address, input: CourseInput) {
    if (!(await this.permissions(account)).canCreateCourse)
      throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่สร้างหลักสูตรได้')
    const data = courseInputSchema.parse(input)
    const database = this.read()
    if (database.courses.some((course) => course.code === data.code))
      throw new Error('รหัสหลักสูตรนี้มีอยู่แล้ว')
    const course = { ...data, createdAt: new Date().toISOString() }
    database.courses.push(course)
    this.save(database)
    return course
  }
  async issueCertificate(account: Address, input: CertificateInput) {
    if (!(await this.permissions(account)).canIssue)
      throw new Error('บัญชีนี้ไม่มีสิทธิ์ออกใบรับรอง')
    const data = certificateInputSchema.parse(input)
    if (data.issuedOn > today()) throw new Error('วันที่ออกใบรับรองต้องไม่เป็นวันในอนาคต')
    const database = this.read()
    if (!database.courses.some((course) => course.code === data.courseCode))
      throw new Error('ไม่พบหลักสูตรที่เลือก')
    if (database.certificates.some((certificate) => certificate.id === data.id))
      throw new Error('รหัสใบรับรองนี้ถูกใช้แล้ว รวมถึงใบที่ถูกเพิกถอน')
    const certificate = {
      ...data,
      issuer: account,
      createdAt: new Date().toISOString(),
      revocation: null,
    }
    database.certificates.push(certificate)
    this.save(database)
    return certificate
  }
  async revokeCertificate(account: Address, id: string) {
    if (!(await this.permissions(account)).canRevoke)
      throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่เพิกถอนได้')
    const normalized = idSchema.parse(id)
    const database = this.read()
    const certificate = database.certificates.find((item) => item.id === normalized)
    if (!certificate) throw new Error('ไม่พบใบรับรองนี้')
    if (certificate.revocation) throw new Error('ใบรับรองนี้ถูกเพิกถอนไปแล้ว')
    certificate.revocation = { at: new Date().toISOString(), by: account }
    this.save(database)
    return certificate
  }
}
