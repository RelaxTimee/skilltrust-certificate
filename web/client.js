import {
  BrowserProvider,
  Contract,
  EventLog,
  FallbackProvider,
  FetchRequest,
  JsonRpcProvider,
  ZeroAddress,
  getAddress,
} from 'ethers'
import abi from './abi.json'
import { config } from './config'
import { recipientAddress, requiredId } from './domain'

/** @typedef {{code: string, name: string, description: string}} CourseRecord */
/** @typedef {{id: string, courseCode: string, recipient: string, hash: string, issuedAt: bigint, issuer: string, revoked: boolean, revokeReason: string}} CertificateRecord */
/** @typedef {{phase: 'sign' | 'pending' | 'confirmed', hash?: string}} TransactionProgress */
/** @typedef {import('ethers').Eip1193Provider & {on?: (event: string, callback: (...args: unknown[]) => void) => void, removeListener?: (event: string, callback: (...args: unknown[]) => void) => void}} InjectedProvider */
/** @typedef {'createCourse'|'issueCertificate'|'revokeCertificate'|'setIssuer'} WriteAction */

export function createReader() {
  const providers = config.rpcUrls.map((url, index) => {
    const request = new FetchRequest(url)
    request.timeout = 12000
    return {
      provider: new JsonRpcProvider(request, config.chainId, {
        staticNetwork: true,
        batchMaxCount: 1,
      }),
      priority: index + 1,
      stallTimeout: 1500,
      weight: 1,
    }
  })
  return new FallbackProvider(providers, config.chainId, { quorum: 1 })
}

export class CertificateClient {
  /** @param {{reader?: import('ethers').AbstractProvider, address?: string, chainId?: number, deploymentBlock?: number}} [options] */
  constructor(options = {}) {
    this.reader = options.reader ?? createReader()
    this.address = getAddress(options.address ?? config.address)
    this.chainId = options.chainId ?? config.chainId
    this.deploymentBlock = options.deploymentBlock ?? config.deploymentBlock
    this.contract = new Contract(this.address, abi, this.reader)
    /** @type {InjectedProvider | undefined} */
    this.injected = undefined
    /** @type {BrowserProvider | undefined} */
    this.browser = undefined
    /** @type {string | undefined} */
    this.account = undefined
    this.minimumBlock = 0
  }

  async checkDeployment() {
    const [chain, code] = await Promise.all([
      this.reader.getNetwork(),
      this.reader.getCode(this.address),
    ])
    if (chain.chainId !== BigInt(this.chainId) || code === '0x')
      throw new Error('ไม่พบสัญญาบนเครือข่ายที่กำหนด')
    // A successful decode checks this deployment against the actual verified interface.
    return getAddress(String(await this.contract.getFunction('owner').staticCall()))
  }

  /** @param {string} [account] */
  async permissions(account) {
    const owner = getAddress(String(await this.contract.getFunction('owner').staticCall()))
    if (!account) return { owner, isOwner: false, isIssuer: false }
    const normalized = recipientAddress(account)
    const isOwner = owner === normalized
    const isIssuer =
      isOwner || Boolean(await this.contract.getFunction('issuers').staticCall(normalized))
    return { owner, isOwner, isIssuer }
  }

  /** @param {InjectedProvider | undefined} injected */
  async connect(injected) {
    if (!injected)
      throw new Error('ไม่พบ Wallet กรุณาติดตั้ง MetaMask หรือเปิดผ่านเบราว์เซอร์ของกระเป๋า')
    const accounts = /** @type {string[]} */ (
      await injected.request({ method: 'eth_requestAccounts' })
    )
    if (!accounts[0]) throw new Error('Wallet ไม่ได้อนุญาตให้เข้าถึงบัญชี')
    this.injected = injected
    this.account = getAddress(accounts[0])
    this.browser = new BrowserProvider(injected, this.chainId)
    const chainId = Number(await injected.request({ method: 'eth_chainId' }))
    return { account: this.account, chainId }
  }

  disconnect() {
    // Keep the provider alive so an already submitted transaction can still be tracked.
    this.browser = undefined
    this.account = undefined
  }

