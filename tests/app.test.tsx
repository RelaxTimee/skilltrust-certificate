// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../src/App'
import { demoAccounts } from '../src/seed'
import { STORAGE_KEY } from '../src/mock-service'

beforeEach(() => {
  // Node 26's native localStorage can shadow jsdom storage in Vitest.
  const entries = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    removeItem: (key) => {
      entries.delete(key)
    },
    key: (index) => [...entries.keys()][index] ?? null,
  }
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  window.history.replaceState({}, '', '/')
  vi.stubGlobal('crypto', webcrypto)
  window.scrollTo = vi.fn()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function nav(name: string) {
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }))
}

async function pdf(name = 'sample.pdf', changed = false) {
  const bytes = await readFile('public/sample-certificate.pdf')
  const payload = changed ? Buffer.concat([bytes, Buffer.from('\nmodified')]) : bytes
  const file = new window.File([payload], name, { type: 'application/pdf' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(payload).buffer })
  return file
}

describe('full demo user journey', () => {
  it('creates a course, issues a certificate from a local PDF, verifies the file, lists it and revokes without deleting it', async () => {
    render(<App />)
    await screen.findByText('พบใบรับรองที่มีผลใช้งาน')
    fireEvent.change(screen.getByLabelText('บัญชีสาธิต:'), { target: { value: 'admin' } })
    nav('หลักสูตรการอบรม')
    await screen.findByRole('button', { name: 'สร้างหลักสูตรสาธิต' })
    fireEvent.change(screen.getByLabelText('รหัสหลักสูตร'), { target: { value: 'WEB-301' } })
    fireEvent.change(screen.getByLabelText('ชื่อหลักสูตร'), {
      target: { value: 'Modern Web Development' },
    })
    fireEvent.change(screen.getByLabelText('รายละเอียดการอบรม'), {
      target: { value: 'Build secure applications' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'สร้างหลักสูตรสาธิต' }))
    await screen.findByText('สร้างหลักสูตร WEB-301 แล้ว · บันทึกเฉพาะในโหมดสาธิต')
    nav('ออกใบรับรอง')
    fireEvent.change(screen.getByLabelText('รหัสใบรับรอง'), { target: { value: 'ST-NEW-001' } })
    fireEvent.change(screen.getByLabelText('หลักสูตร', { selector: 'select' }), {
      target: { value: 'WEB-301' },
    })
    fireEvent.change(screen.getByLabelText(/Wallet Address ของผู้รับ/), {
      target: { value: demoAccounts.recipient },
    })
    fireEvent.change(screen.getByLabelText('เลือก PDF สำหรับออกใบรับรอง'), {
      target: { files: [await pdf()] },
    })
    await screen.findByText('SHA-256 พร้อมใช้งาน')
    fireEvent.click(screen.getByRole('button', { name: 'ออกใบรับรองสาธิต' }))
    await screen.findByRole('heading', { name: 'Modern Web Development' })
    fireEvent.change(screen.getByLabelText('เลือก PDF เพื่อตรวจสอบ Hash'), {
      target: { files: [await pdf()] },
    })
    await screen.findByText('Hash ตรงกัน · ไฟล์ตรงกับเอกสารที่บันทึก')
    fireEvent.change(screen.getByLabelText('เลือก PDF เพื่อตรวจสอบ Hash'), {
      target: { files: [await pdf('changed.pdf', true)] },
    })
    await screen.findByText('Hash ไม่ตรงกัน · ไฟล์นี้ต่างจากเอกสารที่บันทึก')
    fireEvent.change(screen.getByLabelText('บัญชีสาธิต:'), { target: { value: 'recipient' } })
    nav('ใบรับรองของฉัน')
    await screen.findByRole('heading', { name: 'Modern Web Development' })
    expect(screen.getByText('ST-NEW-001')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('บัญชีสาธิต:'), { target: { value: 'admin' } })
    nav('ตรวจสอบใบรับรอง')
    await screen.findByRole('button', { name: 'เพิกถอนใบรับรองนี้' })
    fireEvent.click(screen.getByRole('button', { name: 'เพิกถอนใบรับรองนี้' }))
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันเพิกถอน' }))
    await screen.findByText('ใบรับรองนี้ถูกเพิกถอนแล้ว')
    expect(screen.getByRole('heading', { name: 'Modern Web Development' })).toBeTruthy()
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).certificates.find(
        (item: { id: string }) => item.id === 'ST-NEW-001',
      ).revocation,
    ).not.toBeNull()
    expect(window.location.search).toBe('?certificate=ST-NEW-001')
  })

  it('opens a QR/deep link directly and reports unknown codes', async () => {
    window.history.replaceState({}, '', '/?certificate=ST-2026-003')
    render(<App />)
    await screen.findByText('ใบรับรองนี้ถูกเพิกถอนแล้ว')
    expect(screen.getByLabelText('ลิงก์ตรวจสอบ').getAttribute('value')).toContain(
      'certificate=ST-2026-003',
    )
    fireEvent.change(screen.getByLabelText('รหัสใบรับรอง'), { target: { value: 'MISSING' } })
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'ตรวจสอบใบรับรอง' }),
    )
    await screen.findByText('ไม่พบใบรับรอง')
    expect(screen.queryByText('ใบรับรองนี้ถูกเพิกถอนแล้ว')).toBeNull()
  })

  it('keeps the searched record and URL in sync when leaving and returning to verification', async () => {
    render(<App />)
    await screen.findByText('พบใบรับรองที่มีผลใช้งาน')
    fireEvent.change(screen.getByLabelText('รหัสใบรับรอง'), {
      target: { value: 'st-2026-002' },
    })
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'ตรวจสอบใบรับรอง' }),
    )
    await screen.findByRole('heading', { name: 'Cybersecurity Fundamentals' })
    nav('หลักสูตรการอบรม')
    nav('ตรวจสอบใบรับรอง')
    await screen.findByRole('heading', { name: 'Cybersecurity Fundamentals' })
    expect(window.location.search).toBe('?certificate=ST-2026-002')
  })

  it('keeps a matching document distinguishable from a revoked credential', async () => {
    window.history.replaceState({}, '', '/?certificate=ST-2026-003')
    render(<App />)
    await screen.findByText('ใบรับรองนี้ถูกเพิกถอนแล้ว')
    fireEvent.change(screen.getByLabelText('เลือก PDF เพื่อตรวจสอบ Hash'), {
      target: { files: [await pdf()] },
    })
    await screen.findByText('แต่ใบรับรองนี้ถูกเพิกถอนแล้ว จึงไม่มีผลใช้งาน')
  })

  it('shows permission guidance and keeps a disconnected real wallet separate from the demo profile', async () => {
    render(<App />)
    await screen.findByText('พบใบรับรองที่มีผลใช้งาน')
    nav('ออกใบรับรอง')
    expect(screen.getByText('ต้องใช้บัญชีที่ได้รับสิทธิ์')).toBeTruthy()
    nav('ใบรับรองของฉัน')
    await screen.findByRole('heading', { name: 'AI & Machine Learning Essentials' })
    fireEvent.click(screen.getByRole('button', { name: 'Wallet จริง' }))
    await screen.findByText('เชื่อมต่อ Wallet ของคุณ')
    expect(screen.queryByRole('heading', { name: 'AI & Machine Learning Essentials' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'เชื่อม Wallet จริง' })[0]!)
    await screen.findByText(/ไม่พบ Wallet/)
  })

  it('offers explicit recovery for corrupted demo data and confirms reset', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken')
    render(<App />)
    await screen.findByText(/ข้อมูลสาธิตเสียหาย/)
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'รีเซ็ตข้อมูลสาธิต' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('{broken')
    fireEvent.click(
      within(screen.getByRole('main')).getByRole('button', { name: 'รีเซ็ตข้อมูลสาธิต' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'รีเซ็ตข้อมูล' }))
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe('{broken'))
    await screen.findByText('พบใบรับรองที่มีผลใช้งาน')
  })
})
