import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; icon?: IconName; loading?: boolean; children: ReactNode }

export function Button({ variant = 'primary', icon, loading = false, children, className = '', disabled, ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}<span>{children}</span></button>;
}

export function IconButton({ label, icon, className = '', ...props }: { label: string; icon: IconName } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}><Icon name={icon} /></button>;
}
