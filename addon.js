'use strict';

/**
 * LACartoons Stremio Addon - v1.0.0
 * Scraper para lacartoons.com con catalogo completo,
 * temporadas multiples, ids de video conformes al protocolo Stremio,
 * y extraccion de video via yt-dlp con headers de Referer para ok.ru.
 */

const express = require('express');
const addon = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const https = require('https');

// Módulo nativo para descifrar cubeembed / rpmvid
const rpmvid = require('./rpmvid.js');

const execAsync = promisify(exec);

// Playwright es opcional: si no esta instalado o los navegadores no se
// descargaron (npx playwright install chromium), el addon sigue funcionando
// normalmente para ok.ru; solo el fallback de hosts desconocidos (ej.
// cubeembed.rpmvid.com) quedara deshabilitado con un aviso claro en consola.
let chromium = null;
try {
    chromium = require('playwright').chromium;
} catch (e) {
    console.warn('[PLAYWRIGHT] No disponible: ' + e.message);
    console.warn('[PLAYWRIGHT] Instala con: npm install playwright && npx playwright install chromium');
}

// ==================== Configuracion ====================
const BASE_URL = 'https://lacartoons.com';
const YT_DLP = path.resolve(__dirname, 'yt-dlp.exe');
const PORT = 7000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

// URL base del addon para reescribir playlists del proxy HLS.
// Por defecto usa localhost; sobreescribible con PUBLIC_URL si se expone
// el addon en otra red (p. ej. IP LAN para TV o movil).
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`)
    .replace(/\/+$/, '');

// Headers que ok.ru / okcdn.ru exige para permitir la reproduccion
const OKRU_HEADERS = {
    'Referer': 'https://ok.ru/',
    'Origin': 'https://ok.ru',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const RPMVID_HEADERS = {
    Referer: 'https://cubeembed.rpmvid.com/',
    Origin: 'https://cubeembed.rpmvid.com',
    'User-Agent': UA,
};

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

// Construye una URL del proxy HLS/MP4. `kind` es 'm3u8', 'ts' o 'mp4'.
// `headers` viaja codificado junto con la URL, para que el proxy pueda
// reenviar exactamente los headers que el host de origen exige (Referer,
// Origin, Cookie, etc.), sin importar de que sitio venga el video.
function proxyUrl(targetUrl, kind, headers) {
    const payload = JSON.stringify({ u: targetUrl, h: headers || {} });
    return `${PUBLIC_URL}/p/${b64urlEncode(payload)}.${kind}`;
}

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

const NETWORK_ENUM = Object.freeze({
    Nickelodeon: 1,
    "Cartoon Network": 2,
    "Fox Kids": 3,
    "Hanna Barbera": 4,
    Disney: 5,
    "Warner Channel": 6,
    Marvel: 7,
    Otros: 8
})

/** Extrae streams HLS de ok.ru via yt-dlp (JSON) y los enruta por el proxy. */
async function extractOkRuStreams(iframeSrc) {
    const { stdout, stderr } = await execAsync(
        `"${YT_DLP}" -J --no-playlist "${iframeSrc}"`,
        { timeout: 30000 }
    );
    if (stderr) console.warn('[YT-DLP WARN]', stderr.slice(0, 200));

    const info = JSON.parse(stdout);
    const seen = new Set();

    const native = (info.formats || [])
        .filter(f => f.protocol === 'm3u8_native' && f.url && f.height)
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .filter(f => {
            if (f.height > 720 || seen.has(`${f.height}n`)) return false;
            seen.add(`${f.height}n`);
            return true;
        })
        .map(f => ({
            name: 'LACartoons',
            title: `${f.height}p`,
            url: f.url,
            behaviorHints: {
                bingeGroup: 'lacartoons-okru-dir',
                notWebReady: true,
                proxyHeaders: {
                    "request": OKRU_HEADERS
                }
            }
        }));

    const proxied = (info.formats || [])
        .filter(f => f.protocol === 'm3u8_native' && f.url && f.height)
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .filter(f => {
            if (f.height > 720 || seen.has(f.height)) return false;
            seen.add(f.height);
            return true;
        })
        .map(f => ({
            name: 'LACartoons (proxy)',
            title: `${f.height}p`,
            // Servimos la lista de reproduccion via nuestro proxy: reescribe
            // los segmentos y añade las cabeceras de ok.ru + CORS, de modo que
            // el stream sea reproducible en cualquier cliente, incluida la web.
            url: proxyUrl(f.url, 'm3u8', OKRU_HEADERS),
            behaviorHints: {
                bingeGroup: 'lacartoons-hls',
            },
        }));

    return native.concat(proxied);
}

/** Extrae IDs de videos de YouTube de las URL y formatea los streams */
async function extractYouTubeStreams(iframeSrc) {
    try {
        const ytURL = new URL(iframeSrc);
        let ytId = ytURL.searchParams.get('v') || ytURL.pathname.split('/').pop();
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

// ==================== Fallback generico via Playwright ====================
// Para hosts que no soporta yt-dlp (ej. cubeembed.rpmvid.com y cualquier otro
// reproductor JS moderno): abrimos la pagina real del capitulo en un
// navegador headless, dejamos que el reproductor cargue, y capturamos la
// primera peticion de red que pida un manifiesto HLS (.m3u8) o un archivo de
// video directo (.mp4). Reutilizamos los headers REALES que el navegador
// envio para esa peticion (Referer/Origin/Cookie), evitando tener que
// adivinar que exige cada CDN.

let browserInstance = null;
async function getBrowser() {
    if (!chromium) throw new Error('Playwright no esta instalado en este entorno.');
    if (!browserInstance) {
        browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        });
    }
    return browserInstance;
}

async function closeBrowser() {
    if (browserInstance) {
        try { await browserInstance.close(); } catch (_) { }
        browserInstance = null;
    }
}

const PLAYWRIGHT_NAV_TIMEOUT = 20000;
const PLAYWRIGHT_WAIT_TIMEOUT = 20000;
const PLAYWRIGHT_FRAME_TIMEOUT = 8000;

// Dominios de publicidad/tracking observados en embeds tipo cubeembed.rpmvid.com.
// Bloquearlos evita que un overlay/interstitial "robe" nuestro clic de play,
// y acelera la carga de la pagina.
const AD_HOST_PATTERNS = [
    /doubleclick\.net/i,
    /googletagmanager\.com/i,
    /analytics\.google\.com/i,
    /google-analytics\.com/i,
    /nr-data\.net/i,
    /protrafficinspector\.com/i,
    /redgarto\.com/i,
];
function isAdRequest(url) {
    if (AD_HOST_PATTERNS.some(p => p.test(url))) return true;
    // Heuristica: redes de popunder/push (dominios de palabras al azar) que
    // siempre traen "key=<hash>" y "uuid=" juntos en la query string.
    if (/[?&]key=[0-9a-f]{16,}/i.test(url) && /[?&]uuid=/i.test(url)) return true;
    return false;
}

// Busca recursivamente, dentro de un JSON ya parseado, el primer string que
// parezca una URL de video (.m3u8 o .mp4). Mucho mas robusto que un regex
// sobre el texto crudo, porque no se confunde con barras escapadas ("\/").
function findMediaUrlInJson(node, depth) {
    if (depth > 6 || node == null) return null;
    if (typeof node === 'string') {
        if (/^https?:\/\//i.test(node) && /\.(m3u8|mp4)(\?|$)/i.test(node)) return node;
        return null;
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            const r = findMediaUrlInJson(item, depth + 1);
            if (r) return r;
        }
        return null;
    }
    if (typeof node === 'object') {
        for (const k of Object.keys(node)) {
            const r = findMediaUrlInJson(node[k], depth + 1);
            if (r) return r;
        }
    }
    return null;
}

async function resolveViaPlaywright(pageUrl, referer) {
    const browser = await getBrowser();
    const contextOpts = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
    };
    if (referer) contextOpts.extraHTTPHeaders = { 'Referer': referer };
    const context = await browser.newContext(contextOpts);

    let found = null;
    const seen = []; // registro de peticiones vistas, para diagnostico si nada coincide

    try {
        const page = await context.newPage();

        // Bloqueamos imagenes/fuentes/css (no afectan la deteccion del video)
        // y ademas los dominios de publicidad/tracking conocidos.
        await page.route('**/*', (route) => {
            const req = route.request();
            const type = req.resourceType();
            const url = req.url();

            // Deteccion PRIMARIA: Si es el manifiesto o video en si, lo guardamos y 
            // lo ABORTAMOS. Esto es CRITICO para que el servidor (RPMVid) no "queme" 
            // el token de un solo uso de la URL. Dejamos que el proxy de Node sea 
            // el que realmente haga la peticion.
            if (/\.m3u8/i.test(url) || /\.mp4/i.test(url)) {
                if (!found) {
                    const safe = pickSafeHeaders(req.headers());
                    found = { url, headers: safe };
                    // Extraemos las cookies reales del contexto, porque req.headers()
                    // en Playwright a menudo omite las cookies computadas o genera basura.
                    context.cookies(url).then(cookies => {
                        if (cookies && cookies.length > 0) {
                            found.headers['cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                        }
                    }).catch(() => { });
                }
                return route.abort(); // ¡No quemar el token!
            }

            if (type === 'image' || type === 'font' || type === 'stylesheet') {
                return route.abort();
            }
            if (isAdRequest(url)) {
                return route.abort();
            }

            // Para request log
            if (['xhr', 'fetch', 'media', 'other'].includes(type) && !url.includes('cdn-cgi')) {
                seen.push(type + ' ' + url.slice(0, 140));
            }

            return route.continue();
        });

        // Deteccion SECUNDARIA por Content-Type real de la respuesta (cubre
        // manifiestos que no traen ".m3u8"/".mp4" visibles en la URL).
        // NOTA: Si llegamos aqui, el token podria quemarse porque ya se recibio 
        // la respuesta, pero es un caso raro de fallback.
        // varios embeds cargan un endpoint JSON propio (ej. /api/v1/info)
        // que trae la URL real del video como dato, ANTES de que el
        // reproductor la llegue a pedir directamente. Si el clic de "play"
        // nunca llega a disparar la peticion del video (por overlays de
        // publicidad, autoplay bloqueado, etc.), esta respuesta JSON ya nos
        // da la URL de todos modos.
        page.on('response', async (res) => {
            try {
                const req = res.request();
                const url = res.url();
                const ct = (res.headers()['content-type'] || '').toLowerCase();
                const rtype = req.resourceType();

                if (!found && (ct.includes('mpegurl') || ct.includes('video/mp4') || ct.includes('video/'))) {
                    const safe = pickSafeHeaders(req.headers());
                    found = { url, headers: safe };
                    context.cookies(url).then(c => {
                        if (c && c.length) found.headers['cookie'] = c.map(x => `${x.name}=${x.value}`).join('; ');
                    }).catch(() => { });
                    return;
                }

                // Cualquier respuesta xhr/fetch del propio embed: la inspeccionamos
                // SIEMPRE (no solo si content-type dice "json"), porque algunos
                // servidores devuelven JSON con un content-type distinto o vacio.
                // Si aun no encontramos el video, imprimimos el cuerpo completo
                // para poder diagnosticar la estructura exacta.
                if (/rpmvid|cubeembed|show-sb/i.test(url) && (rtype === 'fetch' || rtype === 'xhr')) {
                    const text = await res.text().catch(() => '');
                    let mediaUrl = null;
                    try {
                        mediaUrl = findMediaUrlInJson(JSON.parse(text), 0);
                    } catch (_) {
                        const m = text.match(/https?:\/\/[^"'\\\s]+?\.(?:m3u8|mp4)[^"'\\\s]*/i);
                        if (m) mediaUrl = m[0];
                    }
                    if (mediaUrl && !found) {
                        console.log('[PLAYWRIGHT] URL de video encontrada en respuesta de:', url);
                        const safe = pickSafeHeaders(req.headers());
                        found = { url: mediaUrl, headers: safe };
                        context.cookies(mediaUrl).then(c => {
                            if (c && c.length) found.headers['cookie'] = c.map(x => `${x.name}=${x.value}`).join('; ');
                        }).catch(() => { });
                    } else if (!found) {
                        console.log('[PLAYWRIGHT DEBUG] Respuesta de ' + url + ' (content-type: ' + ct + '):');
                        console.log('[PLAYWRIGHT DEBUG] Cuerpo (primeros 2000 caracteres):');
                        console.log(text.slice(0, 2000));
                    }
                }
            } catch (_) { }
        });

        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: PLAYWRIGHT_NAV_TIMEOUT }).catch(() => { });

        // El reproductor de video normalmente vive DENTRO de un iframe
        // (cross-origin, ej. cubeembed.rpmvid.com). Hay que esperar a que
        // ese iframe aparezca y buscar el boton de play AHI, no en la pagina
        // principal de lacartoons.com (que solo tiene el titulo/controles).
        let embedFrame = null;
        const frameWaitStart = Date.now();
        while (!embedFrame && Date.now() - frameWaitStart < PLAYWRIGHT_FRAME_TIMEOUT) {
            const childFrames = page.frames().filter(f => f !== page.mainFrame());
            if (childFrames.length) {
                embedFrame = childFrames.find(f => /cubeembed|rpmvid|ok\.ru|player/i.test(f.url())) || childFrames[0];
                break;
            }
            await page.waitForTimeout(300);
        }

        const targets = embedFrame ? [embedFrame, page] : [page];

        const playSelectors = [
            'button[aria-label*="play" i]',
            'media-play-button',
            '.vds-play-button',
            'button.plyr__control',
            '[data-testid*="play" i]',
            'video',
        ];

        for (const target of targets) {
            if (found) break;
            for (const sel of playSelectors) {
                if (found) break;
                try {
                    const el = await target.$(sel);
                    if (el) {
                        await el.click({ timeout: 1500, force: true }).catch(() => { });
                        await page.waitForTimeout(400);
                    }
                } catch (_) { }
            }
            // Ultimo recurso en este frame: forzar play() por JS.
            if (!found) {
                await target.evaluate(() => {
                    document.querySelectorAll('video').forEach(v => { try { v.play(); } catch (_) { } });
                    const mp = document.querySelector('media-player');
                    if (mp && typeof mp.play === 'function') { try { mp.play(); } catch (_) { } }
                }).catch(() => { });
            }
        }

        const start = Date.now();
        while (!found && Date.now() - start < PLAYWRIGHT_WAIT_TIMEOUT) {
            await page.waitForTimeout(500);
        }

        if (!found && seen.length) {
            console.log('[PLAYWRIGHT DEBUG] Peticiones xhr/fetch/media vistas (sin match):');
            seen.slice(0, 25).forEach(s => console.log('  ' + s));
        }
        if (!found && embedFrame) {
            console.log('[PLAYWRIGHT DEBUG] Iframe del reproductor detectado en:', embedFrame.url());
        } else if (!found) {
            console.log('[PLAYWRIGHT DEBUG] No se detecto ningun iframe de reproductor en la pagina.');
        }
    } finally {
        await context.close().catch(() => { });
    }

    return found;
}

async function extractGenericStreams(pageUrl, referer) {
    const found = await resolveViaPlaywright(pageUrl, referer);
    if (!found) return [];

    const kind = /\.m3u8(\?|$)/i.test(found.url) ? 'm3u8' : 'mp4';

    if (kind === 'mp4') {
        return [{
            name: 'LACartoons',
            title: 'HD',
            url: found.url,
            behaviorHints: {
                bingeGroup: 'lacartoons-mp4',
                notWebReady: true,
                proxyHeaders: {
                    "request": found.headers,
                    "response": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Methods": "GET, OPTIONS"
                    }
                }
            }
        }];
    } else {
        return [{
            name: 'LACartoons (proxy)',
            title: kind === 'm3u8' ? 'HD (auto)' : 'HD',
            url: proxyUrl(found.url, kind, found.headers),
            behaviorHints: {
                bingeGroup: 'lacartoons-generic',
            },
        }];
    }
}

// Hosts de video que buscamos en el iframe
const VIDEO_HOSTS = [
    'ok.ru', 'odnoklassniki', 'vk.com',
    'youtube.com', 'youtu.be',
    'dailymotion.com', 'vimeo.com',
    'streamtape', 'doodstream', 'player'
];

const YT_HOSTS = [
    'youtube.com', 'youtu.be'
];

// ==================== HTTP Client ====================
const HTTP = axios.create({
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': BASE_URL,
    }
});

// ==================== Cache en memoria (TTL = 2 horas) ====================
const CACHE = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

// fetchHTML con reintentos: si el sitio bloquea o falla de forma transitoria
// (403/429/timeout), reintenta hasta 3 veces con backoff antes de fallar.
async function fetchHTML(url, attempt = 1) {
    const now = Date.now();
    if (CACHE.has(url)) {
        const entry = CACHE.get(url);
        if (now - entry.ts < CACHE_TTL) return entry.data;
    }
    try {
        const { data } = await HTTP.get(url);
        CACHE.set(url, { data, ts: now });
        return data;
    } catch (e) {
        const status = e.response ? e.response.status : null;
        const transient = status === 403 || status === 429 || !status;
        if (attempt < 3 && transient) {
            await new Promise(r => setTimeout(r, 800 * attempt));
            return fetchHTML(url, attempt + 1);
        }
        throw e;
    }
}

function processCatalogPage(html, seenIds = new Set()) {
    const metas = [];

    const $ = cheerio.load(html);

    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/serie\/(\d+)$/);
        if (!match) return;

        const numId = match[1];
        if (seenIds.has(numId)) return;
        seenIds.add(numId);

        let poster = $(el).find('img').first().attr('src') || '';
        if (poster && !poster.startsWith('http')) poster = `${BASE_URL}${poster}`;

        let network = $(el).find('span.marcador').first().text().trim() || '';
        let genres, links;
        if (network) {
            genres = [network];
            let networkCat = `stremio:///discover/${encodeURIComponent(`${PUBLIC_URL}/manifest.json`)}/series/lacart_catalogo?genre=${encodeURIComponent(network)}`
            links = [
                { category: "Cadena", name: network, url: networkCat },
                { category: "Genres", name: network, url: networkCat }
            ]
        }

        const name = $(el).find('p.nombre-serie').text().trim() || ('Serie ' + numId);

        if (!name) return;

        metas.push({
            id: 'lacart_' + numId,
            type: 'series',
            name,
            poster: poster || undefined,
            genres: genres || undefined,
            links: links || undefined,
        });
    });
    return metas;
}

