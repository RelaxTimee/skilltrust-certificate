// @vitest-environment jsdom
import { EventEmitter } from 'node:events'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EIP1193Provider } from 'viem'
import { useWallet } from '../src/wallet'
import { demoAccounts } from '../src/seed'

afterEach(() => {
  cleanup()
  delete window.ethereum
})

describe('wallet lifecycle', () => {
  it('responds to account, chain and disconnect events and removes subscriptions on unmount', async () => {
    const events = new EventEmitter()
    const request = vi.fn(async ({ method }: { method: string }) =>
      method === 'eth_requestAccounts' ? [demoAccounts.recipient] : '0xaa36a7',
    )
    window.ethereum = {
      request,
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
    } as unknown as EIP1193Provider
    const { result, unmount } = renderHook(() => useWallet())
    await act(() => result.current.connect())
    expect(result.current.account).toBe(demoAccounts.recipient)
    expect(result.current.chainId).toBe(11155111)
    act(() => {
      events.emit('accountsChanged', [demoAccounts.issuer])
    })
    expect(result.current.account).toBe(demoAccounts.issuer)
    act(() => {
      events.emit('chainChanged', '0x1')
    })
    expect(result.current.chainId).toBe(1)
    act(() => {
      events.emit('disconnect')
    })
    expect(result.current.account).toBeUndefined()
    expect(result.current.chainId).toBeUndefined()
    unmount()
    expect(events.eventNames()).toEqual([])
  })

  it('does not restore an account if a pending connection resolves after an app disconnect', async () => {
    let resolveAccounts: (accounts: string[]) => void = () => undefined
    const events = new EventEmitter()
    window.ethereum = {
      request: vi.fn(({ method }: { method: string }) =>
        method === 'eth_requestAccounts'
          ? new Promise<string[]>((resolve) => {
              resolveAccounts = resolve
            })
          : Promise.resolve('0xaa36a7'),
      ),
      on: events.on.bind(events),
      removeListener: events.removeListener.bind(events),
    } as unknown as EIP1193Provider
    const { result } = renderHook(() => useWallet())
    let connection: Promise<void> = Promise.resolve()
    act(() => {
      connection = result.current.connect()
    })
    await waitFor(() => expect(result.current.connecting).toBe(true))
    act(() => result.current.disconnect())
    await act(async () => {
      resolveAccounts([demoAccounts.recipient])
      await connection
    })
    expect(result.current.account).toBeUndefined()
  })
})
