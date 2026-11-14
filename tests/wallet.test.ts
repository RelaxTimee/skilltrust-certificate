import { describe, expect, it, vi } from 'vitest'
import type { EIP1193Provider } from 'viem'
import { requestWallet } from '../src/wallet'
import { parseBackendConfig } from '../src/connection'
import { demoAccounts } from '../src/seed'

describe('wallet connection', () => {
  it('reports a missing wallet', async () => {
    await expect(requestWallet()).rejects.toThrow('ไม่พบ Wallet')
  })
  it('reports rejected requests without a transaction or network switch', async () => {
    const request = vi.fn().mockRejectedValue({ code: 4001, message: 'User rejected' })
    await expect(requestWallet({ request } as unknown as EIP1193Provider)).rejects.toThrow('ปฏิเสธ')
    expect(request.mock.calls.every(([args]) => args.method === 'eth_requestAccounts')).toBe(true)
  })
  it('connects the real address and reports the actual chain without sending a transaction', async () => {
    const request = vi.fn(async ({ method }: { method: string }) =>
      method === 'eth_requestAccounts' ? [demoAccounts.recipient] : '0xaa36a7',
    )
    expect(await requestWallet({ request } as unknown as EIP1193Provider)).toEqual({
      account: demoAccounts.recipient,
      chainId: 11155111,
    })
    expect(request.mock.calls.map(([args]) => args.method)).toEqual([
      'eth_requestAccounts',
      'eth_chainId',
    ])
  })
  it('handles empty wallet accounts', async () => {
    await expect(
      requestWallet({ request: vi.fn().mockResolvedValue([]) } as unknown as EIP1193Provider),
    ).rejects.toThrow('ไม่สำเร็จ')
  })
})

describe('future connection configuration', () => {
  const valid = {
    VITE_CONTRACT_ADDRESS: demoAccounts.admin,
    VITE_CHAIN_ID: '11155111',
    VITE_RPC_URL: 'https://example.com/rpc',
  }
  it('stays unconfigured until an actual contract address is provided', () => {
    expect(parseBackendConfig({})).toBeNull()
    expect(parseBackendConfig(valid)).toEqual({
      address: demoAccounts.admin,
      chainId: 11155111,
      rpcUrl: 'https://example.com/rpc',
    })
  })
  it('rejects malformed address, chain and unsafe URL protocols', () => {
    for (const invalid of [
      { VITE_CONTRACT_ADDRESS: 'fake' },
      { VITE_CHAIN_ID: '-1' },
      { VITE_CHAIN_ID: '1.5' },
      { VITE_RPC_URL: 'javascript:alert(1)' },
      { VITE_RPC_URL: 'https://user:password@example.com' },
    ]) {
      expect(() => parseBackendConfig({ ...valid, ...invalid })).toThrow()
    }
  })
})
