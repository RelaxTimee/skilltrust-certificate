// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { startApp } from '../web/app.js'
import { SAMPLE_HASH, demoAccounts } from '../src/seed'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }))
let app
let client
let details
const sampleCourse = {
  code: 'AI-101',
  name: 'AI & Machine Learning Essentials',
  description: 'Training',
}

beforeEach(async () => {
  const html = await readFile('web/index.html', 'utf8')
  document.body.innerHTML = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  history.replaceState({}, '', '/')
  vi.stubGlobal('crypto', webcrypto)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  details = {
    certificate: {
      id: 'Cert-001',
      courseCode: 'AI-101',
      recipient: demoAccounts.recipient,
      hash: `0x${SAMPLE_HASH}`,
      issuedAt: 1794000000n,
      issuer: demoAccounts.admin,
      revoked: false,
      revokeReason: '',
    },
    course: { ...sampleCourse },
  }
  client = {
    account: undefined,
    reader: { destroy: vi.fn() },
    checkDeployment: vi.fn().mockResolvedValue(demoAccounts.admin),
    permissions: vi.fn(async (account) => ({
      owner: demoAccounts.admin,
      isOwner: account === demoAccounts.admin,
      isIssuer: account === demoAccounts.admin,
    })),
    connect: vi.fn(async () => {
      client.account = demoAccounts.admin
      return { account: demoAccounts.admin, chainId: 11155111 }
    }),
    disconnect: vi.fn(),
    findCertificate: vi.fn(async (id) => (id === details.certificate.id ? details : null)),
    checkHash: vi.fn().mockResolvedValue(true),
    certificateIds: vi.fn().mockResolvedValue(['Cert-001']),
    listCourses: vi.fn().mockResolvedValue([sampleCourse]),
    write: vi.fn(async (_action, _args, progress) => {
      progress({ phase: 'pending', hash: '0x' + 'a'.repeat(64) })
      progress({ phase: 'confirmed', hash: '0x' + 'a'.repeat(64) })
      return { status: 1, blockNumber: 10 }
    }),
  }
})
afterEach(() => {
  app?.destroy()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function start() {
  app = startApp(client)
  await screen.findByText(/เชื่อมต่อสัญญา DigitalCertificate บน Sepolia แล้ว/)
}
async function search(id = 'Cert-001') {
  fireEvent.change(screen.getByLabelText('รหัสใบรับรอง'), { target: { value: id } })
  fireEvent.submit(document.getElementById('verify-form'))
  await waitFor(() => expect(client.findCertificate).toHaveBeenCalledWith(id))
}
async function file() {
  const bytes = await readFile('public/sample-certificate.pdf')
  const file = new File([bytes], 'test.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(bytes).buffer })
  return file
}

describe('live HTML frontend', () => {
  it('reads exact case-sensitive IDs, renders data safely and preserves the share URL', async () => {
    details.course.name = '<img src=x onerror=alert(1)>'
    await start()
    await search()
    await screen.findByRole('heading', { name: details.course.name })
    expect(document.querySelector('#certificate-course img')).toBeNull()
    expect(document.getElementById('share-url').value).toContain('certificate=Cert-001')
    await search('cert-001')
    await screen.findByText(/ไม่พบใบรับรองรหัส “cert-001”/)
  })

  it('reports RPC errors separately from not found', async () => {
    client.findCertificate.mockRejectedValue(new Error('RPC offline'))
    await start()
    await search()
    await screen.findByText('RPC offline')
    expect(document.getElementById('verify-state').textContent).toContain('ยังตรวจสอบไม่ได้')
  })

  it('shows that a matching hash does not restore a revoked certificate', async () => {
    details.certificate.revoked = true
    details.certificate.revokeReason = 'Issued in error'
    await start()
    await search()
    await screen.findByText(/เหตุผลการเพิกถอน: Issued in error/)
    fireEvent.change(document.getElementById('verify-file'), { target: { files: [await file()] } })
    await waitFor(() =>
      expect(document.getElementById('file-result').textContent).toContain('Hash ตรงกัน'),
    )
    expect(document.getElementById('file-result').textContent).toContain('ไม่มีผลใช้งาน')
    expect(client.checkHash).toHaveBeenCalledWith('Cert-001', `0x${SAMPLE_HASH}`)
  })

  it('requires an authorized wallet and explicit confirmation before submitting a course transaction', async () => {
    await start()
    fireEvent.click(screen.getByRole('button', { name: /03 หลักสูตรการอบรม/ }))
    expect(document.getElementById('course-code').disabled).toBe(false)
    expect(document.querySelector('#course-form fieldset').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'เชื่อม Wallet', exact: true }))
    await waitFor(() =>
      expect(document.querySelector('#course-form fieldset').disabled).toBe(false),
    )
    fireEvent.change(screen.getByLabelText('รหัสหลักสูตร'), { target: { value: 'WEB-301' } })
    fireEvent.change(screen.getByLabelText('ชื่อหลักสูตร'), {
      target: { value: 'Web Development' },
    })
    fireEvent.change(screen.getByLabelText('รายละเอียดการอบรม'), {
      target: { value: 'Training details' },
    })
    fireEvent.submit(document.getElementById('course-form'))
    expect(client.write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ดำเนินการใน Wallet ↗' }))
    await waitFor(() =>
      expect(client.write).toHaveBeenCalledWith(
        'createCourse',
        ['WEB-301', 'Web Development', 'Training details'],
        expect.any(Function),
      ),
    )
    await screen.findByText('ธุรกรรมยืนยันสำเร็จบน Sepolia แล้ว')
    expect(document.getElementById('transaction-link').href).toContain(
      'https://sepolia.etherscan.io/tx/',
    )
  })

  it('hashes the selected PDF and submits the exact issue arguments only after confirmation', async () => {
    client.write.mockImplementation(async (action, args, progress) => {
      if (action === 'issueCertificate')
        details.certificate = {
          ...details.certificate,
          id: args[0],
          courseCode: args[1],
          recipient: args[2],
          hash: args[3],
        }
      progress({ phase: 'confirmed', hash: '0x' + 'a'.repeat(64) })
      return { status: 1, blockNumber: 10 }
    })
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'เชื่อม Wallet', exact: true }))
    await waitFor(() => expect(document.querySelector('#issue-form fieldset').disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /04 ออกใบรับรอง/ }))
    fireEvent.change(document.getElementById('issue-id'), { target: { value: 'NEW001' } })
    fireEvent.change(document.getElementById('issue-course'), { target: { value: 'AI-101' } })
    fireEvent.change(document.getElementById('issue-recipient'), {
      target: { value: demoAccounts.recipient },
    })
    fireEvent.change(document.getElementById('issue-file'), { target: { files: [await file()] } })
    fireEvent.submit(document.getElementById('issue-form'))
    await screen.findByRole('button', { name: 'ดำเนินการใน Wallet ↗' })
    expect(client.write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ดำเนินการใน Wallet ↗' }))
    await waitFor(() =>
      expect(client.write).toHaveBeenCalledWith(
        'issueCertificate',
        ['NEW001', 'AI-101', demoAccounts.recipient, `0x${SAMPLE_HASH}`],
        expect.any(Function),
      ),
    )
    await screen.findByText('NEW001', { selector: '#certificate-id' })
  })

  it('submits revocation with its reason and reloads the revoked record', async () => {
    client.write.mockImplementation(async (action, args, progress) => {
      if (action === 'revokeCertificate')
        details.certificate = { ...details.certificate, revoked: true, revokeReason: args[1] }
      progress({ phase: 'confirmed', hash: '0x' + 'a'.repeat(64) })
      return { status: 1, blockNumber: 10 }
    })
    await start()
    await search()
    await screen.findByRole('heading', { name: sampleCourse.name })
    fireEvent.click(screen.getByRole('button', { name: 'เชื่อม Wallet', exact: true }))
    await waitFor(() => expect(document.getElementById('revoke-form').hidden).toBe(false))
    fireEvent.change(document.getElementById('revoke-reason'), {
      target: { value: 'Issued in error' },
    })
    fireEvent.submit(document.getElementById('revoke-form'))
    expect(client.write).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ดำเนินการใน Wallet ↗' }))
    await screen.findByText(/เหตุผลการเพิกถอน: Issued in error/)
    expect(client.write).toHaveBeenCalledWith(
      'revokeCertificate',
      ['Cert-001', 'Issued in error'],
      expect.any(Function),
    )
    expect(document.getElementById('revoke-form').hidden).toBe(true)
  })

  it('keeps write controls disabled on the wrong network and explains wallet rejection', async () => {
    client.connect.mockResolvedValueOnce({ account: demoAccounts.admin, chainId: 1 })
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'เชื่อม Wallet', exact: true }))
    await screen.findByText(/เครือข่ายไม่ตรง: Chain ID 1/)
    expect(document.querySelector('#course-form fieldset').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'ตัดการเชื่อมต่อ' }))
    client.connect.mockRejectedValueOnce({ code: 4001 })
    fireEvent.click(screen.getByRole('button', { name: 'เชื่อม Wallet', exact: true }))
    await screen.findByText('ยกเลิกคำขอใน Wallet แล้ว')
    expect(client.write).not.toHaveBeenCalled()
  })
})
