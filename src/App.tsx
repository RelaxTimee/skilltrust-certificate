import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleHelp,
  FileBadge,
  FlaskConical,
  GraduationCap,
  Menu,
  Plus,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react'
import {
  readableError,
  shortAddress,
  type Certificate,
  type CertificateService,
  type Course,
  type Permissions,
  type Role,
} from './domain'
import { demoAccounts } from './seed'
import { MockCertificateService } from './mock-service'
import { useWallet } from './wallet'
import { ConfirmDialog, Loading, Notice } from './components'
import { Verify, VerificationSteps } from './Verify'
import { Courses, Issue, MyCertificates } from './Management'

type View = 'verify' | 'mine' | 'courses' | 'issue'
const navigation = [
  { id: 'verify', title: 'ตรวจสอบใบรับรอง', icon: SearchCheck },
  { id: 'mine', title: 'ใบรับรองของฉัน', icon: FileBadge },
  { id: 'courses', title: 'หลักสูตรการอบรม', icon: BookOpen },
  { id: 'issue', title: 'ออกใบรับรอง', icon: Plus },
] as const
const roleLabels = { recipient: 'ผู้รับใบรับรอง', issuer: 'ผู้ออกใบรับรอง', admin: 'ผู้ดูแลระบบ' }
const noPermissions: Permissions = {
  role: 'visitor',
  canCreateCourse: false,
  canIssue: false,
  canRevoke: false,
}

function browserService() {
  return new MockCertificateService({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  })
}

