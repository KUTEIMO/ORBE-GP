import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ORG_SLUG,
  DEFAULT_TOUR_SLUG,
  canonicalizeOrgSlug,
  canonicalizeTourSlug,
  controlWebHref,
  orgAdminHref,
  parseOrgAdminPath,
  parseSlugParam,
  parseTourPath,
  publicTourHref,
  resolveOrgSlug,
  resolveTourSlug,
} from '../../src/tourSlug.js';

test('parseSlugParam accepts clean lowercase slugs and rejects invalid syntax', () => {
  assert.equal(parseSlugParam('experienciavirtual'), 'experienciavirtual');
  assert.equal(parseSlugParam(' Sede-4 '), 'sede-4');
  assert.equal(parseSlugParam('bad slug!'), null);
  assert.equal(parseSlugParam('../secret'), null);
  assert.equal(parseSlugParam(''), null);
  assert.equal(parseSlugParam(null), null);
});

test('canonicalizeTourSlug and canonicalizeOrgSlug resolve legacy aliases', () => {
  assert.equal(canonicalizeTourSlug('unisimon-campus'), DEFAULT_TOUR_SLUG);
  assert.equal(canonicalizeTourSlug('sede-4'), 'sede-4');
  assert.equal(canonicalizeOrgSlug('unisimon-cucuta'), DEFAULT_ORG_SLUG);
  assert.equal(canonicalizeOrgSlug('empresa-demo'), 'empresa-demo');
});

test('parseTourPath parses canonical /{org}/{tour} and excludes reserved prefixes', () => {
  const parsed = parseTourPath('/unisimoncucuta/experienciavirtual/control-web/');
  assert.deepEqual(parsed, {
    orgSlug: 'unisimoncucuta',
    tourSlug: 'experienciavirtual',
    rest: 'control-web',
  });
  assert.equal(parseTourPath('/plataforma/login.html'), null);
  assert.equal(parseTourPath('/control-web/index.html'), null);
  assert.equal(parseTourPath('/media/unisimoncucuta/experienciavirtual/panoramas/a.jpg'), null);
  assert.equal(parseTourPath('/dist/index.html'), null);
});

test('resolveTourSlug and resolveOrgSlug follow path > query > inject > default precedence', () => {
  assert.equal(
    resolveTourSlug({
      pathname: '/orbe/sandbox/',
      search: '?slug=sede-4',
      injected: 'other',
    }),
    'sandbox'
  );
  assert.equal(
    resolveTourSlug({
      pathname: '/index.html',
      search: '?slug=sede-4',
      injected: 'other',
    }),
    'sede-4'
  );
  assert.equal(
    resolveOrgSlug({ pathname: '/empresa-x/sede-2/', injectedOrg: 'unisimoncucuta' }),
    'empresa-x'
  );
});

test('publicTourHref and controlWebHref require orgSlug and format canonical paths', () => {
  assert.throws(() => publicTourHref('sede-4'), /requires orgSlug/);
  assert.throws(() => controlWebHref('sede-4'), /requires orgSlug/);
  assert.equal(
    publicTourHref({ orgSlug: 'empresa-demo', tourSlug: 'campus', scene: 'hall-1' }),
    '/empresa-demo/campus/?scene=hall-1'
  );
  assert.equal(
    controlWebHref({ orgSlug: 'empresa-demo', tourSlug: 'campus' }),
    '/empresa-demo/campus/control-web/'
  );
});

test('orgAdminHref and parseOrgAdminPath distinguish org-level and legacy paths', () => {
  assert.throws(() => orgAdminHref({}), /requires orgSlug/);
  assert.equal(orgAdminHref('empresa-demo'), '/empresa-demo/org-admin.html');
  assert.deepEqual(parseOrgAdminPath('/empresa-demo/org-admin.html'), {
    orgSlug: 'empresa-demo',
  });
  assert.deepEqual(parseOrgAdminPath('/unisimoncucuta/experienciavirtual/org-admin.html'), {
    orgSlug: 'unisimoncucuta',
    tourSlug: 'experienciavirtual',
    legacy: true,
  });
});

