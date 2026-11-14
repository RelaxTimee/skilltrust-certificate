import type { Address } from 'viem'
import type { Database, Role } from './domain'

export const demoAccounts: Record<Exclude<Role, 'visitor'>, Address> = {
  admin: '0x1111111111111111111111111111111111111111',
  issuer: '0x2222222222222222222222222222222222222222',
  recipient: '0x3333333333333333333333333333333333333333',
}

export const SAMPLE_HASH = '2e2cb17b53b131598576f3707b42a2f16637cf81ab0899d0f677a9075d1e7aa1'

export function seedDatabase(): Database {
  return {
    version: 1,
    courses: [
      {
        code: 'AI-101',
        name: 'AI & Machine Learning Essentials',
        description: 'วางรากฐานปัญญาประดิษฐ์และ Machine Learning พร้อมต่อยอดสู่การทำงานจริง',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
      {
        code: 'SEC-201',
        name: 'Cybersecurity Fundamentals',
        description: 'เข้าใจภัยคุกคาม การป้องกันระบบ และแนวทางรักษาความปลอดภัยไซเบอร์',
        createdAt: '2026-10-02T09:00:00.000Z',
      },
      {
        code: 'CLD-101',
        name: 'Cloud Computing Foundations',
        description: 'เรียนรู้โครงสร้างพื้นฐาน Cloud และการออกแบบระบบที่พร้อมขยายตัว',
        createdAt: '2026-10-03T09:00:00.000Z',
      },
      {
        code: 'DATA-201',
        name: 'Data Analytics for Business',
        description: 'เปลี่ยนข้อมูลเป็นข้อค้นพบ เพื่อสนับสนุนการตัดสินใจทางธุรกิจ',
        createdAt: '2026-10-04T09:00:00.000Z',
      },
    ],
    certificates: [
      {
        id: 'ST-2026-001',
        courseCode: 'AI-101',
        recipient: demoAccounts.recipient,
        issuedOn: '2026-11-01',
        documentHash: SAMPLE_HASH,
        issuer: demoAccounts.issuer,
        createdAt: '2026-11-01T09:00:00.000Z',
        revocation: null,
      },
      {
        id: 'ST-2026-002',
        courseCode: 'SEC-201',
        recipient: demoAccounts.recipient,
        issuedOn: '2026-11-02',
        documentHash: SAMPLE_HASH,
        issuer: demoAccounts.issuer,
        createdAt: '2026-11-02T09:00:00.000Z',
        revocation: null,
      },
      {
        id: 'ST-2026-003',
        courseCode: 'CLD-101',
        recipient: demoAccounts.recipient,
        issuedOn: '2026-11-03',
        documentHash: SAMPLE_HASH,
        issuer: demoAccounts.admin,
        createdAt: '2026-11-03T09:00:00.000Z',
        revocation: { at: '2026-11-05T09:00:00.000Z', by: demoAccounts.admin },
      },
    ],
  }
}
