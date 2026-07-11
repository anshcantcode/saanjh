import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''} ${inverse ? 'brand--inverse' : ''}`} aria-label="Saanjh">
      <img src="/assets/botanical-emblem.webp" alt="" className="brand__mark" />
      <div className="brand__word-wrap">
        <span className="brand__word">saanjh</span>
        {!compact && <span className="brand__tagline">a familiar voice, held with care</span>}
      </div>
    </div>
  );
}

export function Button({ children, variant = 'primary', icon, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'cream'; icon?: IconName }) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({ label, icon, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconName }) {
  return <button aria-label={label} title={label} className={`icon-button ${className}`} {...props}><Icon name={icon} /></button>;
}

export function Badge({ children, tone = 'sage', icon }: { children: ReactNode; tone?: 'sage' | 'cream' | 'clay' | 'dark' | 'gold'; icon?: IconName }) {
  return <span className={`badge badge--${tone}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function PageHeader({ eyebrow, title, description, action, onBack }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode; onBack?: () => void }) {
  return (
    <header className="page-header reveal">
      <div className="page-header__rail">
        {onBack ? <IconButton label="Go back" icon="arrow-left" onClick={onBack} /> : <span />}
        {action}
      </div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="page-header__description">{description}</p>}
    </header>
  );
}

export function Field({ label, hint, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">{label}</span>
      <input {...props} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">{label}</span>
      <textarea {...props} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Notice({ title, children, tone = 'sage', icon = 'leaf' }: { title: string; children: ReactNode; tone?: 'sage' | 'cream' | 'clay' | 'dark'; icon?: IconName }) {
  return (
    <div className={`notice notice--${tone}`}>
      <span className="notice__icon"><Icon name={icon} size={18} /></span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <Icon name="cloud" size={20} />
      <p>{message}</p>
      {onDismiss && <IconButton label="Dismiss" icon="x" onClick={onDismiss} />}
    </div>
  );
}

export function EmptyState({ image, eyebrow, title, children, action }: { image: string; eyebrow?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="empty-state reveal">
      <div className="empty-state__image-wrap"><img src={image} alt="" className="empty-state__image" /></div>
      <div className="empty-state__copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        <p>{children}</p>
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </section>
  );
}

export function Busy({ label = 'Gathering your space…', fullscreen = false }: { label?: string; fullscreen?: boolean }) {
  return (
    <div className={`busy ${fullscreen ? 'busy--fullscreen' : ''}`} aria-live="polite" aria-busy="true">
      <div className="busy__emblem"><img src="/assets/botanical-emblem.webp" alt="" /></div>
      <span>{label}</span>
    </div>
  );
}

export function ServicePill({ online, configured, label }: { online: boolean; configured: boolean; label: string }) {
  const state = online ? 'online' : configured ? 'offline' : 'unconfigured';
  return <span className={`service-pill service-pill--${state}`}><i />{label}: {online ? 'online' : configured ? 'unavailable' : 'not configured'}</span>;
}

export function formatDate(value?: string, withTime = false): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, withTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(date);
}
