import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeworkVisualSignals } from './homework-visual-signal-service.js';

const pngBase64 = (width: number, height: number) => {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes.toString('base64');
};

test('buildHomeworkVisualSignals extracts long-page layout from PNG metadata', () => {
  const signals = buildHomeworkVisualSignals({
    imageBase64: pngBase64(900, 2400),
    mimeType: 'image/png',
  });

  assert.equal(signals[0]?.kind, 'image-format');
  assert.ok(signals.some((signal) => signal.kind === 'page-shape' && signal.label === '长截图作业页'));
  assert.ok(signals.some((signal) => signal.evidence.some((item) => item.includes('900x2400'))));
});

test('buildHomeworkVisualSignals flags unreadable tiny payloads without throwing', () => {
  const signals = buildHomeworkVisualSignals({
    imageBase64: 'abc123',
    mimeType: 'image/jpeg',
  });

  assert.ok(signals.some((signal) => signal.kind === 'capture-risk' && signal.severity === 'risk'));
});
