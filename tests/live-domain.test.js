import { readFile } from 'node:fs/promises'
import { File } from 'node:buffer'
import { describe, it, expect, vi } from 'vitest'
import {
  certificateUrl,
  requiredId,
  recipientAddress,
  pdfHash,
  errorMessage,
} from '../web/domain.js'
import { waitForConfirmation } from '../web/client.js'
import { SAMPLE_HASH } from '../src/seed'

describe('live frontend domain', () => {
  it('preserves case, Unicode and reserved URL characters in certificate IDs', () => {
    const id = 'ใบรับรอง A&B/01'
    expect(requiredId('cert001')).toBe('cert001')
    expect(
      new URL(certificateUrl(id, 'https://user.github.io/repo/?old=1#old')).searchParams.get(
        'certificate',
      ),
    ).toBe(id)
    expect(new URL(certificateUrl(id, 'https://user.github.io/repo/')).pathname).toBe('/repo/')
    expect(() => requiredId('   ')).toThrow()
    expect(() => recipientAddress('0x0000000000000000000000000000000000000000')).toThrow()
    expect(() => recipientAddress('invalid')).toThrow()
  })
  it('encodes SHA-256 of PDF bytes as bytes32 with a 0x prefix and detects changed bytes', async () => {
    const bytes = await readFile(new URL('../public/sample-certificate.pdf', import.meta.url))
    expect(await pdfHash(new File([bytes], 'sample.pdf'))).toBe(`0x${SAMPLE_HASH}`)
    expect(await pdfHash(new File([bytes, 'changed'], 'sample.pdf'))).not.toBe(`0x${SAMPLE_HASH}`)
    await expect(pdfHash(new File(['fake'], 'fake.pdf'))).rejects.toThrow()
  })
  it('explains user rejection and simulation reverts', () => {
    expect(errorMessage({ code: 'ACTION_REJECTED' })).toContain('ยกเลิก')
    expect(errorMessage({ reason: 'Only issuer' })).toContain('ไม่มีสิทธิ์')
    expect(errorMessage({ code: 'TIMEOUT' })).toContain('ก่อนส่งรายการซ้ำ')
  })
})

describe('transaction receipt handling', () => {
  const receipt = { status: 1, hash: '0xconfirmed', blockNumber: 10 }
  it('accepts a successful receipt and repricing but reports replacement hash', async () => {
    expect(await waitForConfirmation({ wait: async () => receipt }, vi.fn())).toBe(receipt)
    const updated = vi.fn()
    const transaction = {
      wait: vi.fn().mockRejectedValue({
        code: 'TRANSACTION_REPLACED',
        reason: 'repriced',
        cancelled: false,
        receipt,
      }),
    }
    expect(await waitForConfirmation(transaction, updated)).toBe(receipt)
    expect(updated).toHaveBeenCalledWith(receipt.hash)
  })
  it('rejects reverted, cancelled, unrelated replacement and timed-out transactions', async () => {
    await expect(
      waitForConfirmation({ wait: async () => ({ ...receipt, status: 0 }) }, vi.fn()),
    ).rejects.toThrow('ไม่สำเร็จ')
    for (const reason of ['cancelled', 'replaced']) {
      await expect(
        waitForConfirmation(
          {
            wait: vi.fn().mockRejectedValue({
              code: 'TRANSACTION_REPLACED',
              reason,
              cancelled: true,
              receipt,
            }),
          },
          vi.fn(),
        ),
      ).rejects.toThrow('แทนที่')
    }
    await expect(
      waitForConfirmation({ wait: vi.fn().mockRejectedValue(new Error('timeout')) }, vi.fn()),
    ).rejects.toThrow('timeout')
  })
})
