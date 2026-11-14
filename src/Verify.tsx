import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  Fingerprint,
  Link2,
  LockKeyhole,
  QrCode,
  Search,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Address } from 'viem'
import {
  formatDate,
  idSchema,
  readableError,
  shortAddress,
  verificationUrl,
  type CertificateDetails,
  type CertificateService,
} from './domain'
import { hashPdf, hashesMatch } from './document'
import { SAMPLE_HASH } from './seed'
import { ConfirmDialog, Empty, Loading, Notice, StatusBadge } from './components'

export function Verify({
  service,
  initialId,
  version,
  actor,
  canRevoke,
  onChanged,
  onSelect,
}: {
  service: CertificateService
  initialId: string
  version: number
  actor: Address
  canRevoke: boolean
  onChanged: () => void
  onSelect: (id: string) => void
}) {
  const [input, setInput] = useState(initialId)
  const [request, setRequest] = useState({ id: initialId, nonce: 0 })
  const [details, setDetails] = useState<CertificateDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  useEffect(() => {
    setInput(initialId)
    setRequest((current) =>
      current.id === initialId ? current : { id: initialId, nonce: current.nonce + 1 },
    )
  }, [initialId])
  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    setDetails(null)
    void service
      .findCertificate(request.id)
      .then((result) => {
        if (live) setDetails(result)
      })
      .catch((failure: unknown) => {
        if (live) setError(readableError(failure))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [request, service, version])

  function search(event: FormEvent) {
    event.preventDefault()
    try {
      selectCertificate(idSchema.parse(input))
    } catch {
      setRequest((current) => ({ id: input, nonce: current.nonce + 1 }))
    }
  }

  function selectCertificate(id: string) {
    setInput(id)
    window.history.pushState({}, '', verificationUrl(id))
    setRequest((current) => ({ id, nonce: current.nonce + 1 }))
    onSelect(id)
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span /> DIGITAL CREDENTIALS, REAL CONFIDENCE
          </div>
          <h1>
            ทุกความสำเร็จ<span>ตรวจสอบได้</span>
          </h1>
          <p>
            ตรวจสอบใบรับรองจาก SkillTrust Academy
            <br className="mobile-break" /> ได้อย่างมั่นใจในไม่กี่ขั้นตอน
          </p>
        </div>
        <div className="intro-mark" aria-hidden="true">
          <ShieldCheck size={70} strokeWidth={1} />
          <span>
            TRUST IS
            <br />
            VERIFIABLE.
          </span>
        </div>
      </div>
      <section className="search-panel" aria-labelledby="search-title">
        <div className="section-title">
          <span className="step">01</span>
          <div>
            <h2 id="search-title">ค้นหาใบรับรอง</h2>
            <p>กรอกรหัสอ้างอิง หรือเปิดลิงก์จาก QR Code บนใบรับรอง</p>
          </div>
          <span className="public-label">
            <LockKeyhole size={13} /> ไม่ต้องเชื่อม Wallet
          </span>
        </div>
        <form className="search-form" onSubmit={search}>
          <label className="sr-only" htmlFor="certificate-search">
            รหัสใบรับรอง
          </label>
          <div className="search-input">
            <Search size={20} aria-hidden="true" />
            <input
              id="certificate-search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="เช่น ST-2026-001"
              maxLength={64}
              required
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button className="button primary" disabled={loading} type="submit">
            {loading ? 'กำลังตรวจสอบ…' : 'ตรวจสอบใบรับรอง'}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="example-links">
          <span>ลองตรวจสอบ:</span>
          <button onClick={() => selectCertificate('ST-2026-001')}>
            ST-2026-001 <span>มีผลใช้งาน</span>
          </button>
          <button onClick={() => selectCertificate('ST-2026-003')}>
            ST-2026-003 <span>เพิกถอนแล้ว</span>
          </button>
        </div>
      </section>
      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <Loading>กำลังตรวจสอบใบรับรอง…</Loading>
        ) : error ? (
          <Notice kind="error">{error}</Notice>
        ) : !details ? (
          <section className="panel">
            <Empty title="ไม่พบใบรับรอง">
              ไม่พบรหัส {request.id} ในข้อมูลสาธิต กรุณาตรวจสอบรหัสอีกครั้ง
            </Empty>
          </section>
        ) : (
          <div className="verification-grid">
            <section className="certificate-panel" aria-labelledby="certificate-title">
              <div
                className={`result-banner ${details.certificate.revocation ? 'is-revoked' : ''}`}
              >
                {details.certificate.revocation ? <XCircle size={23} /> : <ShieldCheck size={23} />}
                <div>
                  <strong>
                    {details.certificate.revocation
                      ? 'ใบรับรองนี้ถูกเพิกถอนแล้ว'
                      : 'พบใบรับรองที่มีผลใช้งาน'}
                  </strong>
                  <span>ผลตรวจสอบจากข้อมูลสาธิตในเบราว์เซอร์นี้</span>
                </div>
                <StatusBadge certificate={details.certificate} />
              </div>
              <div className="certificate-document">
                <div className="document-top">
                  <div className="mini-brand">
                    <ShieldCheck size={22} />
                    <strong>
                      SkillTrust<span>ACADEMY</span>
                    </strong>
                  </div>
                  <span className="document-number">CERTIFICATE OF ACHIEVEMENT</span>
                </div>
                <div className="document-body">
                  <div className="document-icon">
                    <Award size={43} strokeWidth={1.3} />
                  </div>
                  <p className="eyebrow">ใบรับรองการสำเร็จหลักสูตร</p>
                  <h2 id="certificate-title">{details.course.name}</h2>
                  <p className="course-code">{details.course.code}</p>
                  <div className="recipient-label">ออกให้แก่บัญชี Wallet</div>
                  <p className="recipient-address mono">{details.certificate.recipient}</p>
                  <div className="certificate-meta">
                    <div>
                      <span>รหัสใบรับรอง</span>
                      <strong className="mono">{details.certificate.id}</strong>
                    </div>
                    <div>
                      <span>วันที่ออกใบรับรอง</span>
                      <strong>{formatDate(details.certificate.issuedOn)}</strong>
                    </div>
                  </div>
                </div>
                <div className="document-bottom">
                  <span>
                    <span className="green-dot" /> DEMONSTRATION RECORD
                  </span>
                  <Fingerprint size={25} strokeWidth={1.4} />
                  <span>SKILLTRUST ACADEMY</span>
                </div>
              </div>
              <div className="record-details">
                <div>
                  <span>ผู้ออกใบรับรอง</span>
                  <code title={details.certificate.issuer}>
                    {shortAddress(details.certificate.issuer)}
                  </code>
                </div>
                <div>
                  <span>บันทึกเมื่อ</span>
                  <span>{formatDate(details.certificate.createdAt)}</span>
                </div>
                {details.certificate.revocation && (
                  <>
                    <div>
                      <span>เพิกถอนเมื่อ</span>
                      <span>{formatDate(details.certificate.revocation.at)}</span>
                    </div>
                    <div>
                      <span>เพิกถอนโดย</span>
                      <code>{shortAddress(details.certificate.revocation.by)}</code>
                    </div>
                  </>
                )}
              </div>
              {canRevoke && !details.certificate.revocation && (
                <div className="revoke-action">
                  <span>สำหรับผู้ดูแลระบบสาธิต</span>
                  <button
                    className="text-button danger-text"
                    onClick={() => setConfirmRevoke(true)}
                  >
                    เพิกถอนใบรับรองนี้ <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </section>
            <aside className="verification-side">
              <DocumentCheck
                key={`${details.certificate.id}:${details.certificate.documentHash}:${Boolean(details.certificate.revocation)}`}
                details={details}
              />
              <ShareCertificate id={details.certificate.id} />
            </aside>
          </div>
        )}
      </div>
      <div className="trust-note">
        <LockKeyhole size={16} />
        <p>ความเป็นส่วนตัวมาก่อน · ไฟล์ PDF ถูกตรวจสอบบนอุปกรณ์ของคุณ ไม่มีการอัปโหลดเอกสาร</p>
        <span>SHA-256</span>
      </div>
      {confirmRevoke && details && (
        <ConfirmDialog
          title="เพิกถอนใบรับรอง?"
          confirmLabel="ยืนยันเพิกถอน"
          danger
          onClose={() => setConfirmRevoke(false)}
          onConfirm={async () => {
            await service.revokeCertificate(actor, details.certificate.id)
            onChanged()
          }}
        >
          <p>
            ใบรับรอง <strong>{details.certificate.id}</strong> จะไม่มีผลใช้งาน โดยข้อมูลการออกและ
            Hash เดิมจะยังคงอยู่ การกระทำนี้ย้อนกลับไม่ได้ในโหมดสาธิต
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}

function DocumentCheck({ details }: { details: CertificateDetails }) {
  const [state, setState] = useState<{
    busy: boolean
    match?: boolean
    error?: string
    filename?: string
  }>({ busy: false })
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  async function check(file?: File) {
    if (!file) return
    const current = ++generation.current
    setState({ busy: true, filename: file.name })
    try {
      const actual = await hashPdf(file)
      if (current === generation.current)
        setState({
          busy: false,
          match: hashesMatch(actual, details.certificate.documentHash),
          filename: file.name,
        })
    } catch (failure) {
      if (current === generation.current)
        setState({ busy: false, error: readableError(failure), filename: file.name })
    }
  }
  return (
    <section className="panel document-check">
      <div className="card-heading">
        <span className="icon-tile">
          <FileCheck2 size={19} />
        </span>
        <h2>เอกสารตรงกันไหม?</h2>
      </div>
      <p>
        เลือก PDF ต้นฉบับเพื่อเปรียบเทียบ Hash
        <br />
        กับหลักฐานของใบรับรองนี้
      </p>
      <label className={`file-drop ${state.busy ? 'is-busy' : ''}`}>
        <Upload size={23} strokeWidth={1.5} />
        <strong>{state.busy ? 'กำลังคำนวณ Hash…' : 'เลือกไฟล์ PDF'}</strong>
        <span>ขนาดไม่เกิน 20 MB</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label="เลือก PDF เพื่อตรวจสอบ Hash"
          disabled={state.busy}
          onChange={(event) => {
            void check(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>
      {state.filename && <p className="filename">{state.filename}</p>}
      {state.error && <Notice kind="error">{state.error}</Notice>}
      {state.match !== undefined && (
        <Notice kind={state.match ? 'success' : 'error'}>
          {state.match
            ? 'Hash ตรงกัน · ไฟล์ตรงกับเอกสารที่บันทึก'
            : 'Hash ไม่ตรงกัน · ไฟล์นี้ต่างจากเอกสารที่บันทึก'}
          {state.match && details.certificate.revocation && (
            <strong className="block">แต่ใบรับรองนี้ถูกเพิกถอนแล้ว จึงไม่มีผลใช้งาน</strong>
          )}
        </Notice>
      )}
      <details className="hash-details">
        <summary>
          <Fingerprint size={14} /> ดู SHA-256 ที่บันทึก
        </summary>
        <code>{details.certificate.documentHash}</code>
      </details>
      {details.certificate.documentHash === SAMPLE_HASH && (
        <a
          className="sample-download"
          href={`${import.meta.env.BASE_URL}sample-certificate.pdf`}
          download
        >
          <Download size={14} /> ดาวน์โหลด PDF ตัวอย่างสำหรับทดสอบ
        </a>
      )}
    </section>
  )
}

function ShareCertificate({ id }: { id: string }) {
  const [message, setMessage] = useState('')
  const url = verificationUrl(id)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setMessage('คัดลอกลิงก์แล้ว')
    } catch {
      setMessage('คัดลอกอัตโนมัติไม่ได้ กรุณาคัดลอกจากช่องลิงก์ด้านล่าง')
    }
  }
  return (
    <section className="panel share-panel">
      <div className="card-heading">
        <span className="icon-tile">
          <QrCode size={19} />
        </span>
        <h2>แบ่งปันความสำเร็จ</h2>
      </div>
      <div className="qr-wrap">
        <QRCodeSVG value={url} size={112} level="M" marginSize={1} title={`ลิงก์ตรวจสอบ ${id}`} />
        <div>
          <strong>สแกนเพื่อตรวจสอบ</strong>
          <p>
            เปิดด้วยกล้องมือถือ
            <br />
            หรือนำลิงก์ไปแบ่งปัน
          </p>
        </div>
      </div>
      <button className="button secondary full-width" onClick={() => void copy()}>
        <Copy size={15} /> คัดลอกลิงก์ตรวจสอบ
      </button>
      <label className="sr-only" htmlFor="share-url">
        ลิงก์ตรวจสอบ
      </label>
      <div className="url-field">
        <Link2 size={13} />
        <input id="share-url" readOnly value={url} onFocus={(event) => event.target.select()} />
      </div>
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
      {local && (
        <p className="small muted">
          QR นี้ใช้ localhost หากสแกนด้วยมือถือ ให้เปิดเว็บผ่าน Network URL บน Wi-Fi เดียวกันก่อน
        </p>
      )}
      <p className="small muted">
        ข้อมูลสาธิตแยกแต่ละเบราว์เซอร์ ใบที่ออกใหม่ยังตรวจข้ามเครื่องไม่ได้จนกว่าจะเชื่อม Backend
      </p>
    </section>
  )
}

export function VerificationSteps() {
  return (
    <div className="how-it-works">
      <div>
        <span>01</span>
        <Search size={19} />
        <strong>ค้นหารหัส</strong>
        <p>ระบุใบรับรองที่ต้องการตรวจสอบ</p>
      </div>
      <ArrowRight className="step-arrow" size={17} />
      <div>
        <span>02</span>
        <CheckCircle2 size={19} />
        <strong>ตรวจสอบสถานะ</strong>
        <p>ดูหลักสูตร ผู้รับ และสถานะปัจจุบัน</p>
      </div>
      <ArrowRight className="step-arrow" size={17} />
      <div>
        <span>03</span>
        <FileCheck2 size={19} />
        <strong>ยืนยันเอกสาร</strong>
        <p>เปรียบเทียบ Hash กับ PDF ของคุณ</p>
      </div>
    </div>
  )
}
