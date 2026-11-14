import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileBadge,
  Fingerprint,
  LockKeyhole,
  Plus,
  Search,
  Upload,
  Wallet,
} from 'lucide-react'
import type { Address } from 'viem'
import {
  formatDate,
  readableError,
  today,
  type Certificate,
  type CertificateService,
  type Course,
} from './domain'
import { hashPdf } from './document'
import { Empty, Loading, Notice, StatusBadge } from './components'

export function Courses({
  service,
  actor,
  courses,
  canCreate,
  onChanged,
}: {
  service: CertificateService
  actor: Address
  courses: Course[]
  canCreate: boolean
  onChanged: () => void
}) {
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const visible = courses.filter((course) =>
    `${course.code} ${course.name} ${course.description}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const course = await service.createCourse(actor, {
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? ''),
      })
      form.reset()
      setSuccess(`สร้างหลักสูตร ${course.code} แล้ว · บันทึกเฉพาะในโหมดสาธิต`)
      onChanged()
    } catch (failure) {
      setError(readableError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="COURSE CATALOG"
        title="หลักสูตรการอบรม"
        description="จัดการองค์ความรู้ และเตรียมหลักสูตรสำหรับออกใบรับรอง"
      />
      <div className="management-grid">
        <section className="panel course-list">
          <div className="section-title">
            <h2>
              หลักสูตรทั้งหมด <span className="count">{courses.length}</span>
            </h2>
          </div>
          <label className="search-input compact">
            <Search size={18} />
            <input
              aria-label="ค้นหาหลักสูตร"
              placeholder="ค้นหารหัสหรือชื่อหลักสูตร"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="course-items">
            {visible.map((course, index) => (
              <article className="course-item" key={course.code}>
                <div className={`course-symbol color-${index % 4}`}>
                  <BookOpen size={23} strokeWidth={1.5} />
                </div>
                <div>
                  <span className="mono course-code">{course.code}</span>
                  <h3>{course.name}</h3>
                  <p>{course.description}</p>
                </div>
              </article>
            ))}
            {visible.length === 0 && (
              <Empty title="ไม่พบหลักสูตร">ลองค้นหาด้วยรหัสหรือชื่ออื่น</Empty>
            )}
          </div>
        </section>
        <section className="panel form-panel">
          <div className="card-heading">
            <span className="icon-tile">
              <Plus size={20} />
            </span>
            <h2>เพิ่มหลักสูตรใหม่</h2>
          </div>
          {canCreate ? (
            <form onSubmit={(event) => void create(event)}>
              <fieldset disabled={busy}>
                <label>
                  รหัสหลักสูตร
                  <input
                    name="code"
                    required
                    maxLength={64}
                    placeholder="เช่น WEB-301"
                    pattern="[A-Za-z0-9_-]+"
                  />
                </label>
                <label>
                  ชื่อหลักสูตร
                  <input
                    name="name"
                    required
                    maxLength={120}
                    placeholder="เช่น Web Development Essentials"
                  />
                </label>
                <label>
                  รายละเอียดการอบรม
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    rows={4}
                    placeholder="อธิบายเนื้อหาและทักษะที่ผู้เรียนจะได้รับ"
                  />
                </label>
                <button className="button primary full-width" type="submit">
                  <Plus size={17} />
                  {busy ? 'กำลังบันทึก…' : 'สร้างหลักสูตรสาธิต'}
                </button>
              </fieldset>
              {error && <Notice kind="error">{error}</Notice>}
              {success && <Notice kind="success">{success}</Notice>}
            </form>
          ) : (
            <AccessNotice>
              เลือกบัญชีสาธิต “ผู้ดูแลระบบ” ที่แถบด้านบนเพื่อสร้างหลักสูตร
            </AccessNotice>
          )}
        </section>
      </div>
    </>
  )
}

export function Issue({
  service,
  actor,
  courses,
  canIssue,
  onIssued,
}: {
  service: CertificateService
  actor: Address
  courses: Course[]
  canIssue: boolean
  onIssued: (id: string) => void
}) {
  const [document, setDocument] = useState<{
    hash?: string
    filename?: string
    busy: boolean
    error?: string
  }>({ busy: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  useEffect(
    () => () => {
      generation.current++
    },
    [],
  )
  async function selectFile(file?: File) {
    const current = ++generation.current
    setDocument({ busy: Boolean(file), filename: file?.name })
    if (!file) return
    try {
      const hash = await hashPdf(file)
      if (current === generation.current) setDocument({ hash, filename: file.name, busy: false })
    } catch (failure) {
      if (current === generation.current)
        setDocument({ busy: false, error: readableError(failure), filename: file.name })
    }
  }
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!document.hash || document.busy) {
      setError('กรุณาเลือกไฟล์ PDF และรอให้คำนวณ Hash สำเร็จ')
      return
    }
    const data = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const certificate = await service.issueCertificate(actor, {
        id: String(data.get('id') ?? ''),
        courseCode: String(data.get('courseCode') ?? ''),
        recipient: String(data.get('recipient') ?? ''),
        issuedOn: String(data.get('issuedOn') ?? ''),
        documentHash: document.hash,
      })
      onIssued(certificate.id)
    } catch (failure) {
      setError(readableError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ISSUE A CREDENTIAL"
        title="ออกใบรับรองดิจิทัล"
        description="บันทึกความสำเร็จ พร้อมหลักฐานที่ตรวจสอบย้อนกลับได้"
      />
      {!canIssue ? (
        <section className="panel">
          <AccessNotice>
            เลือกบัญชีสาธิต “ผู้ดูแลระบบ” หรือ “ผู้ออกใบรับรอง” เพื่อทดลองออกใบรับรอง
          </AccessNotice>
        </section>
      ) : (
        <div className="issue-grid">
          <section className="panel form-panel">
            <div className="section-title">
              <span className="step">01</span>
              <div>
                <h2>ข้อมูลใบรับรอง</h2>
                <p>กรอกข้อมูลให้ครบ และตรวจสอบ Wallet ผู้รับให้ถูกต้อง</p>
              </div>
            </div>
            <form onSubmit={(event) => void issue(event)}>
              <fieldset disabled={busy}>
                <div className="form-row">
                  <label>
                    รหัสใบรับรอง
                    <input
                      name="id"
                      required
                      maxLength={64}
                      pattern="[A-Za-z0-9_-]+"
                      placeholder="เช่น ST-2026-004"
                    />
                  </label>
                  <label>
                    วันที่ออกใบรับรอง
                    <input
                      name="issuedOn"
                      type="date"
                      required
                      max={today()}
                      defaultValue={today()}
                    />
                  </label>
                </div>
                <label>
                  หลักสูตร
                  <select name="courseCode" required defaultValue="">
                    <option value="" disabled>
                      เลือกหลักสูตร
                    </option>
                    {courses.map((course) => (
                      <option key={course.code} value={course.code}>
                        {course.code} · {course.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Wallet Address ของผู้รับ
                  <input
                    name="recipient"
                    required
                    maxLength={42}
                    minLength={42}
                    placeholder="0x…"
                    spellCheck={false}
                    className="mono"
                  />
                  <span className="field-help">
                    ใช้ Wallet เป็นตัวอ้างอิง ไม่ต้องกรอกชื่อหรือข้อมูลส่วนบุคคล
                  </span>
                </label>
                <div className="form-divider" />
                <div className="section-title">
                  <span className="step">02</span>
                  <div>
                    <h2>หลักฐานเอกสาร</h2>
                    <p>ระบบจะคำนวณ SHA-256 จากไฟล์ โดยไม่อัปโหลด PDF</p>
                  </div>
                </div>
                <label className="file-drop issue-upload">
                  <Upload size={25} />
                  <strong>{document.busy ? 'กำลังคำนวณ Hash…' : 'เลือก PDF ใบรับรอง'}</strong>
                  <span>ขนาดไม่เกิน 20 MB</span>
                  <input
                    aria-label="เลือก PDF สำหรับออกใบรับรอง"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      void selectFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
                {document.filename && <p className="filename">{document.filename}</p>}
                {document.error && <Notice kind="error">{document.error}</Notice>}
                {document.hash && (
                  <div className="hash-preview">
                    <span>
                      <CheckCircle2 size={15} /> SHA-256 พร้อมใช้งาน
                    </span>
                    <code>{document.hash}</code>
                  </div>
                )}
                <button
                  className="button primary full-width"
                  type="submit"
                  disabled={document.busy || !document.hash || courses.length === 0}
                >
                  <FileBadge size={18} />
                  {busy ? 'กำลังออกใบรับรอง…' : 'ออกใบรับรองสาธิต'}
                  <ArrowRight size={17} />
                </button>
              </fieldset>
              {error && <Notice kind="error">{error}</Notice>}
            </form>
          </section>
          <aside>
            <div className="issue-help">
              <div className="icon-tile">
                <Fingerprint size={24} />
              </div>
              <h2>
                เก็บหลักฐาน
                <br />
                รักษาความเป็นส่วนตัว
              </h2>
              <p>
                จัดเก็บเฉพาะรหัส หลักสูตร วันที่ Wallet และ Hash เพื่อให้ตรวจสอบเอกสารได้
                โดยไม่บันทึกเนื้อหา PDF
              </p>
              <ul>
                <li>
                  <CheckCircle2 size={16} /> รหัสใบรับรองต้องไม่ซ้ำ
                </li>
                <li>
                  <CheckCircle2 size={16} /> ออกได้เฉพาะบัญชีที่ได้รับสิทธิ์
                </li>
                <li>
                  <CheckCircle2 size={16} /> เพิกถอนได้โดยคงประวัติเดิม
                </li>
              </ul>
            </div>
            <Notice>
              รายการนี้เป็นการจำลองในเบราว์เซอร์ ไม่มีค่าธรรมเนียมและไม่มีธุรกรรมบน Blockchain
            </Notice>
          </aside>
        </div>
      )}
    </>
  )
}

export function MyCertificates({
  service,
  courses,
  account,
  source,
  version,
  onOpen,
  onConnect,
  connecting,
}: {
  service: CertificateService
  courses: Course[]
  account?: Address
  source: 'demo' | 'wallet'
  version: number
  onOpen: (id: string) => void
  onConnect: () => void
  connecting: boolean
}) {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    setCertificates([])
    if (!account) {
      setLoading(false)
      return
    }
    void service
      .listCertificates(account)
      .then((items) => {
        if (live) setCertificates(items)
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
  }, [account, service, version])
  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING JOURNEY"
        title="ใบรับรองของฉัน"
        description="ทุกทักษะ ทุกความสำเร็จ รวมไว้ในที่เดียว"
      />
      <div className="account-strip">
        <span className="icon-tile">
          <Wallet size={21} />
        </span>
        <div>
          <span>{source === 'demo' ? 'บัญชีสาธิตที่เลือก' : 'Wallet จริงที่เชื่อมต่อ'}</span>
          <strong className="mono break-anywhere">{account ?? 'ยังไม่ได้เชื่อมต่อ Wallet'}</strong>
        </div>
        <span className="tag">{source === 'demo' ? 'DEMO ACCOUNT' : 'REAL WALLET'}</span>
      </div>
      {source === 'wallet' && (
        <Notice>
          รายการด้านล่างยังอ่านจากข้อมูลสาธิตในเบราว์เซอร์ ไม่ใช่ข้อมูลบน Blockchain และการเชื่อม
          Wallet ไม่ได้ให้สิทธิ์จัดการระบบจริง
        </Notice>
      )}
      {!account ? (
        <section className="panel">
          <Empty title="เชื่อมต่อ Wallet ของคุณ">
            เชื่อมกระเป๋าเพื่อค้นหาใบรับรองสาธิตที่ผูกกับบัญชีนี้
          </Empty>
          <button className="button primary centered" disabled={connecting} onClick={onConnect}>
            <Wallet size={17} />
            {connecting ? 'กำลังเชื่อมต่อ…' : 'เชื่อม Wallet จริง'}
          </button>
        </section>
      ) : loading ? (
        <Loading />
      ) : error ? (
        <Notice kind="error">{error}</Notice>
      ) : certificates.length === 0 ? (
        <section className="panel">
          <Empty title="ยังไม่มีใบรับรองสำหรับบัญชีนี้">
            เลือกบัญชีสาธิต “ผู้รับใบรับรอง” เพื่อดูตัวอย่าง หรือทดลองออกใบรับรองให้ Wallet นี้
          </Empty>
        </section>
      ) : (
        <>
          <div className="list-caption">
            พบ {certificates.length} ใบรับรอง <span>ข้อมูลจากโหมดสาธิต</span>
          </div>
          <div className="credential-grid">
            {certificates.map((certificate) => (
              <article className="panel credential-card" key={certificate.id}>
                <div className="credential-top">
                  <span className="icon-tile">
                    <FileBadge size={24} />
                  </span>
                  <StatusBadge certificate={certificate} />
                </div>
                <span className="eyebrow">{certificate.courseCode}</span>
                <h2>
                  {courses.find((course) => course.code === certificate.courseCode)?.name ??
                    certificate.courseCode}
                </h2>
                <p className="mono">{certificate.id}</p>
                <div className="credential-bottom">
                  <span>{formatDate(certificate.issuedOn)}</span>
                  <button className="text-button" onClick={() => onOpen(certificate.id)}>
                    ดูใบรับรอง <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <span /> {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

function AccessNotice({ children }: { children: ReactNode }) {
  return (
    <div className="access-notice">
      <LockKeyhole size={29} strokeWidth={1.5} />
      <h3>ต้องใช้บัญชีที่ได้รับสิทธิ์</h3>
      <p>{children}</p>
    </div>
  )
}
