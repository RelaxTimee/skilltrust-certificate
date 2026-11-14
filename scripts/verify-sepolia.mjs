import { writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Contract, FetchRequest, JsonRpcProvider } from 'ethers'
import { compileContracts, executableBytecode } from './compiler.mjs'
import { config } from '../web/config.js'

// This command is strictly read-only. It never accesses a signer or sends transactions.
const request = new FetchRequest(config.rpcUrls[0])
request.timeout = 20000
const provider = new JsonRpcProvider(request, config.chainId, {
  staticNetwork: true,
  batchMaxCount: 1,
})
try {
  const abi = JSON.parse(await readFile(new URL('../web/abi.json', import.meta.url), 'utf8'))
  const contract = new Contract(config.address, abi, provider)
  const artifact = compileContracts().DigitalCertificate
  const [chain, block, code, owner, missing, creation] = await Promise.all([
    provider.send('eth_chainId', []),
    provider.getBlockNumber(),
    provider.getCode(config.address),
    contract.owner(),
    contract.verifyCertificate('__READ_ONLY_PROBE__'),
    provider.getTransactionReceipt(
      '0x2a491980d67161533d094971ed350574757b87decf611c6207224e1a15ad7352',
    ),
  ])
  if (
    Number(chain) !== config.chainId ||
    code === '0x' ||
    !creation ||
    creation.contractAddress?.toLowerCase() !== config.address.toLowerCase()
  )
    throw new Error('Deployment identity check failed')
  if (executableBytecode(code) !== executableBytecode(artifact.runtime))
    throw new Error('Compiled executable does not match the deployed contract')
  const events = await contract.queryFilter('CourseCreated', config.deploymentBlock, block)
  const courses = []
  for (const event of events) {
    if (!('args' in event)) continue
    const course = await contract.getCourse(event.args.courseCode)
    courses.push({ code: course.courseCode, name: course.courseName })
  }
  const record = {
    checkedAt: new Date().toISOString(),
    chainId: Number(chain),
    address: config.address,
    blockNumber: block,
    deploymentBlock: creation.blockNumber,
    owner,
    runtimeBytes: (code.length - 2) / 2,
    runtimeSha256: createHash('sha256')
      .update(Buffer.from(code.slice(2), 'hex'))
      .digest('hex'),
    executableMatchesCompiledSource: true,
    compiler: '0.8.26+commit.8a97fa7a',
    optimizer: false,
    evmVersion: 'cancun',
    missingCertificate: [...missing].map((value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
    courses,
    transactionsSent: 0,
  }
  await writeFile(
    new URL('../docs/sepolia-check.json', import.meta.url),
    JSON.stringify(record, null, 2) + '\n',
  )
  console.log(JSON.stringify(record, null, 2))
} catch (error) {
  console.error(error.shortMessage ?? error.message)
  process.exitCode = 1
} finally {
  provider.destroy()
}
