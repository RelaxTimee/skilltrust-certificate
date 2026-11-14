import { readFileSync } from 'node:fs'
import solc from 'solc'

/** @typedef {{abi:import('ethers').InterfaceAbi, bytecode:string, runtime:string}} CompiledContract */
/** @returns {Record<string,CompiledContract>} */
export function compileContracts() {
  const sources = Object.fromEntries(
    ['DigitalCertificate.sol', 'reference/AgriTraceability.sol'].map((name) => [
      name,
      { content: readFileSync(new URL(`../contracts/${name}`, import.meta.url), 'utf8') },
    ]),
  )
  const result = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources,
        settings: {
          optimizer: { enabled: false, runs: 200 },
          evmVersion: 'cancun',
          outputSelection: {
            '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
          },
        },
      }),
    ),
  )
  const errors = (result.errors ?? []).filter((error) => error.severity === 'error')
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join('\n'))
  const artifacts = {}
  for (const contracts of Object.values(result.contracts)) {
    for (const [name, contract] of Object.entries(contracts)) {
      artifacts[name] = {
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        runtime: `0x${contract.evm.deployedBytecode.object}`,
      }
    }
  }
  return artifacts
}

/** @param {string} bytecode */
export function executableBytecode(bytecode) {
  const hex = bytecode.replace(/^0x/, '')
  if (hex.length < 4 || !/^[a-fA-F0-9]+$/.test(hex)) throw new Error('Invalid runtime bytecode')
  const metadataLength = Number.parseInt(hex.slice(-4), 16) * 2 + 4
  if (metadataLength > hex.length) throw new Error('Invalid Solidity CBOR metadata length')
  return hex.slice(0, -metadataLength).toLowerCase()
}