// ==================== Pre-carga del catalogo completo ====================
let catalogCache = null;

async function buildFullCatalog() {
    if (catalogCache) return catalogCache;

    const firstHTML = await fetchHTML(`${BASE_URL}/?page=1`);
    const $first = cheerio.load(firstHTML);
    const pageNums = [];
    $first('a[href*="?page="]').each((_, el) => {
        const m = ($first(el).attr('href') || '').match(/\?page=(\d+)/);
        if (m) pageNums.push(parseInt(m[1]));
    });
    const totalPages = pageNums.length ? Math.max(...pageNums) : 1;
    console.log('[CATALOGO] Detectadas ' + totalPages + ' paginas.');

    const allMetas = [];
    const seenIds = new Set();

    allMetas.push(...await processCatalogPage(firstHTML, seenIds)); //procesa firstHTML

    // Concurrencia reducida (3 a la vez) + pequena pausa entre lotes,
    // para no disparar limites anti-bot del sitio durante el arranque.
    for (let i = 1; i < totalPages; i += 3) { //saltamos la primera página que ya procesamos
        const batch = [];
        for (let p = i + 1; p <= Math.min(i + 3, totalPages); p++) {
            batch.push(fetchHTML(`${BASE_URL}/?page=${p}`));
        }
        const pages = await Promise.allSettled(batch);

        for (const result of pages) {
            if (result.status !== 'fulfilled') continue;
            allMetas.push(...await processCatalogPage(result.value, seenIds));
        }

        await new Promise(r => setTimeout(r, 300));
    }

    catalogCache = allMetas;
    console.log('[CATALOGO] ' + allMetas.length + ' series cargadas.');
    return allMetas;
}

