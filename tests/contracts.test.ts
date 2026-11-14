import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  ZeroAddress,
  ZeroHash,
  sha256,
  toUtf8Bytes,
  type JsonRpcSigner,
} from 'ethers'
import { compileContracts, type CompiledContract } from '../scripts/compiler.mjs'
import { CertificateClient } from '../web/client.js'

let processHandle: ChildProcess | undefined
let provider: JsonRpcProvider
let artifacts: Record<string, CompiledContract>
let contract: Contract
let owner: JsonRpcSigner, issuer: JsonRpcSigner, recipient: JsonRpcSigner, outsider: JsonRpcSigner
let snapshot: string
const hash = sha256(toUtf8Bytes('%PDF-local-test'))

async function freePort() {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const bound = server.address()
  if (!bound || typeof bound === 'string') throw new Error('No TCP port')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return bound.port
}

beforeAll(async () => {
  artifacts = compileContracts()
  const platform = `${process.platform}-${process.arch === 'x64' ? 'amd64' : process.arch}`
  const require = createRequire(import.meta.url)
  const binary = join(
    dirname(require.resolve(`@foundry-rs/anvil-${platform}/package.json`)),
    'bin',
    process.platform === 'win32' ? 'anvil.exe' : 'anvil',
  )
  const port = await freePort()
  processHandle = spawn(binary, ['--host', '127.0.0.1', '--port', String(port), '--silent'], {
    windowsHide: true,
    stdio: 'ignore',
  })
  let launchError: Error | undefined
  processHandle.on('error', (error) => {
    launchError = error
  })
  provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 31337, {
    staticNetwork: true,
    cacheTimeout: -1,
    batchMaxCount: 1,
  })
  provider.pollingInterval = 30
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError
    try {
      await provider.send('eth_chainId', [])
      ready = true
      break
    } catch {
      await delay(100)
    }
  }
  if (!ready) throw new Error('Anvil did not start')
  ;[owner, issuer, recipient, outsider] = await Promise.all(
    [0, 1, 2, 3].map((index) => provider.getSigner(index)),
  )
  const deployment = await new ContractFactory(
    artifacts.DigitalCertificate.abi,
    artifacts.DigitalCertificate.bytecode,
    owner,
  ).deploy()
  await deployment.waitForDeployment()
  contract = new Contract(await deployment.getAddress(), artifacts.DigitalCertificate.abi, owner)
  snapshot = await provider.send('evm_snapshot', [])
}, 60000)

beforeEach(async () => {
  await provider.send('evm_revert', [snapshot])
  snapshot = await provider.send('evm_snapshot', [])
})
afterAll(() => {
  provider?.destroy()
  processHandle?.kill()
})

const as = (signer: JsonRpcSigner) =>
  new Contract(String(contract.target), artifacts.DigitalCertificate.abi, signer)
async function createCourse() {
  await (await contract.createCourse('AI-101', 'AI Fundamentals', 'Training course')).wait()
}
async function issue(id = 'CERT001') {
  await (await contract.issueCertificate(id, 'AI-101', recipient.address, hash)).wait()
}

