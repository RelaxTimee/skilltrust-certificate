import { createPublicClient, defineChain, http, isAddress, type Address } from 'viem'

export type BackendConfig = { address: Address; chainId: number; rpcUrl: string }

export function parseBackendConfig(env: Record<string, string | undefined>): BackendConfig | null {
  const address = env.VITE_CONTRACT_ADDRESS?.trim()
  if (!address) return null
  if (!isAddress(address)) throw new Error('VITE_CONTRACT_ADDRESS ไม่ถูกต้อง')
  const chainId = Number(env.VITE_CHAIN_ID)
  if (!Number.isSafeInteger(chainId) || chainId <= 0)
    throw new Error('VITE_CHAIN_ID ต้องเป็นจำนวนเต็มบวก')
  const rpc = new URL(env.VITE_RPC_URL ?? '')
  if (!['http:', 'https:'].includes(rpc.protocol) || rpc.username || rpc.password)
    throw new Error('RPC URL ต้องเป็น HTTP หรือ HTTPS และไม่มีรหัสผ่าน')
  return { address, chainId, rpcUrl: rpc.href }
}

// This factory is reserved for the adapter that will be implemented against the actual ABI.
// Configuring environment variables never changes the active demo service.
export function createBackendReader(config: BackendConfig) {
  return createPublicClient({
    chain: defineChain({
      id: config.chainId,
      name: `Chain ${config.chainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    }),
    transport: http(config.rpcUrl),
  })
}