async function searchCatalog(searchTerm) {
    searchTerm = searchTerm.trim().replaceAll(" ", "+").replaceAll(encodeURIComponent(" "), "+");

    const firstHTML = await fetchHTML(`${BASE_URL}/?Titulo=${searchTerm}`);

    const matchedMetas = await processCatalogPage(firstHTML);

    console.log('[CATALOGO] ' + matchedMetas.length + ' series encontradas.');
    return matchedMetas;
}

// ==================== Detalle de serie (nombre, poster, episodios) ====================
// Cacheado por separado: meta handler y stream handler comparten esta info,
// asi el stream handler puede resolver "temporada/episodio" -> URL real
// sin tener que re-scrapear todo de nuevo.
const seriesDetailCache = new Map();
const DETAIL_TTL = 2 * 60 * 60 * 1000;

function extractEpisodesFromPage($) {
    const episodes = [];
    const epPerSeason = {};
    let currentSeason = 1;

    // Recorremos en orden DOM: h4 (temporada) y los enlaces de capitulos
    $('h4, a[href*="/capitulo/"]').each((_, el) => {
        const tag = el.name;

        if (tag === 'h4') {
            const text = $(el).text().trim();
            const m = text.match(/[Tt]emporada\s+(\d+)/);
            if (m) currentSeason = parseInt(m[1]);
            return;
        }

        const href = $(el).attr('href') || '';
        if (!href.includes('/capitulo/')) return;

        epPerSeason[currentSeason] = (epPerSeason[currentSeason] || 0) + 1;

        // epPath normalizado (relativo), funciona con href absoluto o relativo
        const epPath = href.startsWith('/') ? href : ('/' + href.split('/').slice(3).join('/'));

        episodes.push({
            season: currentSeason,
            episode: epPerSeason[currentSeason],
            title: $(el).text().trim() || ('Episodio ' + epPerSeason[currentSeason]),
            epPath,
        });
    });

    return episodes;
}

