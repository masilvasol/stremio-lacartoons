'use strict';

/**
 * Cliente para cubeembed.rpmvid.com: descifra la API /api/v1/video
 * y devuelve URLs HLS del episodio.
 */

const axios = require('axios');
const vm = require('vm');
const crypto = require('crypto');
const https = require('https');

const EMBED_ORIGIN = 'https://cubeembed.rpmvid.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

let cryptoCodeCache = null;

async function loadCryptoCode() {
    if (cryptoCodeCache) return cryptoCodeCache;

    try {
        // 1. Cargamos el HTML principal de cubeembed para encontrar el script real del día
        const { data: html } = await axios.get(`${EMBED_ORIGIN}/`, {
            headers: { 'User-Agent': UA },
            timeout: 20000,
        });

        // Buscamos dinámicamente cualquier coincidencia del tipo /assets/index-XXXXXXXX.js
        const scriptMatch = html.match(/src="(\/assets\/index-[a-zA-Z0-9_-]+\.js)"/);
        let currentScriptPath = '/assets/index-C6EWk6HJ.js'; // Fallback por si acaso

        if (scriptMatch && scriptMatch[1]) {
            currentScriptPath = scriptMatch[1];
        }

        const scriptUrl = `${EMBED_ORIGIN}${currentScriptPath}`;

        // 2. Descargamos el script Javascript actual
        const { data: js } = await axios.get(scriptUrl, {
            headers: { 'User-Agent': UA, Referer: `${EMBED_ORIGIN}/` },
            timeout: 20000,
        });

        const saStart = js.indexOf('function sa(){');
        if (saStart === -1) {
            throw new Error('No se encontró el inicio de la función sa() en el Javascript');
        }

        // Buscamos dinámicamente el final de la función constructora que puede variar en número (ej: 880411)
        const regexEnd = /}\)\(sa,\s*\d+\s*\);/;
        const matchEnd = js.slice(saStart).match(regexEnd);

        if (!matchEnd) {
            throw new Error('La estructura de cierre de sa() cambió en el servidor remoto');
        }

        const shuffleEnd = saStart + matchEnd.index + matchEnd[0].length;
        const saExtractedCode = js.slice(saStart, shuffleEnd);

        // 3. Reinyectamos las funciones emulando el comportamiento del reproductor
        cryptoCodeCache = `
${saExtractedCode}
function re(n,e){const t=sa();return re=function(s,i){return s=s-109,t[s]},re(n,e)}
function p(...g){return String.fromCodePoint(...g)}
function v(g,b){return g.codePointAt(b)||0}
function S(g){return new TextEncoder().encode(g)}
T=()=>{const g=re,b=window[g(263)][g(585)],P="10",k=110,U=1;let M="";const B=v("ᵟ")[g(321)]()[g(199)]("");for(let de=0;de<B.length;de++)M+=p(P+B[de]);M+=p(v(b,P/10)),M+=M[g(336)](1,3),M+=p(k,k-1,k+7);const se=g(370)[g(199)]("");return M+=p(se[3]+se[2],se[1]+se[2]),M+=p(se[0]*U+U+se[3],se[0]*U+U+se[3]),M+=p(se[3]*P+se[3]*U,se[g(580)]()[g(364)]("")[g(336)](0,2)),S(M)}
C=()=>{const g=re,b=window[g(263)][g(585)],P=b+"//",k=window.location[g(217)],U=b[g(316)]*P[g(316)],M=1;let B="";for(let me=M;me<10;me++)B+=p(me+U);let se="";se=M+se+M+se+M;const de=se[g(316)]*v(k),Ie=se*M+b.length,I=Ie+4,j=v(b,M),oe=j*M-2;return B+=p(U,se,de,Ie,I,j,oe),S(B)}
`;

        return cryptoCodeCache;

    } catch (error) {
        console.error('[DESOFUSCADOR ERROR]: Error crítico al procesar la crypto de cubeembed:', error.message);
        throw error;
    }
}

function deriveKeyIv(hash) {
    const fnCode = cryptoCodeCache;
    const sandbox = {
        TextEncoder,
        String,
        parseInt,
        window: { location: { protocol: 'https:', hash: '#' + hash } },
    };
    vm.runInNewContext(fnCode, sandbox);
    const key = Buffer.from(vm.runInNewContext(fnCode + '; T()', sandbox));
    const iv = Buffer.from(vm.runInNewContext(fnCode + '; C()', sandbox));
    return { key: key.slice(0, 16), iv: iv.slice(0, 16) };
}

