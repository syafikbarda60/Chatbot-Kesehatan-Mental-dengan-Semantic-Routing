import assert from 'node:assert/strict';
import test from 'node:test';
import {roleHome,roleRedirect} from './access.ts';

test('counselor routes allow counselor and redirect admin to overview',()=>{
  assert.equal(roleRedirect('konselor',['konselor']),null);
  assert.equal(roleRedirect('admin',['konselor']),'/overview');
});

test('admin routes redirect counselor to the counselor home without loops',()=>{
  assert.equal(roleRedirect('konselor',['admin']),'/counselor');
  assert.equal(roleRedirect('admin',['admin']),null);
  assert.equal(roleHome('konselor'),'/counselor');
  assert.equal(roleHome('admin'),'/overview');
});
