import assert from 'node:assert/strict';
import test from 'node:test';
import {activeNavItem,counselorNavigation,navigationForRole} from '../components/shell/navigation.ts';

test('counselor identity selects counselor navigation and hides admin routes',()=>{
  const hrefs=navigationForRole('konselor').flatMap((group)=>group.items.map((item)=>item.href));
  assert.ok(hrefs.includes('/counselor'));
  assert.ok(hrefs.includes('/counselor/students'));
  assert.ok(hrefs.includes('/counselor/schedule'));
  assert.ok(hrefs.includes('/counselor/availability'));
  assert.ok(hrefs.includes('/counselor/reviews'));
  assert.ok(hrefs.includes('/counselor/settings'));
  assert.equal(hrefs.includes('/overview'),false);
});

test('admin identity selects admin navigation and hides counselor routes',()=>{
  const hrefs=navigationForRole('admin').flatMap((group)=>group.items.map((item)=>item.href));
  assert.ok(hrefs.includes('/overview'));
  assert.equal(hrefs.some((href)=>href==='/counselor'||href.startsWith('/counselor/')),false);
});

test('only the deepest matching item is active, so the counselor home does not light up on its subpages',()=>{
  assert.equal(activeNavItem('/counselor/schedule',counselorNavigation)?.href,'/counselor/schedule');
  assert.equal(activeNavItem('/counselor',counselorNavigation)?.href,'/counselor');
  assert.equal(activeNavItem('/elsewhere',counselorNavigation),undefined);
});