function decryptHex(hex, hash) {
    const { key, iv } = deriveKeyIv(hash);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    const plain = Buffer.concat([
        decipher.update(Buffer.from(hex.trim(), 'hex')),
        decipher.final(),
    ]);
    return JSON.parse(plain.toString('utf8'));
}

/** Extrae el id de video del hash del iframe (#abc123). */
function videoIdFromIframe(iframeSrc) {
    try {
        const u = new URL(iframeSrc);
        if (!/rpmvid\.com$/i.test(u.hostname) && !u.hostname.includes('cubeembed')) return null;

        let id = u.searchParams.get('id');
        if (!id) {
            id = (u.hash || '').replace(/^#/, '');
        }

        if (id && id.includes('&')) id = id.split('&')[0];
        return id && id.length > 1 ? id : null;
    } catch {
        // Fallback por si le pasan una URL con hash crudo o incompleta
        if (typeof iframeSrc === 'string' && iframeSrc.includes('#')) {
            let parts = iframeSrc.split('#')[1];
            if (parts && parts.includes('&')) parts = parts.split('&')[0];
            return parts && parts.length > 1 ? parts : null;
        }
        return null;
    }
}

function isRpmvidIframe(iframeSrc) {
    return /rpmvid\.com/i.test(iframeSrc) || /cubeembed/i.test(iframeSrc);
}


/** Llama a /api/v1/video y devuelve el JSON descifrado. */
async function fetchVideoData(hash) {
    await loadCryptoCode();

    const url = `${EMBED_ORIGIN}/api/v1/video?id=${hash}&w=1280&h=720&r=lacartoons.com`;
    const { data: hex } = await axios.get(url, {
        headers: {
            Referer: `${EMBED_ORIGIN}/`,
            Origin: EMBED_ORIGIN,
            'User-Agent': UA,
        },
        responseType: 'text',
        timeout: 20000,
    });

    if (!/^[0-9a-f]+$/i.test(String(hex).trim())) {
        throw new Error('Respuesta rpmvid no es hex cifrado');
    }

    return decryptHex(hex, hash);
}

/** Recolecta URLs HLS candidatas del payload de la API. */
function collectHlsUrls(data) {
    // Preferir source (IP CDN): en cubeembed el audio suele dar 403 y
    // Stremio Web necesita video+audio demuxados (fMP4).
    const urls = [];
    if (data.source && /\.m3u8/i.test(data.source)) urls.push(data.source);
    if (data.cfNative && /\.m3u8/i.test(data.cfNative)) urls.push(data.cfNative);
    if (data.hlsVideoTiktok) {
        const rel = data.hlsVideoTiktok.startsWith('http')
            ? data.hlsVideoTiktok
            : `${EMBED_ORIGIN}${data.hlsVideoTiktok}`;
        urls.push(rel);
    }
    return [...new Set(urls)];
}

function scoreUrl(url) {
    try {
        const host = new URL(url).hostname;
        if (/rpmvid\.com$/i.test(host)) return 0;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 2;
        return 1;
    } catch {
        return 3;
    }
}

const masterCache = new Map(); // videoId -> { expires, result } | { promise }
const MASTER_TTL_MS = 90 * 1000;

/**
 * Obtiene un master HLS vivo (el token k/kx caduca rapido).
 * Cachea el resultado y deduplica peticiones concurrentes: Stremio Web
 * vuelve a pedir /r/ varias veces y el 2º intento suele caer a IP (rompe Web).
 */
async function resolveLiveMaster(videoId) {
    const hit = masterCache.get(videoId);
    if (hit) {
        if (hit.promise) return hit.promise;
        if (hit.expires > Date.now()) return hit.result;
        masterCache.delete(videoId);
    }

    const promise = resolveLiveMasterUncached(videoId)
        .then(result => {
            masterCache.set(videoId, {
                expires: Date.now() + MASTER_TTL_MS,
                result,
            });
            return result;
        })
        .catch(err => {
            const cur = masterCache.get(videoId);
            if (cur && cur.promise === promise) masterCache.delete(videoId);
            throw err;
        });

    masterCache.set(videoId, { promise });
    return promise;
}

async function resolveLiveMasterUncached(videoId) {
    const data = await fetchVideoData(videoId);
    const candidates = collectHlsUrls(data);
    const errors = [];

    for (const url of candidates) {
        try {
            const opts = {
                headers: rpmvidFetchHeaders(),
                responseType: 'text',
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: () => true,
            };
            const agent = httpsAgentFor(url);
            if (agent) opts.httpsAgent = agent;

            const res = await axios.get(url, opts);
            if (res.status >= 400 || !/#EXTM3U/i.test(String(res.data))) {
                errors.push(`${res.status} ${url.slice(0, 80)}`);
                continue;
            }

            const raw = String(res.data);
            const okChild = await probeFirstVariant(url, raw, opts);
            if (!okChild) {
                errors.push(`child-fail ${url.slice(0, 80)}`);
                continue;
            }

            const playlist = normalizeMasterPlaylist(raw);
            return { url, playlist, title: data.title || null };
        } catch (e) {
            errors.push(`${e.message} ${url.slice(0, 80)}`);
        }
    }

    throw new Error('Ningun master HLS vivo: ' + errors.join(' | '));
}

function rpmvidFetchHeaders() {
    return {
        Referer: `${EMBED_ORIGIN}/`,
        Origin: EMBED_ORIGIN,
        'User-Agent': UA,
        Accept: '*/*',
    };
}

/** Comprueba video + audio espanol del master (Stremio Web necesita ambos). */
async function probeFirstVariant(masterUrl, playlistText, baseOpts) {
    const targets = collectProbeUris(playlistText);
    if (!targets.length) return false;

    for (const uri of targets) {
        const childUrl = new URL(uri, masterUrl).href;
        const opts = Object.assign({}, baseOpts, {
            httpsAgent: httpsAgentFor(childUrl) || baseOpts.httpsAgent,
        });
        const res = await axios.get(childUrl, opts);
        if (res.status >= 400 || !/#EXTM3U/i.test(String(res.data))) {
            return false;
        }
    }
    return true;
}

function collectProbeUris(playlistText) {
    const lines = playlistText.split(/\r?\n/);
    const uris = [];

    for (const line of lines) {
        if (!line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) continue;
        if (!/LANGUAGE="es"|NAME="Espa/i.test(line)) continue;
        const m = line.match(/URI="([^"]+)"/);
        if (m) uris.push(m[1]);
    }

    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
        for (let j = i + 1; j < lines.length; j++) {
            const t = lines[j].trim();
            if (!t || t.startsWith('#')) continue;
            uris.push(t);
            break;
        }
        break;
    }

    return uris;
}

