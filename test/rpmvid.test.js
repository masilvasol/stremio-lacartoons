'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMasterPlaylist } = require('../rpmvid.js');

const MASTER = [
    '#EXTM3U',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="English",LANGUAGE="en",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="audio-en.m3u8"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Portugues",LANGUAGE="pt",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="audio-pt.m3u8"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio0",NAME="Espanol",LANGUAGE="es",AUTOSELECT=NO,DEFAULT=NO,CHANNELS="2",URI="audio-es.m3u8"',
    '#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=1000000,RESOLUTION=1280x720,CODECS="avc1.4d4028,mp4a.40.2",AUDIO="audio0"',
    'video-720.m3u8',
    '#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=2500000,RESOLUTION=1920x1080,CODECS="avc1.640029,mp4a.40.2",AUDIO="audio0"',
    'video-1080.m3u8',
].join('\n');

test('normalizeMasterPlaylist deja el audio espanol como predeterminado', () => {
    const output = normalizeMasterPlaylist(MASTER);

    assert.match(output, /#EXTM3U/);
    assert.match(output, /LANGUAGE="es"/);
    assert.match(output, /AUTOSELECT=YES,DEFAULT=YES/);
    assert.doesNotMatch(output, /LANGUAGE="en"/);
    assert.doesNotMatch(output, /LANGUAGE="pt"/);
});

test('normalizeMasterPlaylist conserva solo la primera variante de video', () => {
    const output = normalizeMasterPlaylist(MASTER);

    assert.equal((output.match(/#EXT-X-STREAM-INF/g) || []).length, 1);
    assert.match(output, /video-720\.m3u8/);
    assert.doesNotMatch(output, /video-1080\.m3u8/);
});