describe('verified DigitalCertificate.sol on a local EVM', () => {
  it('compiles with Solidity 0.8.26 and produces the exact verified ABI', () => {
    const abi = JSON.parse(readFileSync(new URL('../web/abi.json', import.meta.url), 'utf8'))
    expect(artifacts.DigitalCertificate.abi).toEqual(abi)
  })
  it('sets owner and returns explicit missing-certificate values', async () => {
    expect(await contract.owner()).toBe(owner.address)
    expect([...(await contract.verifyCertificate('missing'))]).toEqual([
      false,
      ZeroAddress,
      '',
      0n,
      false,
    ])
    await expect(contract.getCertificate('missing')).rejects.toThrow('Certificate not found')
    await expect(contract.getCourse('missing')).rejects.toThrow('Course not found')
  })
  it('rejects unauthorized course creation, issuer management and revocation', async () => {
    const unauthorized = as(outsider)
    await expect(unauthorized.createCourse.staticCall('A', 'A', 'A')).rejects.toThrow('Only owner')
    await expect(unauthorized.setIssuer.staticCall(issuer.address, true)).rejects.toThrow(
      'Only owner',
    )
    await expect(unauthorized.revokeCertificate.staticCall('missing', 'invalid')).rejects.toThrow(
      'Only owner',
    )
  })
  it('creates courses, emits events, prevents exact duplicate and empty course codes', async () => {
    await createCourse()
    expect([...(await contract.getCourse('AI-101'))]).toEqual([
      'AI-101',
      'AI Fundamentals',
      'Training course',
    ])
    await expect(contract.createCourse.staticCall('AI-101', 'Other', 'Other')).rejects.toThrow(
      'Course already exists',
    )
    await expect(contract.createCourse.staticCall('', 'Other', 'Other')).rejects.toThrow(
      'Course code required',
    )
    expect(await contract.queryFilter(contract.filters.CourseCreated())).toHaveLength(1)
  })
  it('grants and revokes issuer permission while owner remains an issuer', async () => {
    await createCourse()
    await expect(
      as(issuer).issueCertificate.staticCall('CERT001', 'AI-101', recipient.address, hash),
    ).rejects.toThrow('Only issuer')
    await (await contract.setIssuer(issuer.address, true)).wait()
    await (await as(issuer).issueCertificate('CERT001', 'AI-101', recipient.address, hash)).wait()
    expect((await contract.getCertificate('CERT001')).issuer).toBe(issuer.address)
    await (await contract.setIssuer(issuer.address, false)).wait()
    await expect(
      as(issuer).issueCertificate.staticCall('CERT002', 'AI-101', recipient.address, hash),
    ).rejects.toThrow('Only issuer')
    await (await contract.setIssuer(owner.address, false)).wait()
    await issue('OWNER-CERT')
    await expect(contract.setIssuer.staticCall(ZeroAddress, true)).rejects.toThrow(
      'Invalid address',
    )
  })
  it('issues a certificate with block timestamp, validates hash and lists it only for its recipient', async () => {
    await createCourse()
    await issue()
    const record = await contract.getCertificate('CERT001')
    const block = await provider.getBlock('latest')
    expect(record.issuedAt).toBe(BigInt(block!.timestamp))
    expect(record.certHash).toBe(hash)
    expect([...(await contract.verifyCertificate('CERT001'))]).toEqual([
      true,
      recipient.address,
      'AI-101',
      record.issuedAt,
      false,
    ])
    expect(await contract.checkHash('CERT001', hash)).toBe(true)
    expect(await contract.checkHash('CERT001', sha256(toUtf8Bytes('changed')))).toBe(false)
    expect(await contract.checkHash('missing', hash)).toBe(false)
    expect([...(await contract.getCertificatesOf(recipient.address))]).toEqual(['CERT001'])
    expect([...(await contract.getCertificatesOf(outsider.address))]).toEqual([])
  })
  it('rejects empty ID, unknown course, zero recipient, zero hash and duplicate ID', async () => {
    await createCourse()
    await issue()
    for (const [id, code, target, document, reason] of [
      ['', 'AI-101', recipient.address, hash, 'Certificate ID required'],
      ['NEW', 'missing', recipient.address, hash, 'Course not found'],
      ['NEW', 'AI-101', ZeroAddress, hash, 'Invalid recipient'],
      ['NEW', 'AI-101', recipient.address, ZeroHash, 'Hash required'],
      ['CERT001', 'AI-101', recipient.address, hash, 'Certificate ID already exists'],
    ])
      await expect(
        contract.issueCertificate.staticCall(id, code, target, document),
      ).rejects.toThrow(reason)
  })
  it('revokes without deleting evidence, prevents re-revocation or reuse, and emits the reason', async () => {
    await createCourse()
    await issue()
    const before = [...(await contract.getCertificate('CERT001'))]
    await expect(contract.revokeCertificate.staticCall('CERT001', '')).rejects.toThrow(
      'Reason required',
    )
    await (await contract.revokeCertificate('CERT001', 'Issued in error')).wait()
    const after = [...(await contract.getCertificate('CERT001'))]
    expect(after.slice(0, 6)).toEqual(before.slice(0, 6))
    expect(after.slice(6)).toEqual([true, 'Issued in error'])
    expect((await contract.verifyCertificate('CERT001')).isValid).toBe(false)
    expect([...(await contract.getCertificatesOf(recipient.address))]).toEqual(['CERT001'])
    await expect(contract.revokeCertificate.staticCall('CERT001', 'Again')).rejects.toThrow(
      'Already revoked',
    )
    await expect(
      contract.issueCertificate.staticCall('CERT001', 'AI-101', recipient.address, hash),
    ).rejects.toThrow('Certificate ID already exists')
    const events = await contract.queryFilter(contract.filters.CertificateRevoked())
    expect(events).toHaveLength(1)
  })
  it('documents that matching hash remains true after revocation and must not mean valid certificate', async () => {
    await createCourse()
    await issue()
    await (await contract.revokeCertificate('CERT001', 'Revoked')).wait()
    expect(await contract.checkHash('CERT001', hash)).toBe(true)
    expect((await contract.verifyCertificate('CERT001')).isValid).toBe(false)
  })
  it('documents accepted blank metadata, whitespace-only identifiers and case-sensitive IDs', async () => {
    await (await contract.createCourse(' ', '', '')).wait()
    expect((await contract.getCourse(' ')).courseName).toBe('')
    await (await contract.issueCertificate(' ', ' ', recipient.address, hash)).wait()
    await createCourse()
    await issue('CERT001')
    await issue('cert001')
    expect([...(await contract.getCertificatesOf(recipient.address))]).toEqual([
      ' ',
      'CERT001',
      'cert001',
    ])
  })
  it('allows duplicate document hashes and reports this as policy rather than uniqueness enforcement', async () => {
    await createCourse()
    await issue('A')
    await issue('B')
    expect((await contract.getCertificate('A')).certHash).toBe(
      (await contract.getCertificate('B')).certHash,
    )
  })

  it('sends writes through the actual Ethers BrowserProvider against a disposable local chain', async () => {
    const client = new CertificateClient({
      reader: provider,
      address: String(contract.target),
      chainId: 31337,
      deploymentBlock: 0,
    })
    await client.connect({
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [owner.address]
        return provider.send(method, params ?? [])
      },
    })
    const progress: string[] = []
    const confirmed = (state: { phase: string }) => {
      progress.push(state.phase)
    }
    await client.write('createCourse', ['LIVE-101', 'Live Adapter', 'Local EVM'], confirmed)
    await client.write(
      'issueCertificate',
      ['LIVE-CERT', 'LIVE-101', recipient.address, hash],
      confirmed,
    )
    expect((await client.findCertificate('LIVE-CERT'))?.certificate.revoked).toBe(false)
    await client.write('revokeCertificate', ['LIVE-CERT', 'Integration test'], confirmed)
    expect((await client.findCertificate('LIVE-CERT'))?.certificate.revoked).toBe(true)
    expect(progress).toEqual([
      'sign',
      'pending',
      'confirmed',
      'sign',
      'pending',
      'confirmed',
      'sign',
      'pending',
      'confirmed',
    ])
    client.browser?.destroy()
  }, 20000)

  it('reads deployed data through the actual frontend Ethers.js adapter and rejects unauthorized writes', async () => {
    await createCourse()
    await issue()
    const client = new CertificateClient({
      reader: provider,
      address: String(contract.target),
      chainId: 31337,
      deploymentBlock: 0,
    })
    expect(await client.checkDeployment()).toBe(owner.address)
    expect((await client.permissions(outsider.address)).isIssuer).toBe(false)
    expect(await client.listCourses()).toEqual([
      { code: 'AI-101', name: 'AI Fundamentals', description: 'Training course' },
    ])
    expect((await client.findCertificate('CERT001'))?.certificate.hash).toBe(hash)
    expect(await client.findCertificate('missing')).toBeNull()
    expect(await client.checkHash('CERT001', hash)).toBe(true)
    expect(await client.certificateIds(recipient.address)).toEqual(['CERT001'])
    await expect(
      client.write('createCourse', ['BAD', 'Bad', 'Bad'], () => undefined),
    ).rejects.toThrow('เชื่อม Wallet')
    client.account = outsider.address
    client.injected = { request: async () => '0x7a69' }
    client.browser = {} as NonNullable<typeof client.browser>
    await expect(
      client.write('createCourse', ['BAD', 'Bad', 'Bad'], () => undefined),
    ).rejects.toThrow('เจ้าของสัญญา')
    client.injected = { request: async () => '0x1' }
    await expect(
      client.write('createCourse', ['BAD', 'Bad', 'Bad'], () => undefined),
    ).rejects.toThrow('เครือข่าย Sepolia')
  })
})