function httpsAgentFor(url) {
    try {
        const host = new URL(url).hostname;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            return insecureHttpsAgent;
        }
    } catch { /* ignore */ }
    return null;
}

/**
 * Stremio Web: una calidad + audio Espanol por defecto.
 * Mantiene el grupo AUDIO (los segmentos de video suelen ir sin pista).
 */
function normalizeMasterPlaylist(text) {
    const lines = text.split(/\r?\n/);
    const head = [];
    const audio = [];
    const variants = [];
    let pendingInf = null;

    for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
            audio.push(fixAudioMediaLine(line));
            continue;
        }
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            pendingInf = line;
            continue;
        }
        if (pendingInf && !line.startsWith('#')) {
            variants.push({ inf: pendingInf, uri: line });
            pendingInf = null;
            continue;
        }
        pendingInf = null;
        if (line.startsWith('#EXTM3U') || line.startsWith('#EXT-X-')) {
            head.push(line);
        }
    }

    // Preferir solo la pista en espanol (menos peticiones en Web).
    const audioOut = audio.filter(l => /LANGUAGE="es"|NAME="Espa/i.test(l));
    const chosenAudio = audioOut.length ? audioOut : audio.slice(0, 1);

    const out = ['#EXTM3U', ...head.filter(l => l !== '#EXTM3U'), ...chosenAudio];
    if (variants.length) {
        out.push(variants[0].inf);
        out.push(variants[0].uri);
    }
    return out.join('\n') + '\n';
}

function fixAudioMediaLine(line) {
    const isEs = /LANGUAGE="es"/i.test(line) || /NAME="Espa/i.test(line);
    let body = line.replace(/^#EXT-X-MEDIA:/i, '');
    body = body
        .replace(/,?AUTOSELECT=(YES|NO)/ig, '')
        .replace(/,?DEFAULT=(YES|NO)/ig, '')
        .replace(/,\s*,+/g, ',')
        .replace(/^,|,$/g, '');
    body += isEs ? ',AUTOSELECT=YES,DEFAULT=YES' : ',AUTOSELECT=NO,DEFAULT=NO';
    return `#EXT-X-MEDIA:${body}`;
}

module.exports = {
    isRpmvidIframe,
    videoIdFromIframe,
    fetchVideoData,
    collectHlsUrls,
    resolveLiveMaster,
    normalizeMasterPlaylist,
    EMBED_ORIGIN,
};
