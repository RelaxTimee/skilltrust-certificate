import { useEffect, useRef, useState } from 'react'
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider } from 'viem'

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

export function walletError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 4001) return 'คุณปฏิเสธการเชื่อมต่อ Wallet สามารถลองใหม่ได้'
    if (error.code === -32002) return 'มีคำขอค้างอยู่ กรุณาเปิด Wallet เพื่อดำเนินการ'
  }
  return 'เชื่อมต่อ Wallet ไม่สำเร็จ กรุณาตรวจสอบกระเป๋าแล้วลองใหม่'
}

export async function requestWallet(
  provider?: EIP1193Provider,
): Promise<{ account: Address; chainId: number }> {
  if (!provider)
    throw new Error('ไม่พบ Wallet กรุณาติดตั้ง MetaMask หรือเปิดผ่านเบราว์เซอร์ของกระเป๋า')
  try {
    const client = createWalletClient({ transport: custom(provider) })
    const accounts = await client.requestAddresses()
    if (!accounts[0]) throw new Error('EMPTY_ACCOUNTS')
    return { account: getAddress(accounts[0]), chainId: await client.getChainId() }
  } catch (error) {
    throw new Error(walletError(error))
  }
}

export function useWallet() {
  const [account, setAccount] = useState<Address>()
  const [chainId, setChainId] = useState<number>()
  const [provider, setProvider] = useState<EIP1193Provider>()
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const generation = useRef(0)

  useEffect(() => {
    setProvider(window.ethereum)
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{ provider?: EIP1193Provider }>).detail
      if (detail?.provider?.request) setProvider((current) => current ?? detail.provider)
    }
    window.addEventListener('eip6963:announceProvider', announce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', announce)
  }, [])

  useEffect(() => {
    if (!provider) return
    const accountsChanged = (accounts: string[]) => {
      generation.current++
      setError('')
      try {
        setAccount(accounts[0] ? getAddress(accounts[0]) : undefined)
      } catch {
        setAccount(undefined)
      }
    }
    const chainChanged = (chain: string) => {
      generation.current++
      setChainId(Number(chain))
    }
    const disconnected = () => {
      generation.current++
      setAccount(undefined)
      setChainId(undefined)
    }
    provider.on('accountsChanged', accountsChanged)
    provider.on('chainChanged', chainChanged)
    provider.on('disconnect', disconnected)
    return () => {
      generation.current++
      provider.removeListener('accountsChanged', accountsChanged)
      provider.removeListener('chainChanged', chainChanged)
      provider.removeListener('disconnect', disconnected)
    }
  }, [provider])

  async function connect() {
    const current = ++generation.current
    setError('')
    setConnecting(true)
    try {
      const result = await requestWallet(provider ?? window.ethereum)
      if (current === generation.current) {
        setAccount(result.account)
        setChainId(result.chainId)
      }
    } catch (failure) {
      if (current === generation.current)
        setError(failure instanceof Error ? failure.message : walletError(failure))
    } finally {
      setConnecting(false)
    }
  }
  function disconnect() {
    generation.current++
    setAccount(undefined)
    setChainId(undefined)
    setError('')
  }
  return { account, chainId, error, connecting, connect, disconnect }
}
