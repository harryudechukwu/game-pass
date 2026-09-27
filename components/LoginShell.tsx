import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared sign-in layout for every login page (customer, attendant, admin,
 * manager) — the customer backdrop + a centered form with a bouncing-dots
 * loading state. Pages supply their own fields via `children`.
 */
export function LoginShell({
  title,
  subtitle,
  onSubmit,
  busy,
  error,
  submitLabel,
  submitDisabled,
  back,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  error?: string;
  submitLabel: string;
  submitDisabled?: boolean;
  back?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="gp-app gp-login">
      {back && (
        <Link href={back} className="gp-login-back" aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
      )}
      <form onSubmit={onSubmit} className="gp-login-box">
        <div className="gp-login-head">
          <h1 className="gp-login-title">{title}</h1>
          <p className="gp-login-sub">{subtitle}</p>
        </div>
        {error && <div className="gp-login-error">{error}</div>}
        <div className="gp-login-fields">{children}</div>
        <button type="submit" className="gp-cta gp-login-btn" disabled={busy || submitDisabled}>
          {busy ? <span className="gp-cta-dots"><i /><i /><i /></span> : submitLabel}
        </button>
        {footer}
      </form>
    </main>
  );
}

export function LoginField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="gp-login-field">
      <span className="gp-login-label">{label}</span>
      <input className="gp-input" {...props} />
    </label>
  );
}
