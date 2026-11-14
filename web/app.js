import QRCode from 'qrcode'
import { getAddress } from 'ethers'
import { CertificateClient } from './client'
import { config } from './config'
import {
  certificateDate,
  certificateUrl,
  errorMessage,
  pdfHash,
  recipientAddress,
  requiredId,
  shortAddress,
} from './domain'

/** @param {string} id */
function element(id) {
  const node = document.getElementById(id)
  if (!(node instanceof HTMLElement)) throw new Error(`Missing element: ${id}`)
  return node
}
/** @param {string} id */
function input(id) {
  const node = element(id)
  if (!(node instanceof HTMLInputElement)) throw new Error(`Missing input: ${id}`)
  return node
}
/** @param {string} id */
function form(id) {
  const node = element(id)
  if (!(node instanceof HTMLFormElement)) throw new Error(`Missing form: ${id}`)
  return node
}
/** @param {ParentNode} parent @param {string} selector */
function child(parent, selector) {
  const node = parent.querySelector(selector)
  if (!(node instanceof HTMLElement)) throw new Error(`Missing child: ${selector}`)
  return node
}
/** @param {string} id @param {string} value */
function text(id, value) {
  element(id).textContent = value
}
/** @param {string} id @param {string} message @param {'error'|'success'|''} [kind] */
function notice(id, message, kind = '') {
  const node = element(id)
  node.className = `notice ${kind}`
  node.textContent = message
  node.hidden = !message
}
/** @param {string} templateId */
function clone(templateId) {
  const template = element(templateId)
  if (!(template instanceof HTMLTemplateElement)) throw new Error('Missing template')
  return /** @type {DocumentFragment} */ (template.content.cloneNode(true))
}