async function getSeriesDetail(numId) {
    const now = Date.now();
    if (seriesDetailCache.has(numId)) {
        const entry = seriesDetailCache.get(numId);
        if (now - entry.ts < DETAIL_TTL) return entry.data;
    }

    const html = await fetchHTML(`${BASE_URL}/serie/${numId}`);
    const $ = cheerio.load(html);

    const name = $('h2').first().text().trim() || ('Serie ' + numId);

    let poster = '';
    $('.imagen-serie > img[src*="active_storage"]').each((_, el) => {
        if (!poster) {
            const src = $(el).attr('src') || '';
            poster = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        }
    });

    let language = $('.contenedor-informacion-serie > .informacion-serie-seccion > p').filter((_, el) => $(el).text().includes('Idioma:')).text().replace("Idioma:", "").trim()

    let background = $('img.fondo-serie-seccion[src*="active_storage"]')?.first()?.attr('src');
    if (background && !background.startsWith('http')) background = `${BASE_URL}${background}`;

    let links = [], genres;
    $('div.series-recomendadas').each((_, el) => {
        const href = $(el).find('a').first().attr('href') || '';
        const match = href?.match(/\/serie\/(\d+)$/);
        if (!match) return;
        const numRel = match[1];
        links.push({
            category: $('h3.subtitulo-linea').filter((_, el) => $(el).text().includes('ecomend')).text().trim() || 'Series recomendadas',
            name: $(el).find('p.nombre-serie').first().text().trim() || ('Serie ' + numRel),
            url: `stremio:///detail/series/lacart_${numRel}`
        })
    })

    let network = $('span.marcador').first().text().trim() || '';
    if (network) {
        genres = [network];
        let networkCat = `stremio:///discover/${encodeURIComponent(`${PUBLIC_URL}/manifest.json`)}/series/lacart_catalogo?genre=${encodeURIComponent(network)}`
        links.push(
            { category: "Cadena", name: network, url: networkCat },
            { category: "Genres", name: network, url: networkCat }
        )
    }

    const description = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .find(t => t.length > 30) || '';

    // Año de la serie, usado para fabricar fechas "released" validas
    // (Stremio exige ISO 8601 en cada video, aunque no sea la fecha real de emision)
    // const bodyText = $('body').text();
    // const yearMatch = bodyText.match(/A[nñ]o:\s*(\d{4})/);
    // const baseYear = yearMatch ? parseInt(yearMatch[1]) : 2000;
    const baseYear = parseInt($('span.marcador-año').first().text().trim()) || 2000;

    const episodes = extractEpisodesFromPage($);

    const detail = { name, poster, background, description, baseYear, episodes, genres, links, language };
    seriesDetailCache.set(numId, { data: detail, ts: now });
    return detail;
}

