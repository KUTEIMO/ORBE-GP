import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL_BRANDING_FALLBACK,
  brandingLooksLikeOrbePlatform,
  contrastInkForHex,
  contrastRatio,
  isPublicTourViewerPath,
  resolveClientBranding,
  sanitizeSafeAssetUrl,
} from '../../src/tourBranding.js';

test('contrastInkForHex and contrastRatio enforce WCAG AA ink over arbitrary brand colors', () => {
  assert.equal(contrastInkForHex('#0a7a45'), '#ffffff');
  assert.equal(contrastInkForHex('#1f2937'), '#ffffff');
  assert.equal(contrastInkForHex('#f59e0b'), '#09110d');
  assert.equal(contrastInkForHex('#e0f2fe'), '#09110d');

  for (const hex of ['#0a7a45', '#4b5563', '#f59e0b', '#e0f2fe', '#c026d3', '#38bdf8']) {
    const ink = contrastInkForHex(hex);
    const ratio = contrastRatio(hex, ink);
    assert.ok(ratio >= 4.5, `Expected contrast >= 4.5 for ${hex} with ${ink}, got ${ratio.toFixed(2)}`);
  }
});

test('brandingLooksLikeOrbePlatform flags platform sky and retired green accents', () => {
  assert.equal(brandingLooksLikeOrbePlatform({ primaryColor: '#0284c7' }), true);
  assert.equal(brandingLooksLikeOrbePlatform({ primaryColor: '#0369A1' }), true);
  assert.equal(brandingLooksLikeOrbePlatform({ primaryColor: '#009b3a' }), true);
  assert.equal(brandingLooksLikeOrbePlatform({ primaryColor: '#0a7a45' }), false);
});

test('resolveClientBranding strips Orbe accents while keeping client text', () => {
  const sanitized = resolveClientBranding({
    clientName: 'Museo Norte',
    primaryColor: '#0284c7',
    showPoweredByOrbe360: true,
    metaTitle: 'Museo Norte 360',
    metaDescription: 'Recorrido virtual',
  });
  assert.equal(sanitized.primaryColor, NEUTRAL_BRANDING_FALLBACK.primaryColor);
  assert.equal(sanitized.clientName, 'Museo Norte');

  const fallback = resolveClientBranding(null);
  assert.equal(fallback.primaryColor, NEUTRAL_BRANDING_FALLBACK.primaryColor);
});

test('sanitizeSafeAssetUrl blocks javascript, data:text/html and protocol-relative URLs', () => {
  assert.equal(sanitizeSafeAssetUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
  assert.equal(sanitizeSafeAssetUrl('/media/unisimoncucuta/experienciavirtual/panoramas/a.jpg'), '/media/unisimoncucuta/experienciavirtual/panoramas/a.jpg');
  assert.equal(sanitizeSafeAssetUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeSafeAssetUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeSafeAssetUrl('//evil.example/logo.png'), null);
});

test('isPublicTourViewerPath excludes landing, plataforma, login, and control-web', () => {
  assert.equal(isPublicTourViewerPath('/'), false);
  assert.equal(isPublicTourViewerPath('/plataforma/login.html'), false);
  assert.equal(isPublicTourViewerPath('/unisimoncucuta/experienciavirtual/control-web/'), false);
  assert.equal(isPublicTourViewerPath('/unisimoncucuta/experienciavirtual/'), true);
});

