'use client';

import {useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/components/auth/AuthProvider';
import {useLanguage} from '@/components/providers/LanguageProvider';
import {useTheme} from '@/components/providers/ThemeProvider';
import {Badge, Button, ErrorState, InlineAlert, LoadingState, PageShell} from '@/components/ui';
import {counselorMessages} from '@/lib/i18n/counselorMessages';
import {getCounselorWorkspace} from './api';
import {jakartaDate} from './format';
import {useCounselorData} from './useCounselorData';

export function CounselorSettingsPage() {
  const router = useRouter();
  const {user, logout} = useAuth();
  const {language, setLanguage} = useLanguage();
  const {mode, setMode} = useTheme();
  const copy = counselorMessages[language];
  const load = useCallback((signal: AbortSignal) => getCounselorWorkspace(jakartaDate(), jakartaDate(30), signal), []);
  const {data, error, retry} = useCounselorData(load);
  if (error) return <ErrorState title={copy.settings.title} message={copy.errors.load} retry={retry} retryLabel={copy.common.retry}/>;
  if (!data) return <LoadingState label={copy.common.loading} fullPage/>;

  return <PageShell title={copy.settings.title} description={copy.settings.subtitle}>
    <div className="counselor-settings-layout">
      <div className="settings-column">
        <section className="operations-panel settings-section" aria-labelledby="profile-heading"><header><h2 id="profile-heading">{copy.settings.profile}</h2></header><div className="profile-summary"><span className="avatar">{user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span><div><strong>{user?.name}</strong><p>{user?.email}</p><Badge tone="success">{copy.settings.role}: Konselor</Badge></div></div><dl className="definition-list settings-definitions"><div><dt>{copy.settings.email}</dt><dd>{user?.email}</dd></div><div><dt>{copy.settings.role}</dt><dd>Konselor</dd></div></dl><InlineAlert tone="info">{copy.settings.readOnly}</InlineAlert></section>
        <section className="operations-panel settings-section" aria-labelledby="availability-summary-heading"><header><h2 id="availability-summary-heading">{copy.settings.availability}</h2></header><dl className="counselor-summary-list"><div><dt>{copy.settings.recurringWindows}</dt><dd>{data.availability.length}</dd></div><div><dt>{copy.settings.pendingExceptions}</dt><dd>{data.exceptions.filter((row) => row.status === 'pending').length}</dd></div><div><dt>{copy.settings.nextSchedule}</dt><dd>{data.appointments.length}</dd></div></dl></section>
      </div>
      <div className="settings-column">
        <section className="operations-panel settings-section" aria-labelledby="preferences-heading"><header><h2 id="preferences-heading">{language === 'id' ? 'Preferensi' : 'Preferences'}</h2></header><div className="preference-group"><h3>{copy.settings.appearance}</h3><div className="setting-options" role="group" aria-label={copy.settings.appearance}>{(['light', 'dark', 'system'] as const).map((item) => <button className={mode === item ? 'active' : ''} aria-pressed={mode === item} key={item} onClick={() => setMode(item)}>{item}</button>)}</div></div><div className="preference-group"><h3>{copy.settings.language}</h3><div className="setting-options two-options" role="group" aria-label={copy.settings.language}><button className={language === 'id' ? 'active' : ''} aria-pressed={language === 'id'} onClick={() => setLanguage('id')}>Bahasa Indonesia</button><button className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button></div></div></section>
        <section className="operations-panel settings-section session-section" aria-labelledby="session-heading"><header><h2 id="session-heading">{copy.settings.session}</h2></header><div><span>{copy.settings.signedInAs}</span><strong>{user?.email}</strong></div><Button variant="secondary" icon="logout" onClick={() => {logout(); router.replace('/login')}}>{copy.settings.logout}</Button></section>
      </div>
    </div>
  </PageShell>;
}
