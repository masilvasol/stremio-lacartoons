'use strict';

const { test, it, describe, before, mock } = require('node:test');
const { moxios } = require('./mock-axios.js');
const assert = require('node:assert/strict');
const { normalizeMasterPlaylist, resolveLiveMaster, fetchVideoData, videoIdFromIframe, isRpmvidIframe, collectHlsUrls, EMBED_ORIGIN } = require('../rpmvid.js');

describe('normalizeMasterPlaylist', () => {
    let output;
    before(() => {
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
        output = normalizeMasterPlaylist(MASTER);
    });

    it('deja el audio español como predeterminado', () => {
        assert.match(output, /#EXTM3U/);
        assert.match(output, /LANGUAGE="es"/);
        assert.match(output, /AUTOSELECT=YES,DEFAULT=YES/);
        assert.doesNotMatch(output, /LANGUAGE="en"/);
        assert.doesNotMatch(output, /LANGUAGE="pt"/);
    });

    it('conserva solo la primera variante de video', () => {
        assert.equal((output.match(/#EXT-X-STREAM-INF/g) || []).length, 1);
        assert.match(output, /video-720\.m3u8/);
        assert.doesNotMatch(output, /video-1080\.m3u8/);
    });
})

describe('videoIdFromIframe', () => {
    it('devuelve null si el host no es cubeembed o rpmvid', (t) => {
        const res = videoIdFromIframe('https://youtube.com');
        assert.equal(res, null);
    });

    it('extrae la id correctamente', () => {
        const res = videoIdFromIframe('https://cubeembed.rpmvid.com/#fm8vz');
        assert.equal(res, 'fm8vz');
    })
})

test('isRpmvidIframe detecta dominios rpmvid y cubeembed', () => {
    assert.ok(isRpmvidIframe('https://rpmvid.com'));
    assert.ok(isRpmvidIframe('https://cubeembed.com'));
    assert.ok(isRpmvidIframe('https://cubeembed.rpmvid.com'));
    assert.equal(isRpmvidIframe('https://youtube.com'), false);
})

test('collectHlsUrls colecciona y deduplica urls válidas', () => {
    const data = { source: "myvideo.m3u8", cfNative: "myvideo.m3u8", hlsVideoTiktok: "/tiktokvideo.mp4" };
    const res = collectHlsUrls(data);
    assert.deepStrictEqual(res, ["myvideo.m3u8", `${EMBED_ORIGIN}/tiktokvideo.mp4`], "La lista de vídeos no es la esperada");
})

describe('fetchVideoData', { todo: "TODO: arreglar flujo de extracción nativa" }, () => {
    /*fetch = test.mock.fn((input) => {
        return {
            text: () => 'Hello World',
            json: () => { data: "test" }
        };
    });*/
    const axios = require('axios');
    mock.method(axios, 'get', moxios);

    it('no lanza errores con una función sa() presente', async () => {
        assert.doesNotThrow(await fetchVideoData('fm8vz'));
    });
})

describe('resolveLiveMaster', { todo: "TODO: arreglar flujo de extracción nativa" }, () => {
    const axios = require('axios');
    mock.method(axios, 'get', moxios);

    let output;
    before(async () => {
        output = await resolveLiveMaster('fm8vz');
    })

    it('extrae una playlist válida', async () => {
        assert.ok(output.playlist.startsWith('#EXTM3U'), "Playlist resulta con formato incorrecto");
    });

    it('extrae el stream de una URL conocida de cubeembed', async () => {
        assert.ok(output.url.endsWith('.mp4') || output.url.endsWith('.m3u8'));
    });
})
