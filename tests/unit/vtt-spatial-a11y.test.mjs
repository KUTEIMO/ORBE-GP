import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVtt } from '../../src/vttParser.js';
import { enrichSpatialGraph, pickSpatialTarget, shortestAngleDiff } from '../../src/spatialNav.js';
import {
  evaluateAccessibilityPublishChecklist,
  hasNarrationRef,
  isPlaceholderNarration,
} from '../../src/a11yPublishChecklist.js';

test('parseVtt parses cues with mm:ss.mmm, HH:MM:SS,mmm, sequence numbers and NOTE blocks', () => {
  const sample = [
    'WEBVTT',
    '',
    'NOTE ignore comment',
    '',
    '1',
    '00:00:01.500 --> 00:00:04.250',
    'Bienvenidos al recorrido virtual.',
    '',
    '2',
    '01:02:03,100 --> 01:02:06,000',
    'Segunda línea',
    'multilínea.',
  ].join('\n');

  const cues = parseVtt(sample);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 1.5);
  assert.equal(cues[0].end, 4.25);
  assert.equal(cues[0].text, 'Bienvenidos al recorrido virtual.');
  assert.equal(cues[1].start, 3723.1);
  assert.equal(cues[1].text, 'Segunda línea multilínea.');
});

test('parseVtt returns empty array on null or invalid syntax', () => {
  assert.deepEqual(parseVtt(''), []);
  assert.deepEqual(parseVtt(null), []);
  assert.deepEqual(parseVtt('hello world without timestamps'), []);
});

test('shortestAngleDiff wraps cleanly across [-PI, PI]', () => {
  const diff = shortestAngleDiff(Math.PI - 0.1, -Math.PI + 0.1);
  assert.ok(Math.abs(diff - -0.2) < 1e-6);
});

test('pickSpatialTarget chooses closest cone target and penalizes immediate backtrack', () => {
  const navs = [
    { id: 'back', target: 'prev-scene', yaw: 0.2, pitch: 0, weight: 1.0 },
    { id: 'forward', target: 'next-scene', yaw: 0.25, pitch: 0, weight: 1.0 },
  ];
  const best = pickSpatialTarget(navs, 0.22, 0, 1.05, { previousSceneId: 'prev-scene' });
  assert.equal(best?.target.id, 'forward');

  const outOfCone = pickSpatialTarget([{ id: 'side', target: 's', yaw: Math.PI, pitch: 0, weight: 1 }], 0, 0);
  assert.equal(outOfCone, null);
});

test('enrichSpatialGraph respects autoNeighbors:false without creating phantom links', () => {
  const scenes = [
    {
      id: 'a',
      file: 'R0010001_a.JPG',
      title: 'A',
      hotspots: [{ id: 'h1', type: 'nav', title: 'Go B', yaw: 0, pitch: 0, target: 'b' }],
    },
    { id: 'b', file: 'R0010002_b.JPG', title: 'B', hotspots: [] },
    { id: 'c', file: 'R0010003_c.JPG', title: 'C', hotspots: [] },
  ];
  enrichSpatialGraph(scenes, { autoNeighbors: false });
  assert.equal(scenes[0].navigationHotspots.length, 1);
  assert.equal(scenes[1].navigationHotspots.length, 0);
  assert.equal(scenes[2].navigationHotspots.length, 0);
});

test('a11yPublishChecklist validates placeholder narration, srSummary and optional flags', () => {
  assert.equal(isPlaceholderNarration('assets/audio/placeholder.mp3'), true);
  assert.equal(hasNarrationRef('https://cdn.example.com/audio.mp3'), true);

  const emptyRes = evaluateAccessibilityPublishChecklist({ scenes: [] });
  assert.equal(emptyRes.ready, false);

  const incompleteRes = evaluateAccessibilityPublishChecklist({
    scenes: [
      { id: 's1', title: 'Hall', srSummary: '', narration: null, narrationOptional: false },
    ],
  });
  assert.equal(incompleteRes.ready, false);
  assert.ok(incompleteRes.blockingIssues.length >= 2);

  const validRes = evaluateAccessibilityPublishChecklist({
    scenes: [
      {
        id: 's1',
        title: 'Hall',
        srSummary: 'Acceso principal accesible',
        narration: null,
        narrationOptional: true,
        hotspots: [
          {
            id: 'h-info',
            type: 'info',
            title: 'Placa',
            srSummary: 'Placa informativa',
            narration: 'https://cdn.example.com/h1.mp3',
            transcript: 'https://cdn.example.com/h1.txt',
          },
        ],
      },
    ],
  });
  assert.equal(validRes.ready, true);
  assert.equal(validRes.blockingIssues.length, 0);
});

