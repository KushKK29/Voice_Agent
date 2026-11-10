import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from './ip.js';

const req = (xff, addr = '10.0.0.1') => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: addr } });

test('without TRUST_PROXY the socket address is used and the header is ignored (cannot be spoofed)', () => {
  assert.equal(clientIp(req('1.2.3.4'), false), '10.0.0.1');
});

test('behind a trusted proxy the last forwarded address is used, so a client-supplied prefix cannot spoof it', () => {
  assert.equal(clientIp(req('9.9.9.9, 1.2.3.4'), true), '1.2.3.4');
  assert.equal(clientIp(req('1.2.3.4'), true), '1.2.3.4');
});

test('trusted proxy but no header falls back to the socket address', () => {
  assert.equal(clientIp(req(undefined), true), '10.0.0.1');
});
