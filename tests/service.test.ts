import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import { MockCertificateService, STORAGE_KEY, type StoragePort } from '../src/mock-service'
import { demoAccounts, SAMPLE_HASH } from '../src/seed'
import { today } from '../src/domain'

export function memoryStorage(): StoragePort {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

const course = {
  code: 'WEB-301',
  name: 'Web Development',
  description: 'Build modern web applications.',
}
const input = {
  id: 'ST-NEW-001',
  courseCode: course.code,
  recipient: demoAccounts.recipient,
  issuedOn: today(),
  documentHash: SAMPLE_HASH,
}

describe('certificate service', () => {
  it('completes creation, issuance, lookup, account filtering and revocation without losing evidence', async () => {
    const storage = memoryStorage()
    const service = new MockCertificateService(storage)
    await service.createCourse(demoAccounts.admin, course)
    const issued = await service.issueCertificate(demoAccounts.issuer, input)
    expect((await service.findCertificate('st-new-001'))?.course.name).toBe(course.name)
    expect(await service.listCertificates(demoAccounts.recipient)).toContainEqual(issued)
    expect(await service.listCertificates(demoAccounts.issuer)).toEqual([])
    const revoked = await service.revokeCertificate(demoAccounts.admin, issued.id)
    expect(revoked).toEqual({
      ...issued,
      revocation: { at: expect.any(String), by: demoAccounts.admin },
    })
    expect(
      (await new MockCertificateService(storage).findCertificate(issued.id))?.certificate,
    ).toEqual(revoked)
    expect(await service.listCertificates(demoAccounts.recipient)).toContainEqual(revoked)
    await expect(service.revokeCertificate(demoAccounts.admin, issued.id)).rejects.toThrow(
      'ถูกเพิกถอนไปแล้ว',
    )
  })

  it('enforces permissions in the service independently of UI', async () => {
    const service = new MockCertificateService(memoryStorage())
    const stranger: Address = '0x4444444444444444444444444444444444444444'
    for (const account of [demoAccounts.issuer, demoAccounts.recipient, stranger]) {
      await expect(service.createCourse(account, course)).rejects.toThrow('ผู้ดูแลระบบ')
      await expect(service.revokeCertificate(account, 'ST-2026-001')).rejects.toThrow('ผู้ดูแลระบบ')
    }
    for (const account of [demoAccounts.recipient, stranger]) {
      await expect(service.issueCertificate(account, input)).rejects.toThrow('ไม่มีสิทธิ์')
    }
    expect((await service.permissions()).role).toBe('visitor')
    expect((await service.permissions(stranger)).canIssue).toBe(false)
  })

  it('normalizes identifiers and rejects duplicate course and certificate codes including revoked ones', async () => {
    const service = new MockCertificateService(memoryStorage())
    await service.createCourse(demoAccounts.admin, { ...course, code: ' web-301 ' })
    await expect(service.createCourse(demoAccounts.admin, course)).rejects.toThrow('มีอยู่แล้ว')
    await service.issueCertificate(demoAccounts.issuer, { ...input, id: ' st-new-001 ' })
    await expect(service.issueCertificate(demoAccounts.issuer, input)).rejects.toThrow('ถูกใช้แล้ว')
    await service.revokeCertificate(demoAccounts.admin, input.id)
    await expect(service.issueCertificate(demoAccounts.issuer, input)).rejects.toThrow('ถูกใช้แล้ว')
  })

  it('does not lose duplicate protection when simultaneous calls arrive', async () => {
    const service = new MockCertificateService(memoryStorage())
    const attempts = await Promise.allSettled([
      service.createCourse(demoAccounts.admin, course),
      service.createCourse(demoAccounts.admin, course),
    ])
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await service.listCourses()).filter((item) => item.code === course.code)).toHaveLength(
      1,
    )
  })

  it('validates missing fields, malformed wallet, hash, real calendar dates, future dates and course references', async () => {
    const service = new MockCertificateService(memoryStorage())
    await expect(
      service.createCourse(demoAccounts.admin, { ...course, name: ' ' }),
    ).rejects.toThrow()
    await service.createCourse(demoAccounts.admin, course)
    for (const invalid of [
      { id: '' },
      { recipient: '0x123' },
      { documentHash: 'abc' },
      { issuedOn: '2026-02-30' },
      { issuedOn: '2999-01-01' },
      { courseCode: 'MISSING' },
    ]) {
      await expect(
        service.issueCertificate(demoAccounts.admin, { ...input, ...invalid }),
      ).rejects.toThrow()
    }
    expect(await service.findCertificate('MISSING')).toBeNull()
    await expect(service.revokeCertificate(demoAccounts.admin, 'MISSING')).rejects.toThrow('ไม่พบ')
  })

  it('filters recipient addresses without case sensitivity', async () => {
    const service = new MockCertificateService(memoryStorage())
    await service.createCourse(demoAccounts.admin, course)
    const recipient = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    await service.issueCertificate(demoAccounts.admin, { ...input, recipient })
    expect(
      await service.listCertificates(recipient.toUpperCase().replace('0X', '0x') as Address),
    ).toHaveLength(1)
  })

  it('preserves corrupt storage until explicitly reset, then restores the seed', async () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, '{broken')
    const service = new MockCertificateService(storage)
    await expect(service.listCourses()).rejects.toThrow('เสียหาย')
    expect(storage.getItem(STORAGE_KEY)).toBe('{broken')
    await service.reset()
    expect(await service.listCertificates()).toHaveLength(3)
  })

  it('reports inaccessible and full storage without reporting success', async () => {
    const service = new MockCertificateService({
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    })
    await expect(service.listCourses()).rejects.toThrow('localStorage')
    const full = new MockCertificateService({
      getItem: () => null,
      setItem() {
        throw new Error('quota')
      },
    })
    await expect(full.createCourse(demoAccounts.admin, course)).rejects.toThrow(
      'บันทึกข้อมูลไม่สำเร็จ',
    )
    expect(await full.listCourses()).toHaveLength(4)
  })
})