// ==================== Manifest ====================
const builder = new addon.addonBuilder({
    id: 'org.lacartoons.addon',
    version: '1.0.0',
    name: 'LACartoons',
    description: 'Caricaturas y series animadas clasicas en Espanol Latino - lacartoons.com',
    logo: `https://raw.githubusercontent.com/masilvasol/stremio-lacartoons/refs/heads/main/logo.png`,
    types: ['series'],
    catalogs: [{
        type: 'series',
        id: 'lacart_catalogo',
        name: 'LACartoons',
        extra: [{ name: 'skip', isRequired: false }, { name: 'search', isRequired: false }, { name: 'genre', isRequired: false, options: Object.keys(NETWORK_ENUM) }],
    }],
    resources: ['catalog', 'meta', 'stream'],
    idPrefixes: ['lacart_'],
});

// ==================== 1. CATALOGO ====================
builder.defineCatalogHandler(async ({ extra }) => {
    try {
        if (extra && extra.search) {
            return { metas: await searchCatalog(extra.search) };
        } else {
            const skip = parseInt((extra && extra.skip) || 0);
            const genre = extra?.genre ? decodeURIComponent(extra.genre) : null;
            const PAGE_SIZE = 20;
            const all = await buildFullCatalog().then(list => {
                if (!genre) return list;
                return list.filter(m => m.genres && m.genres.includes(genre));
            });
            return { metas: all.slice(skip, skip + PAGE_SIZE) };
        }
    } catch (e) {
        console.error('[CATALOGO ERROR]', e.message);
        return { metas: [] };
    }
});

