'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { type ThemeMode } from '@/lib/theme/theme';
import { ConfirmationDialog, Drawer, DropdownMenu, Icon, IconButton } from '@/components/ui';
import { activeNavItem, counselorNavigation, navigation } from '@/components/shell/navigation';
import { NotificationBell } from '@/components/shell/NotificationBell';
import { isPreviewMode } from '@/lib/previewMode';
import { counselorMessages } from '@/lib/i18n/counselorMessages';

function Brand() {
  const { user } = useAuth(); const { text } = useLanguage();
  return <Link href={user?.role==='konselor'?'/counselor':'/overview'} className="brand" aria-label="Sajiwa"><span className="brand-mark" aria-hidden="true"><Image src="/brand/sajiwa.png" alt="" width={36} height={36} /></span><span><strong>Sajiwa</strong><small>{text.brandDescriptor}</small></span></Link>;
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname(); const { user } = useAuth(); const { language,text } = useLanguage(); const copy=counselorMessages[language];
  if(user?.role==='konselor')return <nav className="sidebar-nav" aria-label={text.common.mainNavigation}>{counselorNavigation.map((group)=><section key={group.key}><h2>{copy.navGroups[group.key]}</h2><ul>{group.items.map((item)=>{const active=item===activeNavItem(pathname,counselorNavigation);return <li key={item.key}><Link href={item.href} onClick={onNavigate} aria-current={active?'page':undefined} className={active?'nav-active':''}><Icon name={item.icon} filled={active}/><span>{copy.nav[item.key]}</span></Link></li>})}</ul></section>)}</nav>;
  return <nav className="sidebar-nav" aria-label={text.common.mainNavigation}>{navigation.map((group) => <section key={group.key}><h2>{text.navGroups[group.key]}</h2><ul>{group.items.map((item) => { const active = item === activeNavItem(pathname, navigation); return <li key={item.key}><Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={active ? 'nav-active' : ''}><Icon name={item.icon} filled={active} /><span>{text.nav[item.key]}</span></Link></li>; })}</ul></section>)}</nav>;
}

function SidebarFooter() {
  const { user } = useAuth(); const { text } = useLanguage();
  return <div className="sidebar-footer"><span className="avatar" aria-hidden="true">{initials(user?.name)}</span><span><strong>{user?.name ?? text.common.administrator}</strong><small>{user?.role==='konselor'?'Konselor':text.common.administrator}</small></span></div>;
}

function initials(name?: string) { return (name ?? 'AD').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, logout, switchPreviewRole } = useAuth(); const { language, setLanguage, text } = useLanguage(); const { mode, setMode } = useTheme();
  const [mobileNav, setMobileNav] = useState(false); const [logoutDialog, setLogoutDialog] = useState(false);
  const counselorCopy=counselorMessages[language];const active = useMemo(() => user?.role==='konselor'?activeNavItem(pathname,counselorNavigation):activeNavItem(pathname,navigation), [pathname,user?.role]);
  const themeItems: { label: string; value: ThemeMode; icon: ReactNode }[] = [{ label: text.theme.light, value: 'light', icon: <Icon name="sun" /> }, { label: text.theme.dark, value: 'dark', icon: <Icon name="moon" /> }, { label: text.theme.system, value: 'system', icon: <Icon name="monitor" /> }];
  return <div className="app-shell">
    <aside className="desktop-sidebar"><Brand /><NavContent /><SidebarFooter /></aside>
    <div className="workspace">
      <header className="topbar">
        <IconButton className="mobile-menu-button" label={text.common.openMenu} icon="menu" onClick={() => setMobileNav(true)} />
        <div className="topbar-context"><span>Sajiwa</span><strong>{active ? (user?.role==='konselor'?counselorCopy.nav[active.key as keyof typeof counselorCopy.nav]:text.nav[active.key as keyof typeof text.nav]) : text.common.account}</strong></div>
        <div className="topbar-actions">
          {isPreviewMode() && <button className="preview-role-switch" onClick={()=>{const role=user?.role==='konselor'?'admin':'konselor';switchPreviewRole(role);router.replace(role==='konselor'?'/counselor':'/overview')}}>{user?.role==='konselor'?'Admin Preview':'Konselor Preview'}</button>}
          <div className="language-switch" role="group" aria-label={text.common.language}><button className={language === 'id' ? 'active' : ''} onClick={() => setLanguage('id')} aria-pressed={language === 'id'}>ID</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button></div>
          <DropdownMenu label={text.common.theme} trigger={<><Icon name={mode === 'light' ? 'sun' : mode === 'dark' ? 'moon' : 'monitor'} /><span className="sr-only">{text.common.theme}</span></>} items={themeItems.map((item) => ({ label: item.label, icon: item.icon, onSelect: () => setMode(item.value) }))} />
          <NotificationBell />
          <DropdownMenu label={text.common.account} trigger={<><span className="avatar avatar-small" aria-hidden="true">{initials(user?.name)}</span><span className="profile-name">{user?.name ?? text.common.administrator}</span><Icon name="down" size={16} /></>} items={[{ label: text.common.settings, icon: <Icon name="settings" />, onSelect: () => router.push(user?.role==='konselor'?'/counselor/settings':'/settings') }, { label: text.common.logout, icon: <Icon name="logout" />, danger: true, onSelect: () => setLogoutDialog(true) }]} />
        </div>
      </header>
      <div className="workspace-scroll">{children}</div>
    </div>
    <Drawer open={mobileNav} onOpenChange={setMobileNav} title="Sajiwa" description={text.brandDescriptor} closeLabel={text.common.close}><div className="mobile-drawer-brand"><Brand /></div><NavContent onNavigate={() => setMobileNav(false)} /><SidebarFooter /></Drawer>
    <ConfirmationDialog open={logoutDialog} onOpenChange={setLogoutDialog} title={text.common.logoutTitle} consequence={text.common.logoutBody} cancelLabel={text.common.cancel} confirmLabel={text.common.logout} onConfirm={() => { logout(); router.replace('/login'); }} danger />
  </div>;
}
