import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; hint?: string; trailing?: ReactNode }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, trailing, id: suppliedId, className = '', ...props }, ref) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const messageId = `${id}-message`;
  return <div className={`field ${className}`}><label htmlFor={id}>{label}</label><div className={`input-wrap ${error ? 'input-error' : ''}`}><input ref={ref} id={id} aria-invalid={!!error} aria-describedby={error || hint ? messageId : undefined} {...props} />{trailing}</div>{(error || hint) && <p id={messageId} className={error ? 'field-error' : 'field-hint'}>{error ?? hint}</p>}</div>;
});
