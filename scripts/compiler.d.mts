import type { InterfaceAbi } from 'ethers'

export type CompiledContract = { abi: InterfaceAbi; bytecode: string; runtime: string }
export function compileContracts(): Record<string, CompiledContract>
export function executableBytecode(bytecode: string): string