// ==================== 2. METADATOS ====================
builder.defineMetaHandler(async ({ id }) => {
    const numId = id.replace('lacart_', '');
    if (!/^\d+$/.test(numId)) return { meta: null };

    try {
        const { name, poster, background, description, baseYear, episodes, genres, links, language } = await getSeriesDetail(numId);

        if (!episodes.length) {
            console.warn('[META] Sin episodios detectados para serie ' + numId);
        }

        // video.id sigue el formato oficial del protocolo Stremio: metaId:temporada:episodio
        // video.released es obligatorio (ISO 8601); fabricamos fechas secuenciales validas
        const videos = episodes.map((ep, idx) => ({
            id: `lacart_${numId}:${ep.season}:${ep.episode}`,
            title: ep.title,
            season: ep.season,
            episode: ep.episode,
            released: new Date(baseYear, 0, 1 + idx).toISOString(),
        }));

        return {
            meta: { id, type: 'series', name, poster, background, description, videos, releaseInfo: `${baseYear}`, released: new Date(baseYear, 0, 1).toISOString(), genres, links, language }
        };
    } catch (e) {
        console.error('[META ERROR]', e.message);
        return { meta: null };
    }
});

// ==================== 3. STREAM ====================
builder.defineStreamHandler(async ({ id }, req) => {
    // Formato esperado: lacart_{numId}:{temporada}:{episodio}
    const m = id.match(/^lacart_(\d+):(\d+):(\d+)$/);
    if (!m) return { streams: [] };

    const numId = m[1];
    const season = parseInt(m[2]);
    const episode = parseInt(m[3]);

    try {
        const { episodes } = await getSeriesDetail(numId);
        const match = episodes.find(e => e.season === season && e.episode === episode);

        if (!match) {
            console.warn(`[STREAM] No se encontro S${season}E${episode} para serie ${numId}`);
            return { streams: [] };
        }

        const epUrl = match.epPath.startsWith('http') ? match.epPath : `${BASE_URL}${match.epPath}`;
        const html = await fetchHTML(epUrl);
        const $ = cheerio.load(html);

        // Buscamos primero un iframe de un host que yt-dlp sabe extraer
        // (ok.ru, camino rapido). Si la pagina no tiene ninguno reconocido
        // (ej. cubeembed.rpmvid.com, o cualquier reproductor JS moderno),
        // caemos al fallback generico via Playwright, navegando DIRECTAMENTE
        // a la URL del embed para evitar problemas con iframes cross-origin.
        let iframeSrc = null;
        let embedSrc = null;
        $('iframe[src]').each((_, el) => {
            const src = $(el).attr('src') || '';
            if (!src) return;
            const fullSrc = src.startsWith('http') ? src : `${BASE_URL}${src}`;
            if (!iframeSrc && VIDEO_HOSTS.some(h => src.includes(h))) {
                iframeSrc = fullSrc;
            }
            // Captura cualquier iframe de embed (cubeembed, rpmvid, etc.)
            // para navegar Playwright directamente a el.
            if (!embedSrc && !src.includes('google') && !src.includes('facebook')) {
                embedSrc = fullSrc;
            }
        });

        // 1. Interceptar si el host es de rpmvid / cubeembed (desofuscador rapido)
        const RPMVID_RE = /(rpmvid\.com|cubeembed)/i;
        const rpmvidTarget = [embedSrc, iframeSrc, epUrl].find(u => u && RPMVID_RE.test(u)) || null;
        const isRpmvid = !!rpmvidTarget;

        if (isRpmvid) {
            const videoId = rpmvid.videoIdFromIframe(rpmvidTarget);
            if (videoId) {
                try {
                    const streamResult = await rpmvid.resolveLiveMaster(videoId);
                    console.log(`[PROCESADOR] Video descifrado con exito: ${streamResult.title || 'OK'}`);

                    return {
                        streams: [{
                                name: 'LACartoons',
                                title: streamResult.title || 'HD',
                                url: streamResult.url,
                                behaviorHints: {
                                    bingeGroup: 'lacartoons-rpmvid-dir',
                                    notWebReady: true,
                                    proxyHeaders: {
                                        "request": RPMVID_HEADERS
                                    }
                                }
                            },
                            {
                                name: 'LACartoons (proxy)',
                                title: streamResult.title || 'HD',
                                url: proxyUrl(streamResult.url, 'm3u8', RPMVID_HEADERS),
                                behaviorHints: { bingeGroup: 'lacartoons-rpmvid' },
                            }
                        ]
                    }
                } catch (err) {
                    console.error('[PROCESADOR ERROR] Fallo descifrado nativo, usando fallback...', err.message);
                }
            }
        }

        // 2. Flujo Alternativo (Si no es rpmvid o si el paso anterior falla)
        if (iframeSrc && !isRpmvid) {
            if (YT_HOSTS.some(h => iframeSrc.includes(h))) {
                console.log('[STREAM] Extrayendo URL de YouTube...');
                const streams = await extractYouTubeStreams(iframeSrc);
                if (streams.length) return { streams };
            } else {
                console.log('[STREAM] Host conocido, usando yt-dlp...');
                const streams = await extractOkRuStreams(iframeSrc);
                if (streams.length) return { streams };
            }
        } else if (!isRpmvid) {
            console.log('[STREAM] Sin host conocido en la pagina, usando fallback Playwright.');
        }


        if (!chromium) {
            console.warn('[STREAM] Playwright no disponible; no se puede resolver este episodio.');
            return { streams: [] };
        }
        // Navegar Playwright directamente a la URL del embed (ej. cubeembed)
        // en vez de la pagina del episodio. Esto convierte las peticiones del
        // reproductor en peticiones del main frame, haciendolas visibles a
        // nuestros interceptores de red (route/request/response).
        const playwrightTarget = embedSrc || epUrl;
        console.log('[STREAM] Playwright target directo:', playwrightTarget);
        const genericStreams = await extractGenericStreams(playwrightTarget, epUrl);
        if (!genericStreams.length) {
            console.warn('[STREAM] Playwright no encontro ninguna peticion de video en:', playwrightTarget);
            return { streams: [] };
        }

        console.log('[STREAM] Stream generico encontrado:', genericStreams[0].url.slice(0, 100));
        return { streams: genericStreams };
    } catch (e) {
        console.error('[STREAM ERROR]', e.message);
        return { streams: [] };
    }
});