describe('provided link: AgriTraceability is a different assignment', () => {
  it('reproduces pending custody acceptance after Delivered, a missing terminal-state guard', async () => {
    const deployment = await new ContractFactory(
      artifacts.AgriTraceability.abi,
      artifacts.AgriTraceability.bytecode,
      owner,
    ).deploy()
    await deployment.waitForDeployment()
    const agri = new Contract(await deployment.getAddress(), artifacts.AgriTraceability.abi, owner)
    await (await agri.registerStakeholder(issuer.address, 1)).wait()
    await (await agri.registerStakeholder(recipient.address, 2)).wait()
    const farmer = new Contract(
      await deployment.getAddress(),
      artifacts.AgriTraceability.abi,
      issuer,
    )
    const receiver = new Contract(
      await deployment.getAddress(),
      artifacts.AgriTraceability.abi,
      recipient,
    )
    await (await farmer.registerBatch('LOT-QA', 'Corn', '2026-11-15', 'Test', 'Test')).wait()
    await (await farmer.transferCustody('LOT-QA', recipient.address)).wait()
    await (await farmer.updateStatus('LOT-QA', 3, 'Delivered while pending')).wait()
    await (await receiver.acceptCustody('LOT-QA')).wait()
    const batch = await agri.getBatch('LOT-QA')
    expect(batch.status).toBe(3n)
    expect(batch.currentHolder).toBe(recipient.address)
  })
})
