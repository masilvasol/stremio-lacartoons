const https = require('https');

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function upstreamAgentFor(url) {
    try {
        const host = new URL(url).hostname;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return insecureHttpsAgent;
    } catch { /* ignore */ }
    return undefined;
}

const b64urlEncode = s => Buffer.from(s, 'utf8').toString('base64url');
const b64urlDecode = s => Buffer.from(s, 'base64url').toString('utf8');

// Capturamos todos los headers que el navegador real envio, excepto los que
// rompen la peticion (pseudo-headers HTTP/2 ocultos) o los que Node fetch 
// gestiona por su cuenta (encoding, host, connection).
function pickSafeHeaders(rawHeaders) {
    const exclude = ['host', 'connection', 'content-length', 'accept-encoding', 'upgrade-insecure-requests'];
    const out = {};
    for (const k of Object.keys(rawHeaders || {})) {
        const lower = k.toLowerCase();
        if (lower.startsWith(':') || exclude.includes(lower)) continue;
        out[k] = rawHeaders[k];
    }
    return out;
}

/** Extrae IDs de videos de YouTube de las URL y formatea los streams */
function extractYouTubeStreams(iframeSrc) {
    try {
        const ytURL = new URL(iframeSrc);
        let ytId = ytURL.searchParams.get('v') || ytURL.pathname.split('/').pop().substring(0, 11);
        return [{
            name: 'LACartoons',
            title: 'YouTube',
            ytId,
            behaviorHints: {
                bingeGroup: 'lacartoons-yt',
            },
        }]
    } catch (e) {
        console.warn('[STREAM] URL de YouTube invalida:', iframeSrc);
        return []
    }
}

module.exports = {
  upstreamAgentFor,
  b64urlEncode,
  b64urlDecode,
  pickSafeHeaders,
  extractYouTubeStreams
};