  async switchNetwork() {
    if (!this.injected) throw new Error('กรุณาเชื่อม Wallet ก่อน')
    try {
      await this.injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainHex }],
      })
    } catch (error) {
      if (/** @type {{code?:number}} */ (error).code !== 4902) throw error
      await this.injected.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: config.chainHex,
            chainName: 'Sepolia',
            nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [...config.rpcUrls],
            blockExplorerUrls: [config.explorer],
          },
        ],
      })
      await this.injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainHex }],
      })
    }
  }

  /** @param {string} code @param {number} [blockTag] @returns {Promise<CourseRecord>} */
  async getCourse(code, blockTag) {
    const course = await this.contract
      .getFunction('getCourse')
      .staticCall(requiredId(code), { blockTag: blockTag ?? 'latest' })
    return {
      code: String(course.courseCode),
      name: String(course.courseName),
      description: String(course.description),
    }
  }

  /** @param {string} id @returns {Promise<{certificate:CertificateRecord, course:CourseRecord}|null>} */
  async findCertificate(id) {
    requiredId(id)
    const blockTag = Math.max(await this.reader.getBlockNumber(), this.minimumBlock)
    const result = await this.contract.getFunction('verifyCertificate').staticCall(id, { blockTag })
    if (result.recipient === ZeroAddress) return null
    const raw = await this.contract.getFunction('getCertificate').staticCall(id, { blockTag })
    /** @type {CertificateRecord} */
    const certificate = {
      id: String(raw.certId),
      courseCode: String(raw.courseCode),
      recipient: String(raw.recipient),
      hash: String(raw.certHash),
      issuedAt: BigInt(raw.issuedAt),
      issuer: String(raw.issuer),
      revoked: Boolean(raw.revoked),
      revokeReason: String(raw.revokeReason),
    }
    return { certificate, course: await this.getCourse(certificate.courseCode, blockTag) }
  }

  /** @param {string} id @param {string} hash */
  async checkHash(id, hash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Hash ต้องเป็น bytes32')
    return Boolean(await this.contract.getFunction('checkHash').staticCall(requiredId(id), hash))
  }

  /** @param {string} account @returns {Promise<string[]>} */
  async certificateIds(account) {
    const ids = await this.contract
      .getFunction('getCertificatesOf')
      .staticCall(recipientAddress(account))
    return Array.from(ids, String)
  }

  /** @param {(from: number, to: number) => void} [onProgress] @returns {Promise<CourseRecord[]>} */
  async listCourses(onProgress) {
    const latest = Math.max(await this.reader.getBlockNumber(), this.minimumBlock)
    const codes = new Set(/** @type {string[]} */ ([]))
    let from = this.deploymentBlock
    let range = 5000
    while (from <= latest) {
      const to = Math.min(from + range - 1, latest)
      try {
        const events = await this.contract.queryFilter('CourseCreated', from, to)
        for (const event of events)
          if (event instanceof EventLog) codes.add(String(event.args.courseCode))
        from = to + 1
        onProgress?.(to, latest)
      } catch (error) {
        const message = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})).toLowerCase()
        if (
          range <= 1 ||
          !/range|limit|too many|response size|exceed|block span|query returned/.test(message)
        )
          throw error
        range = Math.max(1, Math.floor(range / 2))
      }
    }
    /** @type {CourseRecord[]} */
    const courses = []
    const ids = [...codes]
    for (let offset = 0; offset < ids.length; offset += 10) {
      courses.push(
        ...(await Promise.all(
          ids.slice(offset, offset + 10).map((code) => this.getCourse(code, latest)),
        )),
      )
    }
    return courses
  }

  /** @param {WriteAction} action @param {unknown[]} args @param {(progress: TransactionProgress) => void} onProgress */
  async write(action, args, onProgress) {
    const browser = this.browser
    const injected = this.injected
    const account = this.account
    if (!browser || !injected || !account) throw new Error('กรุณาเชื่อม Wallet ก่อนทำรายการ')
    if (Number(await injected.request({ method: 'eth_chainId' })) !== this.chainId)
      throw new Error('กรุณาเปลี่ยน Wallet เป็นเครือข่าย Sepolia')
    const allowed = await this.permissions(account)
    if (action === 'issueCertificate' ? !allowed.isIssuer : !allowed.isOwner)
      throw new Error(
        action === 'issueCertificate'
          ? 'บัญชีนี้ไม่มีสิทธิ์ออกใบรับรอง'
          : 'เฉพาะเจ้าของสัญญาเท่านั้นที่ทำรายการนี้ได้',
      )
    const signer = await browser.getSigner(account)
    const contract = new Contract(this.address, abi, signer)
    const method = contract.getFunction(action)
    await method.staticCall(...args)
    const currentAccounts = /** @type {string[]} */ (
      await injected.request({ method: 'eth_accounts' })
    )
    if (
      !currentAccounts[0] ||
      getAddress(currentAccounts[0]) !== account ||
      this.account !== account
    )
      throw new Error('บัญชี Wallet เปลี่ยนแล้ว กรุณาตรวจสอบและทำรายการใหม่')
    if (Number(await injected.request({ method: 'eth_chainId' })) !== this.chainId)
      throw new Error('เครือข่าย Wallet เปลี่ยนแล้ว กรุณาเลือก Sepolia')
    onProgress({ phase: 'sign' })
    const transaction = await method.send(...args)
    onProgress({ phase: 'pending', hash: transaction.hash })
    const receipt = await waitForConfirmation(transaction, (hash) =>
      onProgress({ phase: 'pending', hash }),
    )
    this.minimumBlock = Math.max(this.minimumBlock, receipt.blockNumber)
    onProgress({ phase: 'confirmed', hash: receipt.hash })
    return receipt
  }
}

/** @param {import('ethers').TransactionResponse} transaction @param {(hash:string)=>void} onReplacement */
export async function waitForConfirmation(transaction, onReplacement) {
  /** @type {import('ethers').TransactionReceipt | null} */
  let receipt
  try {
    receipt = await transaction.wait(1, 120000)
  } catch (error) {
    const replacement =
      /** @type {{code?:string, reason?:string, cancelled?:boolean, receipt?:import('ethers').TransactionReceipt}} */ (
        error
      )
    if (replacement.code !== 'TRANSACTION_REPLACED') throw error
    if (replacement.receipt) onReplacement(replacement.receipt.hash)
    if (replacement.reason !== 'repriced' || replacement.cancelled || !replacement.receipt)
      throw new Error('ธุรกรรมถูกยกเลิกหรือแทนที่ด้วยรายการอื่น กรุณาตรวจสอบลิงก์ล่าสุด')
    receipt = replacement.receipt
  }
  if (!receipt || receipt.status !== 1) throw new Error('ธุรกรรมไม่สำเร็จ กรุณาตรวจสอบบน Etherscan')
  return receipt
}