/** @param {CertificateClient} [client] */
export function startApp(client = new CertificateClient()) {
  /** @type {'verify'|'mine'|'courses'|'issue'|'admin'} */
  let activeView = 'verify'
  let account = ''
  let chainId = 0
  let owner = false
  let issuer = false
  let connected = false
  let busy = false
  let walletRevision = 0
  let verifyRevision = 0
  let mineRevision = 0
  let courseRevision = 0
  let fileRevision = 0
  let minePage = 0
  let mineTotal = 0
  /** @type {Awaited<ReturnType<CertificateClient['findCertificate']>>} */
  let currentRecord = null
  /** @type {import('./client').InjectedProvider | undefined} */
  let subscribedProvider
  /** @type {Map<string,{name:string, provider:import('./client').InjectedProvider}>} */
  const wallets = new Map()
  const environment = /** @type {Window & {ethereum?:import('./client').InjectedProvider}} */ (
    window
  )
  const walletSelect = /** @type {HTMLSelectElement} */ (element('wallet-provider'))
  const confirmation = /** @type {HTMLDialogElement} */ (element('confirmation-dialog'))
  /** @type {(() => Promise<void>) | null} */
  let pendingConfirmation = null
  const labels = {
    verify: 'ตรวจสอบใบรับรอง',
    mine: 'ใบรับรองของฉัน',
    courses: 'หลักสูตรการอบรม',
    issue: 'ออกใบรับรอง',
    admin: 'จัดการสิทธิ์ผู้ออก',
  }

  for (const id of ['source-link', 'contract-link']) {
    const link = /** @type {HTMLAnchorElement} */ (element(id))
    link.href = `${config.explorer}/address/${config.address}#code`
  }
  text('contract-link', `${shortAddress(config.address)} ↗`)
  element('contract-link').title = config.address
  element('qr-local-note').hidden = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

  /** @param {unknown} failure */
  function showError(failure) {
    notice('page-error', errorMessage(failure), 'error')
  }
  function renderPermissions() {
    const correctChain = connected && chainId === config.chainId
    const editable = correctChain && !busy
    for (const id of ['course-form', 'issuer-form']) {
      const fieldset = form(id).querySelector('fieldset')
      if (fieldset) fieldset.disabled = !editable || !owner
    }
    const issueFields = form('issue-form').querySelector('fieldset')
    if (issueFields) issueFields.disabled = !editable || !issuer
    for (const node of document.querySelectorAll('.owner-hint')) {
      if (node instanceof HTMLElement) node.hidden = correctChain && owner
    }
    element('issue-hint').hidden = correctChain && issuer
    form('revoke-form').hidden =
      !correctChain || !owner || !currentRecord || currentRecord.certificate.revoked
    const revokeButton = form('revoke-form').querySelector('button')
    if (revokeButton) revokeButton.disabled = busy
    for (const id of ['connect-wallet', 'disconnect-wallet', 'switch-network']) {
      const button = /** @type {HTMLButtonElement} */ (element(id))
      button.disabled = busy
    }
    walletSelect.disabled = busy || connected
    element('wallet-status').hidden = !connected
    element('switch-network').hidden = !connected || correctChain
    text('connect-wallet', connected ? shortAddress(account) : 'เชื่อม Wallet')
    text('wallet-account', account)
    text(
      'wallet-role',
      !correctChain
        ? `เครือข่ายไม่ตรง: Chain ID ${chainId} · กรุณาเลือก Sepolia`
        : owner
          ? 'เจ้าของสัญญา · สร้างหลักสูตร ออก เพิกถอน และจัดการสิทธิ์ได้'
          : issuer
            ? 'ผู้ออกใบรับรอง · ออกใบรับรองได้'
            : 'ผู้ใช้งานทั่วไป · ดูใบรับรองของตนและตรวจสอบเอกสารได้',
    )
  }

  async function updateIdentity() {
    const revision = ++walletRevision
    owner = false
    issuer = false
    renderPermissions()
    try {
      const permissions = await client.permissions(connected ? account : undefined)
      if (revision !== walletRevision) return
      owner = permissions.isOwner
      issuer = permissions.isIssuer
      renderPermissions()
    } catch (error) {
      if (revision === walletRevision) showError(error)
    }
  }

  /** @param {keyof typeof labels} view */
  function navigate(view) {
    activeView = view
    for (const node of document.querySelectorAll('.view'))
      if (node instanceof HTMLElement) node.hidden = node.id !== `view-${view}`
    for (const button of document.querySelectorAll('nav button')) {
      if (!(button instanceof HTMLButtonElement)) continue
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
    text('breadcrumb', labels[view])
    notice('page-error', '')
    if (view === 'mine') void loadMine()
    if (view === 'courses' || view === 'issue') void loadCourses()
  }

  /** @param {{certificate:import('./client').CertificateRecord, course:import('./client').CourseRecord}} details */
  async function renderRecord(details) {
    const { certificate, course } = details
    currentRecord = details
    element('certificate-result').hidden = false
    element('verify-state').hidden = true
    element('certificate-status').className =
      `result-banner ${certificate.revoked ? 'revoked' : ''}`
    text(
      'certificate-status',
      certificate.revoked
        ? '✕ ใบรับรองนี้ถูกเพิกถอนแล้ว · ไม่มีผลใช้งาน'
        : '✓ พบใบรับรองที่มีผลใช้งานบน Sepolia',
    )
    text('certificate-course', course.name || '(หลักสูตรไม่มีชื่อ)')
    text('certificate-course-code', course.code)
    text('certificate-id', certificate.id)
    text('certificate-recipient', certificate.recipient)
    text('certificate-date', certificateDate(certificate.issuedAt))
    text('certificate-issuer', certificate.issuer)
    text('certificate-hash', certificate.hash)
    notice(
      'revocation-details',
      certificate.revoked ? `เหตุผลการเพิกถอน: ${certificate.revokeReason}` : '',
      'error',
    )
    const url = certificateUrl(certificate.id)
    input('share-url').value = url
    text('share-message', '')
    const canvas = document.createElement('canvas')
    element('qr-code').replaceChildren(canvas)
    renderPermissions()
    try {
      await QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'M', margin: 1, width: 180 })
    } catch {
      if (element('qr-code').contains(canvas))
        text('qr-code', 'ไม่สามารถสร้าง QR ได้ กรุณาใช้ลิงก์ด้านล่าง')
    }
  }

  /** @param {string} id @param {boolean} [push] */
  async function lookup(id, push = true) {
    const revision = ++verifyRevision
    fileRevision++
    currentRecord = null
    element('certificate-result').hidden = true
    element('verify-state').hidden = false
    text('verify-state', 'กำลังอ่านใบรับรองจาก Ethereum Sepolia…')
    notice('file-result', '')
    input('verify-file').value = ''
    input('verify-file').disabled = false
    renderPermissions()
    try {
      requiredId(id)
      if (push) history.pushState({}, '', certificateUrl(id))
      input('verify-id').value = id
      const details = await client.findCertificate(id)
      if (revision !== verifyRevision) return
      if (!details) {
        text('verify-state', `ไม่พบใบรับรองรหัส “${id}” บนสัญญานี้ กรุณาตรวจตัวพิมพ์เล็ก-ใหญ่`)
        return
      }
      await renderRecord(details)
    } catch (error) {
      if (revision === verifyRevision) {
        text('verify-state', 'ยังตรวจสอบไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วค้นหาอีกครั้ง')
        showError(error)
      }
    }
  }

  async function loadCourses() {
    const revision = ++courseRevision
    text('courses-state', 'กำลังอ่านหลักสูตรจากเหตุการณ์ CourseCreated…')
    try {
      const courses = await client.listCourses((from, to) => {
        if (revision === courseRevision)
          text(
            'courses-state',
            `กำลังอ่านประวัติ Block ${from.toLocaleString()} / ${to.toLocaleString()}`,
          )
      })
      if (revision !== courseRevision) return
      element('courses-list').replaceChildren()
      element('course-options').replaceChildren()
      for (const course of courses) {
        const fragment = clone('course-template')
        child(fragment, '.course-code').textContent = course.code
        child(fragment, '.course-name').textContent = course.name || '(ไม่มีชื่อหลักสูตร)'
        child(fragment, '.course-description').textContent =
          course.description || 'ไม่ได้ระบุรายละเอียด'
        element('courses-list').append(fragment)
        const option = document.createElement('option')
        option.value = course.code
        option.label = course.name
        element('course-options').append(option)
      }
      text(
        'courses-state',
        courses.length
          ? `${courses.length} หลักสูตร · อ่านจาก Blockchain`
          : 'ยังไม่มีหลักสูตรบนสัญญานี้',
      )
    } catch (error) {
      if (revision === courseRevision) {
        text('courses-state', 'อ่านรายการหลักสูตรไม่สำเร็จ กรุณากดโหลดใหม่')
        showError(error)
      }
    }
  }

  async function loadMine() {
    const revision = ++mineRevision
    const target = account
    element('mine-list').replaceChildren()
    element('mine-state').hidden = false
    element('mine-pagination').hidden = true
    if (!connected) {
      text('mine-state', 'กรุณาเชื่อม Wallet เพื่อดูใบรับรองของคุณ')
      return
    }
    text('mine-state', 'กำลังอ่านรายการใบรับรองของ Wallet…')
    try {
      const ids = await client.certificateIds(target)
      if (revision !== mineRevision || target !== account) return
      mineTotal = ids.length
      minePage = Math.min(minePage, Math.max(0, Math.ceil(mineTotal / 9) - 1))
      const items = await Promise.all(
        ids.slice(minePage * 9, minePage * 9 + 9).map((id) => client.findCertificate(id)),
      )
      if (revision !== mineRevision || target !== account) return
      if (items.some((item) => item === null))
        throw new Error('รายการจาก Contract อ้างอิงใบรับรองที่ไม่พบ กรุณาโหลดใหม่')
      for (const item of items) {
        if (!item) continue
        const fragment = clone('credential-template')
        const badge = child(fragment, '.status-badge')
        badge.classList.toggle('revoked', item.certificate.revoked)
        badge.textContent = item.certificate.revoked ? 'เพิกถอนแล้ว' : 'มีผลใช้งาน'
        child(fragment, '.course-code').textContent = item.course.code
        child(fragment, '.course-name').textContent = item.course.name || '(ไม่มีชื่อหลักสูตร)'
        child(fragment, '.cert-id').textContent = item.certificate.id
        child(fragment, '.issued-date').textContent = certificateDate(item.certificate.issuedAt)
        child(fragment, '.open-record').addEventListener('click', () => {
          navigate('verify')
          void lookup(item.certificate.id)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
        element('mine-list').append(fragment)
      }
      text('mine-state', ids.length ? '' : 'ยังไม่มีใบรับรองที่ผูกกับ Wallet นี้บนสัญญานี้')
      element('mine-state').hidden = ids.length > 0
      element('mine-pagination').hidden = ids.length <= 9
      text(
        'mine-page',
        `หน้า ${minePage + 1} / ${Math.ceil(ids.length / 9)} · ${ids.length} ใบรับรอง`,
      )
      const previousButton = /** @type {HTMLButtonElement} */ (element('mine-prev'))
      const nextButton = /** @type {HTMLButtonElement} */ (element('mine-next'))
      previousButton.disabled = minePage === 0
      nextButton.disabled = (minePage + 1) * 9 >= ids.length
    } catch (error) {
      if (revision === mineRevision) {
        text('mine-state', 'โหลดรายการไม่สำเร็จ กรุณาลองใหม่')
        showError(error)
      }
    }
  }

  /** @param {import('./client').TransactionProgress} progress */
  function transactionProgress(progress) {
    element('transaction-status').hidden = false
    const messages = {
      sign: 'กรุณาตรวจสอบและยืนยันรายการใน Wallet',
      pending: 'ส่งธุรกรรมแล้ว · กำลังรอการยืนยัน',
      confirmed: 'ธุรกรรมยืนยันสำเร็จบน Sepolia แล้ว',
    }
    text('transaction-message', messages[progress.phase])
    if (progress.hash) {
      const link = /** @type {HTMLAnchorElement} */ (element('transaction-link'))
      link.href = `${config.explorer}/tx/${progress.hash}`
      link.textContent = `${shortAddress(progress.hash)} · ดูบน Etherscan ↗`
      link.hidden = false
    }
  }

  /** @param {import('./client').WriteAction} action @param {unknown[]} args @param {()=>void} [onSuccess] */
  async function send(action, args, onSuccess) {
    if (busy) return
    busy = true
    notice('page-error', '')
    renderPermissions()
    element('transaction-link').hidden = true
    let confirmed = false
    try {
      await client.write(action, args, transactionProgress)
      confirmed = true
      onSuccess?.()
      await updateIdentity()
      if (activeView === 'courses' || activeView === 'issue') await loadCourses()
      if (activeView === 'mine') await loadMine()
      if (activeView === 'verify' && currentRecord)
        await lookup(currentRecord.certificate.id, false)
    } catch (error) {
      if (confirmed)
        showError(new Error(`ธุรกรรมยืนยันแล้ว แต่โหลดข้อมูลใหม่ไม่สำเร็จ: ${errorMessage(error)}`))
      else {
        text('transaction-message', `ยังไม่ยืนยันความสำเร็จ: ${errorMessage(error)}`)
        element('transaction-status').hidden = false
        showError(error)
      }
    } finally {
      busy = false
      renderPermissions()
    }
  }

  /** @param {string} message @param {()=>Promise<void>} action */
  function confirmAction(message, action) {
    if (busy || pendingConfirmation) return
    text('confirmation-detail', message)
    const selectedAccount = account
    const selectedChain = chainId
    pendingConfirmation = async () => {
      if (!connected || account !== selectedAccount || chainId !== selectedChain)
        throw new Error('Wallet หรือเครือข่ายเปลี่ยนแล้ว กรุณาตรวจสอบและยืนยันรายการใหม่')
      await action()
    }
    confirmation.showModal()
  }
  function closeConfirmation() {
    pendingConfirmation = null
    confirmation.close()
  }
  element('cancel-confirmation').addEventListener('click', closeConfirmation)
  element('close-confirmation').addEventListener('click', closeConfirmation)
  confirmation.addEventListener('cancel', () => {
    pendingConfirmation = null
  })
  element('submit-confirmation').addEventListener('click', () => {
    const action = pendingConfirmation
    closeConfirmation()
    if (action) void action().catch(showError)
  })

  for (const button of document.querySelectorAll('nav button')) {
    if (!(button instanceof HTMLButtonElement)) continue
    button.addEventListener('click', () => {
      const view = button.dataset.view
      if (view && view in labels) navigate(/** @type {keyof typeof labels} */ (view))
    })
  }
  form('verify-form').addEventListener('submit', (event) => {
    event.preventDefault()
    notice('page-error', '')
    void lookup(input('verify-id').value)
  })
  element('refresh-courses').addEventListener('click', () => void loadCourses())
  element('refresh-mine').addEventListener('click', () => void loadMine())
  element('mine-prev').addEventListener('click', () => {
    if (minePage > 0) {
      minePage--
      void loadMine()
    }
  })
  element('mine-next').addEventListener('click', () => {
    if ((minePage + 1) * 9 < mineTotal) {
      minePage++
      void loadMine()
    }
  })

  form('course-form').addEventListener('submit', (event) => {
    event.preventDefault()
    try {
      const values = new FormData(form('course-form'))
      const code = requiredId(String(values.get('code') ?? ''))
      const name = String(values.get('name') ?? '').trim()
      const description = String(values.get('description') ?? '').trim()
      if (!name || !description) throw new Error('กรุณากรอกชื่อและรายละเอียดหลักสูตร')
      confirmAction(`สร้างหลักสูตร: ${code}\nชื่อ: ${name}\nสัญญา: ${config.address}`, () =>
        send('createCourse', [code, name, description], () => form('course-form').reset()),
      )
    } catch (error) {
      showError(error)
    }
  })

  form('issuer-form').addEventListener('submit', (event) => {
    event.preventDefault()
    try {
      const values = new FormData(form('issuer-form'))
      const target = recipientAddress(String(values.get('address') ?? ''))
      const allowed = values.get('allowed') === 'true'
      confirmAction(`${allowed ? 'อนุญาต' : 'ยกเลิกสิทธิ์'}ออกใบรับรอง\nWallet: ${target}`, () =>
        send('setIssuer', [target, allowed], () => form('issuer-form').reset()),
      )
    } catch (error) {
      showError(error)
    }
  })

  input('issue-file').addEventListener('change', () => {
    const file = input('issue-file').files?.[0]
    notice(
      'issue-file-result',
      file ? `เลือกไฟล์: ${file.name} · จะคำนวณ Hash ก่อนขอยืนยันรายการ` : '',
    )
  })
  form('issue-form').addEventListener('submit', (event) => {
    event.preventDefault()
    if (busy) return
    const selectedAccount = account
    const revision = walletRevision
    const values = new FormData(form('issue-form'))
    const file = input('issue-file').files?.[0]
    if (!file) {
      showError(new Error('กรุณาเลือก PDF ใบรับรอง'))
      return
    }
    busy = true
    renderPermissions()
    notice('issue-file-result', 'กำลังคำนวณ SHA-256 ในอุปกรณ์…')
    void (async () => {
      try {
        const id = requiredId(String(values.get('id') ?? ''))
        const code = requiredId(String(values.get('course') ?? ''))
        const recipient = recipientAddress(String(values.get('recipient') ?? ''))
        const hash = await pdfHash(file)
        if (revision !== walletRevision || selectedAccount !== account || !connected)
          throw new Error('บัญชีเปลี่ยนระหว่างเตรียมเอกสาร กรุณาทำรายการใหม่')
        notice('issue-file-result', `SHA-256: ${hash}`, 'success')
        busy = false
        renderPermissions()
        confirmAction(
          `ออกใบรับรอง: ${id}\nหลักสูตร: ${code}\nผู้รับ: ${recipient}\nSHA-256: ${hash}`,
          () =>
            send('issueCertificate', [id, code, recipient, hash], () => {
              form('issue-form').reset()
              notice('issue-file-result', '')
              navigate('verify')
              input('verify-id').value = id
              void lookup(id)
            }),
        )
      } catch (error) {
        showError(error)
        notice('issue-file-result', errorMessage(error), 'error')
      } finally {
        busy = false
        renderPermissions()
      }
    })()
  })

  form('revoke-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const id = currentRecord?.certificate.id
    const values = new FormData(form('revoke-form'))
    const reason = String(values.get('reason') ?? '').trim()
    if (!id || !reason) {
      showError(new Error('กรุณาระบุเหตุผลการเพิกถอน'))
      return
    }
    confirmAction(
      `เพิกถอนใบรับรอง: ${id}\nเหตุผล: ${reason}\nใบรับรองจะไม่มีผลใช้งาน โดยข้อมูลเดิมยังคงอยู่`,
      () => send('revokeCertificate', [id, reason], () => form('revoke-form').reset()),
    )
  })

  input('verify-file').addEventListener('change', () => {
    const file = input('verify-file').files?.[0]
    const record = currentRecord
    const revision = ++fileRevision
    if (!file || !record) return
    input('verify-file').disabled = true
    notice('file-result', 'กำลังคำนวณ Hash และตรวจสถานะล่าสุด…')
    void (async () => {
      try {
        const hash = await pdfHash(file)
        const [match, fresh] = await Promise.all([
          client.checkHash(record.certificate.id, hash),
          client.findCertificate(record.certificate.id),
        ])
        if (revision !== fileRevision) return
        if (!fresh) throw new Error('ไม่พบใบรับรองนี้ในการตรวจสอบล่าสุด')
        await renderRecord(fresh)
        if (revision !== fileRevision) return
        notice(
          'file-result',
          `${match ? 'Hash ตรงกัน · ไฟล์ตรงกับหลักฐานที่บันทึก' : 'Hash ไม่ตรงกัน · ไฟล์นี้ต่างจากหลักฐานที่บันทึก'}${fresh.certificate.revoked ? '\nใบรับรองถูกเพิกถอนแล้ว จึงไม่มีผลใช้งาน' : ''}`,
          match && !fresh.certificate.revoked ? 'success' : 'error',
        )
      } catch (error) {
        if (revision === fileRevision) notice('file-result', errorMessage(error), 'error')
      } finally {
        if (revision === fileRevision) {
          input('verify-file').disabled = false
          input('verify-file').value = ''
        }
      }
    })()
  })
  element('copy-link').addEventListener('click', () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(input('share-url').value)
        text('share-message', 'คัดลอกลิงก์แล้ว')
      } catch {
        input('share-url').focus()
        input('share-url').select()
        text('share-message', 'กรุณาคัดลอกจากช่องลิงก์ที่เลือกไว้')
      }
    })()
  })

  /** @param {unknown[]} args */
  function onAccounts(...args) {
    if (!connected) return
    const accounts = args[0]
    if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') {
      disconnect()
      return
    }
    try {
      account = getAddress(accounts[0])
      client.account = account
      minePage = 0
      void updateIdentity()
      if (activeView === 'mine') void loadMine()
    } catch {
      disconnect()
    }
  }
  /** @param {unknown[]} args */
  function onChain(...args) {
    if (!connected) return
    chainId = Number(args[0])
    void updateIdentity()
  }
  function disconnect() {
    walletRevision++
    connected = false
    account = ''
    owner = false
    issuer = false
    minePage = 0
    client.disconnect()
    renderPermissions()
    if (activeView === 'mine') void loadMine()
  }
  /** @param {import('./client').InjectedProvider} provider */
  function subscribe(provider) {
    if (subscribedProvider === provider) return
    subscribedProvider?.removeListener?.('accountsChanged', onAccounts)
    subscribedProvider?.removeListener?.('chainChanged', onChain)
    subscribedProvider?.removeListener?.('disconnect', disconnect)
    subscribedProvider = provider
    provider.on?.('accountsChanged', onAccounts)
    provider.on?.('chainChanged', onChain)
    provider.on?.('disconnect', disconnect)
  }
  element('connect-wallet').addEventListener('click', () => {
    if (busy || connected) return
    const provider = wallets.get(walletSelect.value)?.provider ?? environment.ethereum
    if (provider) subscribe(provider)
    busy = true
    renderPermissions()
    notice('page-error', '')
    void client
      .connect(provider)
      .then(async (result) => {
        connected = true
        account = result.account
        chainId = result.chainId
        await updateIdentity()
        if (activeView === 'mine') await loadMine()
      })
      .catch(showError)
      .finally(() => {
        busy = false
        renderPermissions()
      })
  })
  element('disconnect-wallet').addEventListener('click', disconnect)
  element('switch-network').addEventListener('click', () => {
    if (busy) return
    busy = true
    renderPermissions()
    void client
      .switchNetwork()
      .then(async () => {
        chainId = Number(await client.injected?.request({ method: 'eth_chainId' }))
        await updateIdentity()
      })
      .catch(showError)
      .finally(() => {
        busy = false
        renderPermissions()
      })
  })
  /** @param {Event} event */
  function announce(event) {
    const detail =
      /** @type {CustomEvent<{info?:{uuid?:string,name?:string},provider?:import('./client').InjectedProvider}>} */ (
        event
      ).detail
    if (!detail?.provider?.request || !detail.info?.uuid || wallets.has(detail.info.uuid)) return
    wallets.set(detail.info.uuid, { name: detail.info.name ?? 'Wallet', provider: detail.provider })
    const option = document.createElement('option')
    option.value = detail.info.uuid
    option.textContent = detail.info.name ?? 'Wallet'
    walletSelect.append(option)
    walletSelect.hidden = wallets.size < 2
  }
  window.addEventListener('eip6963:announceProvider', announce)
  window.dispatchEvent(new Event('eip6963:requestProvider'))
  const popstate = () => {
    navigate('verify')
    const id = new URLSearchParams(location.search).get('certificate')
    if (id) void lookup(id, false)
    else {
      verifyRevision++
      currentRecord = null
      input('verify-id').value = ''
      element('certificate-result').hidden = true
      element('verify-state').hidden = false
      text('verify-state', 'กรอกรหัสใบรับรองเพื่อเริ่มตรวจสอบ')
    }
  }
  window.addEventListener('popstate', popstate)
  renderPermissions()
  void client
    .checkDeployment()
    .then(() =>
      notice(
        'connection-status',
        `เชื่อมต่อสัญญา DigitalCertificate บน Sepolia แล้ว · ${shortAddress(config.address)}`,
        'success',
      ),
    )
    .catch((error) =>
      notice(
        'connection-status',
        `เชื่อมต่อ RPC ไม่สำเร็จ: ${errorMessage(error)} · สามารถลองค้นหาหรือโหลดรายการอีกครั้ง`,
        'error',
      ),
    )
  const initialId = new URLSearchParams(location.search).get('certificate')
  if (initialId) void lookup(initialId, false)

  return {
    destroy() {
      verifyRevision++
      mineRevision++
      courseRevision++
      walletRevision++
      fileRevision++
      window.removeEventListener('eip6963:announceProvider', announce)
      window.removeEventListener('popstate', popstate)
      subscribedProvider?.removeListener?.('accountsChanged', onAccounts)
      subscribedProvider?.removeListener?.('chainChanged', onChain)
      subscribedProvider?.removeListener?.('disconnect', disconnect)
      client.reader.destroy()
    },
  }
}
