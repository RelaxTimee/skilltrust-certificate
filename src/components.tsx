import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import type { Certificate } from './domain'

export function Notice({
  children,
  kind = 'info',
}: {
  children: ReactNode
  kind?: 'info' | 'error' | 'success'
}) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function StatusBadge({ certificate }: { certificate: Certificate }) {
  return (
    <span className={`status-badge ${certificate.revocation ? 'revoked' : ''}`}>
      {certificate.revocation ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
      {certificate.revocation ? 'เพิกถอนแล้ว' : 'มีผลใช้งาน'}
    </span>
  )
}

export function Loading({ children = 'กำลังโหลดข้อมูล' }: { children?: ReactNode }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={22} className="spin" aria-hidden="true" />
      {children}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <ShieldCheck size={36} strokeWidth={1.3} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onClose,
  onConfirm,
  danger = false,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
  danger?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    ref.current?.showModal()
    return () => ref.current?.close()
  }, [])
  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ')
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-content">{children}</div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="dialog-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className={`button ${danger ? 'danger' : 'primary'}`}
          disabled={busy}
          onClick={() => void confirm()}
        >
          {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}
          {busy ? 'กำลังดำเนินการ…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
