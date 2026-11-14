import { readFile } from 'node:fs/promises'
import { File } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { hashPdf, hashesMatch, MAX_PDF_SIZE, sha256 } from '../src/document'
import { SAMPLE_HASH } from '../src/seed'
import { verificationUrl } from '../src/domain'

describe('local document verification', () => {
  it('hashes the shipped sample correctly and detects byte-level document changes', async () => {
    const bytes = await readFile(new URL('../public/sample-certificate.pdf', import.meta.url))
    const original = new File([bytes], 'sample.pdf')
    const modified = new File([bytes, '\nchanged'], 'changed.pdf')
    expect(hashesMatch(await hashPdf(original as unknown as globalThis.File), SAMPLE_HASH)).toBe(
      true,
    )
    expect(hashesMatch(await hashPdf(modified as unknown as globalThis.File), SAMPLE_HASH)).toBe(
      false,
    )
    expect(hashesMatch(SAMPLE_HASH.toUpperCase(), SAMPLE_HASH)).toBe(true)
  })

  it('uses standard SHA-256', async () => {
    expect(await sha256(new TextEncoder().encode('abc').buffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('rejects non-PDF, disguised, empty and oversized files', async () => {
    for (const file of [
      new File(['test'], 'test.txt'),
      new File(['fake'], 'fake.pdf'),
      new File([], 'empty.pdf'),
      new File([new Uint8Array(MAX_PDF_SIZE + 1)], 'large.pdf'),
    ]) {
      await expect(hashPdf(file as unknown as globalThis.File)).rejects.toThrow()
    }
  })

  it('makes a direct verification link preserving the deployment path and removing stale query/hash', () => {
    expect(verificationUrl('st-2026-001', 'https://example.com/assignment10/?other=1#old')).toBe(
      'https://example.com/assignment10/?certificate=ST-2026-001',
    )
    expect(() => verificationUrl('<script>', 'https://example.com')).toThrow()
  })
})
