'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ApiError } from '@/lib/api/client';
import { Button, Icon, IconButton, InlineAlert, Input, LoadingState } from '@/components/ui';
import { roleHome } from '@/lib/auth/access';

export function LoginForm() {
  const { status, user, login, logout } = useAuth(); const { language, setLanguage, text } = useLanguage(); const router = useRouter();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<'invalid' | 'unavailable' | null>(null);
  useEffect(() => { if (status === 'authenticated' && user) router.replace(roleHome(user.role)); }, [router, status, user]);
  if (status === 'loading') return <LoadingState fullPage label={text.auth.loading} />;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setSubmitting(true);
    try { await login({ email: email.trim(), password }); }
    catch (caught) { setError(caught instanceof ApiError && caught.status === 401 ? 'invalid' : 'unavailable'); }
    finally { setSubmitting(false); }
  };
  return <main className="login-page"><section className="login-brand" aria-label="Sajiwa"><div className="login-stage" aria-hidden="true"><Image className="login-mascot" src="/brand/sajiwa-full.png" alt="" width={246} height={492} priority /></div><div className="login-brand-copy"><p className="login-brand-name">Sajiwa</p><h1>{text.brandDescriptor}</h1><p>{text.auth.portalDescription}</p></div></section><section className="login-panel"><div className="login-toolbar" role="group" aria-label={text.common.language}><button className={language === 'id' ? 'active' : ''} onClick={() => setLanguage('id')} aria-pressed={language === 'id'}>ID</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button></div><form className="login-card" onSubmit={submit} noValidate><p className="eyebrow">{text.auth.eyebrow}</p><h2>{text.auth.title}</h2><p className="login-description">{text.auth.description}</p>{status === 'expired' && <InlineAlert tone="warning">{text.auth.expired}</InlineAlert>}{status === 'unauthorized' && <InlineAlert tone="danger" title={text.auth.unauthorizedTitle}>{text.auth.unauthorizedBody}<button type="button" className="text-button" onClick={logout}>{text.common.logout}</button></InlineAlert>}{error && <InlineAlert tone="danger">{error === 'invalid' ? text.auth.invalid : text.auth.unavailable}</InlineAlert>}<Input label={text.auth.email} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /><Input label={text.auth.password} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} trailing={<IconButton type="button" label={showPassword ? text.auth.hide : text.auth.show} icon={showPassword ? 'eyeOff' : 'eye'} onClick={() => setShowPassword((value) => !value)} />} /><Button type="submit" loading={submitting} disabled={!email.trim() || !password} className="login-submit">{submitting ? text.auth.submitting : text.auth.submit}</Button><div className="login-security"><Icon name="info" size={17} /><span>{text.auth.restricted}</span></div></form></section></main>;
}