export function App({ providedService }: { providedService?: CertificateService }) {
  const [service] = useState(() => providedService ?? browserService())
  const [view, setView] = useState<View>('verify')
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get('certificate') ?? 'ST-2026-001',
  )
  const [role, setRole] = useState<Exclude<Role, 'visitor'>>('recipient')
  const [mineSource, setMineSource] = useState<'demo' | 'wallet'>('demo')
  const [courses, setCourses] = useState<Course[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [permissions, setPermissions] = useState(noPermissions)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [version, setVersion] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const wallet = useWallet()
  const actor = demoAccounts[role]

  useEffect(() => {
    let live = true
    setError('')
    void Promise.all([
      service.listCourses(),
      service.listCertificates(),
      service.permissions(actor),
    ])
      .then(([nextCourses, nextCertificates, nextPermissions]) => {
        if (live) {
          setCourses(nextCourses)
          setCertificates(nextCertificates)
          setPermissions(nextPermissions)
        }
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
  }, [service, actor, version])

  useEffect(() => {
    const sync = () => {
      setSelectedId(new URLSearchParams(window.location.search).get('certificate') ?? 'ST-2026-001')
      setView('verify')
    }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === 'skilltrust.demo.v1' || event.key === null)
        setVersion((current) => current + 1)
    }
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('storage', storageChanged)
    window.addEventListener('keydown', closeMenu)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('keydown', closeMenu)
    }
  }, [])

  function navigate(next: View) {
    setView(next)
    setMenuOpen(false)
    setSuccess('')
  }
  function refresh() {
    setVersion((current) => current + 1)
  }
  function openCertificate(id: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('certificate', id)
    window.history.pushState({}, '', url)
    setSelectedId(id)
    setView('verify')
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        ข้ามไปยังเนื้อหา
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="เมนูหลัก">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(event) => {
            event.preventDefault()
            navigate('verify')
          }}
        >
          <span className="brand-icon">
            <ShieldCheck size={26} strokeWidth={1.8} />
          </span>
          <span>
            SkillTrust<small>ACADEMY</small>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="ปิดเมนูหลัก"
          onClick={() => setMenuOpen(false)}
        >
          <X />
        </button>
        <div className="sidebar-caption">CREDENTIAL WORKSPACE</div>
        <nav>
          {navigation.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{title}</span>
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-info">
            <span className="orbit-icon">
              <GraduationCap size={26} strokeWidth={1.4} />
            </span>
            <strong>
              ทักษะของคุณ
              <br />
              มีคุณค่าที่พิสูจน์ได้
            </strong>
            <p>
              เรียนรู้ เติบโต และส่งต่อ
              <br />
              ความสำเร็จอย่างมั่นใจ
            </p>
            <span className="sidebar-tag">
              BUILT FOR TRUST <ArrowUpRight size={13} />
            </span>
          </div>
          <button className="sidebar-help" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} /> วิธีใช้งานและข้อมูลระบบ <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-footer">
            <span className="green-dot" /> Assignment 10 <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="เปิดเมนูหลัก"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((item) => item.id === view)?.title}</strong>
          </div>
          <button
            className="button wallet-button"
            disabled={wallet.connecting}
            onClick={() => {
              if (wallet.account) {
                wallet.disconnect()
                setMineSource('demo')
              } else {
                void wallet.connect()
              }
            }}
          >
            <Wallet size={17} />
            <span>
              {wallet.connecting
                ? 'กำลังเชื่อมต่อ…'
                : wallet.account
                  ? `${shortAddress(wallet.account)} · ตัดการเชื่อมต่อ`
                  : 'เชื่อม Wallet จริง'}
            </span>
          </button>
        </header>
        <div className="demo-toolbar">
          <div className="demo-status">
            <FlaskConical size={16} />
            <strong>โหมดสาธิต</strong>
            <span>— ข้อมูลยังไม่ได้บันทึกบน Blockchain</span>
          </div>
          <div className="demo-controls">
            <label htmlFor="demo-role">บัญชีสาธิต:</label>
            <select
              id="demo-role"
              value={role}
              onChange={(event) => {
                setPermissions(noPermissions)
                setRole(event.target.value as Exclude<Role, 'visitor'>)
                setSuccess('')
              }}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="icon-button reset-button"
              aria-label="รีเซ็ตข้อมูลสาธิต"
              title="รีเซ็ตข้อมูลสาธิต"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
        <main id="main" tabIndex={-1}>
          <div className="main-inner">
            {wallet.error && <Notice kind="error">{wallet.error}</Notice>}
            {wallet.account && (
              <div className="wallet-connected">
                <Wallet size={15} />
                <span>
                  Wallet จริง: <code>{shortAddress(wallet.account)}</code> · Chain ID{' '}
                  {wallet.chainId ?? '—'}
                </span>
                <strong>บัญชีจัดการยังเป็นบัญชีสาธิต</strong>
              </div>
            )}
            {success && <Notice kind="success">{success}</Notice>}
            {loading ? (
              <Loading />
            ) : error ? (
              <section className="panel">
                <Notice kind="error">{error}</Notice>
                <div className="error-actions">
                  <button className="button secondary" onClick={refresh}>
                    ลองโหลดใหม่
                  </button>
                  <button className="button primary" onClick={() => setResetOpen(true)}>
                    รีเซ็ตข้อมูลสาธิต
                  </button>
                </div>
              </section>
            ) : (
              <>
                {view === 'verify' && (
                  <>
                    <Verify
                      service={service}
                      initialId={selectedId}
                      version={version}
                      actor={actor}
                      canRevoke={permissions.canRevoke}
                      onChanged={refresh}
                      onSelect={setSelectedId}
                    />
                    <section className="overview">
                      <div className="overview-label">
                        ภาพรวมข้อมูลสาธิต <span>ข้อมูลในเบราว์เซอร์นี้</span>
                      </div>
                      <div className="stat-grid">
                        <button className="stat" onClick={() => navigate('courses')}>
                          <span className="stat-icon">
                            <BookOpen size={21} />
                          </span>
                          <span>
                            <strong>{courses.length.toString().padStart(2, '0')}</strong>
                            <small>หลักสูตรการอบรม</small>
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                        <button
                          className="stat"
                          onClick={() => {
                            setMineSource('demo')
                            setRole('recipient')
                            navigate('mine')
                          }}
                        >
                          <span className="stat-icon">
                            <FileBadge size={21} />
                          </span>
                          <span>
                            <strong>{certificates.length.toString().padStart(2, '0')}</strong>
                            <small>ใบรับรองทั้งหมด</small>
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                        <div className="stat">
                          <span className="stat-icon muted-icon">
                            <ArrowDownLeft size={21} />
                          </span>
                          <span>
                            <strong>
                              {certificates
                                .filter((item) => item.revocation)
                                .length.toString()
                                .padStart(2, '0')}
                            </strong>
                            <small>ใบรับรองที่เพิกถอน</small>
                          </span>
                          <span className="stat-note">คงประวัติเดิม</span>
                        </div>
                      </div>
                    </section>
                    <VerificationSteps />
                  </>
                )}
                {view === 'courses' && (
                  <Courses
                    key={actor}
                    service={service}
                    actor={actor}
                    courses={courses}
                    canCreate={permissions.canCreateCourse}
                    onChanged={refresh}
                  />
                )}
                {view === 'issue' && (
                  <Issue
                    key={actor}
                    service={service}
                    actor={actor}
                    courses={courses}
                    canIssue={permissions.canIssue}
                    onIssued={(id) => {
                      setSuccess(`ออกใบรับรอง ${id} สำเร็จในโหมดสาธิต`)
                      refresh()
                      openCertificate(id)
                    }}
                  />
                )}
                {view === 'mine' && (
                  <>
                    <div className="source-switch" role="group" aria-label="แหล่งบัญชีใบรับรอง">
                      <button
                        aria-pressed={mineSource === 'demo'}
                        className={mineSource === 'demo' ? 'selected' : ''}
                        onClick={() => setMineSource('demo')}
                      >
                        <FlaskConical size={15} /> บัญชีสาธิต
                      </button>
                      <button
                        aria-pressed={mineSource === 'wallet'}
                        className={mineSource === 'wallet' ? 'selected' : ''}
                        onClick={() => setMineSource('wallet')}
                      >
                        <Wallet size={15} /> Wallet จริง
                      </button>
                    </div>
                    <MyCertificates
                      service={service}
                      courses={courses}
                      account={mineSource === 'demo' ? actor : wallet.account}
                      source={mineSource}
                      version={version}
                      onOpen={openCertificate}
                      onConnect={() => void wallet.connect()}
                      connecting={wallet.connecting}
                    />
                  </>
                )}
              </>
            )}
            <footer className="main-footer">
              <span>© {new Date().getFullYear()} SkillTrust Academy</span>
              <span>
                เรียนรู้ด้วยความตั้งใจ · ยืนยันด้วยความเชื่อมั่น <ShieldCheck size={14} />
              </span>
            </footer>
          </div>
        </main>
      </div>
      {resetOpen && (
        <ConfirmDialog
          title="รีเซ็ตข้อมูลสาธิต?"
          confirmLabel="รีเซ็ตข้อมูล"
          danger
          onClose={() => setResetOpen(false)}
          onConfirm={async () => {
            if (!(service instanceof MockCertificateService))
              throw new Error('บริการนี้ไม่รองรับการรีเซ็ต')
            await service.reset()
            setSuccess('รีเซ็ตข้อมูลสาธิตเรียบร้อยแล้ว')
            refresh()
          }}
        >
          <p>
            หลักสูตรและใบรับรองที่เพิ่มในเบราว์เซอร์นี้จะถูกแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้น
            โดยไม่กระทบ Wallet หรือข้อมูลบน Blockchain
          </p>
        </ConfirmDialog>
      )}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    return () => ref.current?.close()
  }, [ref])
  return (
    <dialog
      ref={(element) => {
        ref.current = element
      }}
      className="confirm-dialog help-dialog"
      aria-labelledby="help-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="dialog-heading">
        <h2 id="help-title">เริ่มต้นกับ SkillTrust</h2>
        <button className="icon-button" aria-label="ปิดวิธีใช้งาน" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-content">
        <ol>
          <li>
            ค้นหารหัส ST-2026-001 เพื่อดูใบรับรองที่มีผลใช้งาน หรือ ST-2026-003
            สำหรับใบที่ถูกเพิกถอน
          </li>
          <li>ดาวน์โหลด PDF ตัวอย่างจากส่วนตรวจเอกสาร แล้วเลือกไฟล์นั้นเพื่อลองตรวจ Hash</li>
          <li>เลือกบัญชีสาธิตผู้ดูแลระบบเพื่อสร้างหลักสูตร หรือเพิกถอนใบรับรอง</li>
          <li>เลือกผู้ออกใบรับรองเพื่อออกใบใหม่ โดยใช้ Wallet ผู้รับ {demoAccounts.recipient}</li>
          <li>เลือกผู้รับใบรับรอง แล้วเปิด “ใบรับรองของฉัน” เพื่อดูรายการ</li>
        </ol>
        <Notice>
          ระบบนี้ใช้ localStorage ซึ่งแก้ไขหรือลบได้ จึงใช้เพื่อสาธิตเท่านั้น
          การเปิดใช้งานจริงต้องเชื่อม Smart Contract และตรวจสิทธิ์บน Contract
        </Notice>
        <p className="small">
          QR บนมือถือ: เปิดผ่าน Network URL บน Wi-Fi เดียวกัน การคำนวณ Hash และเชื่อม Wallet ต้องใช้
          HTTPS หรือ localhost หากเบราว์เซอร์จำกัดความสามารถเหล่านี้
        </p>
      </div>
      <div className="dialog-actions">
        <button className="button primary" onClick={onClose}>
          เข้าใจแล้ว <ArrowUpRight size={16} />
        </button>
      </div>
    </dialog>
  )
}