// ==================== Servidor ====================
const app = express();

// -------------------- Proxy HLS / MP4 --------------------
// Varios hosts (ok.ru/okcdn.ru, cubeembed.rpmvid.com, etc.) exigen cabeceras
// (Referer/Origin/Cookie) y no envian CORS, por lo que el navegador (Stremio
// Web) no puede reproducir sus streams directamente. Este proxy: (1) descarga
// listas/segmentos/mp4 con las cabeceras correctas para CADA host (viajan
// codificadas junto con la URL), (2) reescribe las URLs internas de las
// listas m3u8 para que tambien pasen por el proxy, (3) añade CORS, y
// (4) reenvia el header Range para permitir salto/seek fluido.

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

// Reescribe una playlist m3u8: cada URI hija se re-enruta por el proxy,
// conservando los mismos headers que se usaron para la playlist padre.
function rewritePlaylist(text, baseUrl, headers) {
    const isMaster = text.includes('#EXT-X-STREAM-INF');
    const childKind = isMaster ? 'm3u8' : 'ts';

    // Extraemos los parametros originales del padre (ej. ?k=... token de auth)
    // porque new URL() desecha los query params del baseUrl al resolver relativas.
    const baseObj = new URL(baseUrl);

    return text.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
            // Reescribe URIs embebidas (p.ej. claves de cifrado EXT-X-KEY).
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
                const absObj = new URL(uri, baseUrl);
                // Heredar tokens (no sobreescribir si el hijo ya trae propios)
                for (const [k, v] of baseObj.searchParams.entries()) {
                    if (!absObj.searchParams.has(k)) absObj.searchParams.set(k, v);
                }
                return `URI="${proxyUrl(absObj.href, 'ts', headers)}"`;
            });
        }

        const absObj = new URL(trimmed, baseUrl);
        for (const [k, v] of baseObj.searchParams.entries()) {
            if (!absObj.searchParams.has(k)) absObj.searchParams.set(k, v);
        }
        return proxyUrl(absObj.href, childKind, headers);
    }).join('\n');
}

