'use strict';

const { test, it, describe, before, mock } = require('node:test');
const assert = require('node:assert/strict');
const { b64urlEncode, b64urlDecode, pickSafeHeaders, extractYouTubeStreams } = require('../utils.js');

describe('base64', () => {
  it('encode tras decode es la misma cadena', () => {
    const input = 'test string wow';
    const output = b64urlDecode(b64urlEncode(input));
    assert.deepStrictEqual(input, output);
  });
})

test('pickSafeHeaders elimina headers indeseados y/o que comienzan con :', () => {
  const output = pickSafeHeaders({
    'Host': 'Debería desaparecer',
    'Connection': 'Debería desaparecer',
    "User-Agent": "Debería mantenerse",
    'Content-Length': 'Debería desaparecer',
    'Accept-Encoding': 'Debería desaparecer',
    'Upgrade-Insecure-Requests': 'Debería desaparecer',
    ":Bad header": 'Debería desaparecer'
  });
  assert.deepStrictEqual({ "User-Agent": "Debería mantenerse" }, output);
})

test('extractYouTubeStreams extracts correct streams', () => {
  const streams = extractYouTubeStreams('https://youtu.be/2qgxAHW1w78?mockParam=2');
  streams.concat(extractYouTubeStreams('https://www.youtube.com/watch?v=2qgxAHW1w78'));
  for (const stream of streams) {
    assert.deepStrictEqual(stream.ytId, '2qgxAHW1w78');
  }
})