app.options('/p/:enc', (req, res) => { setCors(res); res.sendStatus(204); });

app.get('/p/:enc', async (req, res) => {
    const raw = req.params.enc;
    const isPlaylist = raw.endsWith('.m3u8');
    const enc = raw.replace(/\.(m3u8|ts|mp4)$/, '');

    let targetUrl, headers;
    try {
        const payload = JSON.parse(b64urlDecode(enc));
        targetUrl = payload.u;
        headers = payload.h || {};
    } catch {
        return res.status(400).send('bad url');
    }

    try {
        const reqHeaders = Object.assign({}, headers);
        // Reenviamos el Range del cliente (necesario para seek en mp4 directo).
        if (req.headers.range) reqHeaders['Range'] = req.headers.range;
        // Evitamos enviar localhost u headers raros
        delete reqHeaders['host'];
        delete reqHeaders['connection'];

        console.log(`[PROXY] Pidiendo ${isPlaylist ? 'playlist' : 'chunk'} a: ${targetUrl.slice(0, 100)}...`);

        const axiosOpts = {
            headers: reqHeaders,
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: () => true,
        };
        const agent = upstreamAgentFor(targetUrl);
        if (agent) axiosOpts.httpsAgent = agent;

        if (isPlaylist) {
            axiosOpts.responseType = 'text';
        } else {
            axiosOpts.responseType = 'arraybuffer';
        }

        const upstream = await axios.get(targetUrl, axiosOpts);

        if (upstream.status >= 400) {
            console.error(`[PROXY ERROR] Upstream devolvio ${upstream.status} para ${targetUrl.slice(0, 100)}`);
            return res.status(upstream.status).end();
        }

        setCors(res);
        const ct = upstream.headers['content-type'] || '';

        // Reenviar Set-Cookie si el servidor de video lo manda (vital para CDN con tokens)
        const setCookie = upstream.headers['set-cookie'];
        if (setCookie) {
            res.setHeader('Set-Cookie', Array.isArray(setCookie) ? setCookie.join('; ') : setCookie);
        }

        if (isPlaylist || ct.includes('mpegurl')) {
            const text = typeof upstream.data === 'string' ? upstream.data : String(upstream.data);
            const rewritten = rewritePlaylist(text, targetUrl, headers);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewritten);
        }

        // Passthrough de status/headers relevantes para soportar seek (206).
        if (upstream.status === 206) {
            res.status(206);
            const cr = upstream.headers['content-range'];
            if (cr) res.setHeader('Content-Range', cr);
        }
        const ar = upstream.headers['accept-ranges'];
        if (ar) res.setHeader('Accept-Ranges', ar);

        res.setHeader('Content-Type', ct || (raw.endsWith('.mp4') ? 'video/mp4' : 'video/mp2t'));
        let buf = Buffer.from(upstream.data);

        // ===== DE-OFUSCACION DE CHUNKS =====
        // HACK: Hosts como rpmvid/show-sb alojan chunks de video en CDNs de imagenes
        // (ej. tiktokcdn.com) disfrazandolos con cabeceras PNG/JPG falsas. El
        // reproductor web las corta, pero Stremio falla al ver firmas invalidas.
        // Si no es un playlist, buscamos el inicio real del MPEG-TS (firma 0x47
        // repetida cada 188 bytes) y cortamos la basura inicial.
        if (!isPlaylist && !ct.includes('mpegurl') && !raw.endsWith('.mp4') && buf.length > 376) {
            const maxScan = Math.min(1024, buf.length - 189);
            for (let i = 0; i < maxScan; i++) {
                if (buf[i] === 0x47 && buf[i + 188] === 0x47) {
                    if (i > 0) {
                        console.log(`[PROXY] Cortados ${i} bytes de ofuscacion en el chunk.`);
                        buf = buf.subarray(i);
                    }
                    break;
                }
            }
        }

        res.setHeader('Content-Length', buf.length);
        return res.send(buf);
    } catch (e) {
        console.error('[PROXY ERROR]', e.message);
        return res.status(502).end();
    }
});

app.use(addon.getRouter(builder.getInterface()));

app.listen(PORT, () => {
    console.log('');
    console.log('================================================');
    console.log('         LACartoons Addon  v1.0.0');
    console.log('  http://127.0.0.1:' + PORT + '/manifest.json');
    console.log('================================================');
    console.log('');

    buildFullCatalog()
        .then(s => console.log('[OK] Catalogo listo: ' + s.length + ' series disponibles.'))
        .catch(e => console.error('[WARN] Error pre-cargando catalogo:', e.message));
});

// Cierre ordenado: liberar el navegador Playwright si quedo abierto.
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });