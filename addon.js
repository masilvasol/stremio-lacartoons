'use strict';

/**
 * LACartoons Stremio Addon - v1.2.1
 * Scraper para lacartoons.com con catalogo completo,
 * temporadas multiples, ids de video conformes al protocolo Stremio,
 * y extraccion de video via yt-dlp con headers de Referer para ok.ru.
 */

const express  = require('express');
const addon    = require('stremio-addon-sdk');
const axios    = require('axios');
const cheerio  = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const path     = require('path');

const execAsync = promisify(exec);

// ==================== Configuracion ====================
const BASE_URL = 'https://lacartoons.com';
const YT_DLP   = path.resolve(__dirname, 'yt-dlp.exe');
const PORT     = 7000;

// URL base del addon para reescribir playlists del proxy HLS.
// Por defecto usa localhost; sobreescribible con PUBLIC_URL si se expone
// el addon en otra red (p. ej. IP LAN para TV o movil).
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`)
    .replace(/\/+$/, '');

// Headers que ok.ru / okcdn.ru exige para permitir la reproduccion
const OKRU_HEADERS = {
    'Referer'    : 'https://ok.ru/',
    'Origin'     : 'https://ok.ru',
    'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const b64urlEncode = s => Buffer.from(s, 'utf8').toString('base64url');
const b64urlDecode = s => Buffer.from(s, 'base64url').toString('utf8');

// Construye una URL del proxy HLS. `kind` es 'm3u8' (lista) o 'ts' (segmento).
function proxyUrl(targetUrl, kind) {
    return `${PUBLIC_URL}/p/${b64urlEncode(targetUrl)}.${kind}`;
}

const NETWORK_ENUM = Object.freeze({
    Nickelodeon: 1,
    "Cartoon Network": 2,
    "Fox Kids": 3,
    "Hannah Barbera": 4,
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

    return (info.formats || [])
        .filter(f => f.protocol === 'm3u8_native' && f.url && f.height)
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .filter(f => {
            if (f.height > 720 || seen.has(f.height)) return false;
            seen.add(f.height);
            return true;
        })
        .map(f => ({
            name  : 'LACartoons',
            title : `${f.height}p`,
            // Servimos la lista de reproduccion via nuestro proxy: reescribe
            // los segmentos y añade las cabeceras de ok.ru + CORS, de modo que
            // el stream sea reproducible en cualquier cliente, incluida la web.
            url   : proxyUrl(f.url, 'm3u8'),
            behaviorHints: {
                bingeGroup: 'lacartoons-hls',
            },
        }));
}

// Hosts de video que buscamos en el iframe
const VIDEO_HOSTS = [
    'ok.ru', 'odnoklassniki', 'vk.com',
    'youtube.com', 'youtu.be',
    'dailymotion.com', 'vimeo.com',
    'streamtape', 'doodstream', 'player'
];

// ==================== HTTP Client ====================
const HTTP = axios.create({
    timeout: 20000,
    headers: {
        'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language' : 'es-ES,es;q=0.9,en;q=0.8',
        'Referer'         : BASE_URL,
    }
});

// ==================== Cache en memoria (TTL = 2 horas) ====================
const CACHE     = new Map();
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

// ==================== Pre-carga del catalogo completo ====================
let catalogCache = null;

async function buildFullCatalog() {
    if (catalogCache) return catalogCache;

    const firstHTML  = await fetchHTML(`${BASE_URL}/?page=1`);
    const $first     = cheerio.load(firstHTML);
    const pageNums   = [];
    $first('a[href*="?page="]').each((_, el) => {
        const m = ($first(el).attr('href') || '').match(/\?page=(\d+)/);
        if (m) pageNums.push(parseInt(m[1]));
    });
    const totalPages = pageNums.length ? Math.max(...pageNums) : 1;
    console.log('[CATALOGO] Detectadas ' + totalPages + ' paginas.');

    const allMetas = [];
    const seenIds  = new Set();

    // Concurrencia reducida (3 a la vez) + pequena pausa entre lotes,
    // para no disparar limites anti-bot del sitio durante el arranque.
    for (let i = 0; i < totalPages; i += 3) {
        const batch = [];
        for (let p = i + 1; p <= Math.min(i + 3, totalPages); p++) {
            batch.push(fetchHTML(`${BASE_URL}/?page=${p}`));
        }
        const pages = await Promise.allSettled(batch);

        for (const result of pages) {
            if (result.status !== 'fulfilled') continue;
            const $ = cheerio.load(result.value);

            $('a[href]').each((_, el) => {
                const href  = $(el).attr('href') || '';
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
                        {category: "Cadena", name: network, url: networkCat},
                        {category: "Genres", name: network, url: networkCat}
                    ]
                }

                const name = $(el).find('p.nombre-serie').text().trim() || ('Serie ' + numId);

                if (!name) return;

                allMetas.push({
                    id     : 'lacart_' + numId,
                    type   : 'series',
                    name,
                    poster : poster || undefined,
                    genres,
                    links
                });
            });
        }

        await new Promise(r => setTimeout(r, 300));
    }

    catalogCache = allMetas;
    console.log('[CATALOGO] ' + allMetas.length + ' series cargadas.');
    return allMetas;
}

// ==================== Detalle de serie (nombre, poster, episodios) ====================
// Cacheado por separado: meta handler y stream handler comparten esta info,
// asi el stream handler puede resolver "temporada/episodio" -> URL real
// sin tener que re-scrapear todo de nuevo.
const seriesDetailCache = new Map();
const DETAIL_TTL = 2 * 60 * 60 * 1000;

function extractEpisodesFromPage($) {
    const episodes      = [];
    const epPerSeason   = {};
    let   currentSeason = 1;

    // Recorremos en orden DOM: h4 (temporada) y los enlaces de capitulos
    $('h4, a[href*="/capitulo/"]').each((_, el) => {
        const tag = el.name;

        if (tag === 'h4') {
            const text = $(el).text().trim();
            const m    = text.match(/[Tt]emporada\s+(\d+)/);
            if (m) currentSeason = parseInt(m[1]);
            return;
        }

        const href = $(el).attr('href') || '';
        if (!href.includes('/capitulo/')) return;

        epPerSeason[currentSeason] = (epPerSeason[currentSeason] || 0) + 1;

        // epPath normalizado (relativo), funciona con href absoluto o relativo
        const epPath = href.startsWith('/') ? href : ('/' + href.split('/').slice(3).join('/'));

        episodes.push({
            season  : currentSeason,
            episode : epPerSeason[currentSeason],
            title   : $(el).text().trim() || ('Episodio ' + epPerSeason[currentSeason]),
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
    const $    = cheerio.load(html);

    const name = $('h2').first().text().trim() || ('Serie ' + numId);

    let poster = '';
    $('img[src*="active_storage"]').each((_, el) => {
        if (!poster) {
            const src = $(el).attr('src') || '';
            poster = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        }
    });

    const description = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .find(t => t.length > 30) || '';

    // Ano de la serie, usado solo para fabricar fechas "released" validas
    // (Stremio exige ISO 8601 en cada video, aunque no sea la fecha real de emision)
    const bodyText  = $('body').text();
    const yearMatch = bodyText.match(/A[nñ]o:\s*(\d{4})/);
    const baseYear  = yearMatch ? parseInt(yearMatch[1]) : 2000;

    const episodes = extractEpisodesFromPage($);

    const detail = { name, poster, description, baseYear, episodes };
    seriesDetailCache.set(numId, { data: detail, ts: now });
    return detail;
}

// ==================== Manifest ====================
const builder = new addon.addonBuilder({
    id          : 'org.lacartoons.addon',
    version     : '1.2.0',
    name        : 'LACartoons',
    description : 'Caricaturas y series animadas clasicas en Espanol Latino - lacartoons.com',
    logo        : `https://raw.githubusercontent.com/masilvasol/stremio-lacartoons/refs/heads/main/logo.png`,
    types       : ['series'],
    catalogs    : [{
        type  : 'series',
        id    : 'lacart_catalogo',
        name  : 'LACartoons',
        extra : [{ name: 'skip', isRequired: false }, { name: 'genre', isRequired: false, options: Object.keys(NETWORK_ENUM) }],
    }],
    resources   : ['catalog', 'meta', 'stream'],
    idPrefixes  : ['lacart_'],
});

// ==================== 1. CATALOGO ====================
builder.defineCatalogHandler(async ({ extra }) => {
    try {
        const skip      = parseInt((extra && extra.skip) || 0);
        const genre     = extra?.genre ? decodeURIComponent(extra.genre) : null;
        const PAGE_SIZE = 20;
        const all       = await buildFullCatalog().then(list => {
            if (!genre) return list;
            return list.filter(m => m.genres && m.genres.includes(genre));
        });
        return { metas: all.slice(skip, skip + PAGE_SIZE) };
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
        const { name, poster, description, baseYear, episodes } = await getSeriesDetail(numId);

        if (!episodes.length) {
            console.warn('[META] Sin episodios detectados para serie ' + numId);
        }

        // video.id sigue el formato oficial del protocolo Stremio: metaId:temporada:episodio
        // video.released es obligatorio (ISO 8601); fabricamos fechas secuenciales validas
        const videos = episodes.map((ep, idx) => ({
            id       : `lacart_${numId}:${ep.season}:${ep.episode}`,
            title    : ep.title,
            season   : ep.season,
            episode  : ep.episode,
            released : new Date(baseYear, 0, 1 + idx).toISOString(),
        }));

        return {
            meta: { id, type: 'series', name, poster, description, videos }
        };
    } catch (e) {
        console.error('[META ERROR]', e.message);
        return { meta: null };
    }
});

// ==================== 3. STREAM ====================
builder.defineStreamHandler(async ({ id }) => {
    // Formato esperado: lacart_{numId}:{temporada}:{episodio}
    const m = id.match(/^lacart_(\d+):(\d+):(\d+)$/);
    if (!m) return { streams: [] };

    const numId  = m[1];
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
        const html  = await fetchHTML(epUrl);
        const $     = cheerio.load(html);

        let iframeSrc = null;
        $('iframe[src]').each((_, el) => {
            if (iframeSrc) return;
            const src = $(el).attr('src') || '';
            if (VIDEO_HOSTS.some(h => src.includes(h))) {
                iframeSrc = src.startsWith('http') ? src : `${BASE_URL}${src}`;
            }
        });

        if (!iframeSrc) {
            console.warn('[STREAM] No se encontro iframe en:', epUrl);
            return { streams: [] };
        }

        console.log('[STREAM] Extrayendo URL de:', iframeSrc);

        const streams = await extractOkRuStreams(iframeSrc);
        if (!streams.length) {
            console.warn('[STREAM] yt-dlp no devolvio streams HLS.');
            return { streams: [] };
        }

        console.log('[STREAM] Streams HLS:', streams.map(s => s.title).join(', '));
        return { streams };
    } catch (e) {
        console.error('[STREAM ERROR]', e.message);
        return { streams: [] };
    }
});

// ==================== Servidor ====================
const app = express();

// -------------------- Proxy HLS --------------------
// ok.ru/okcdn.ru exige cabeceras (Referer/Origin) y no envia CORS, por lo que
// el navegador (Stremio Web) no puede reproducir sus streams directamente.
// Este proxy: (1) descarga listas y segmentos con las cabeceras correctas,
// (2) reescribe las URLs internas para que pasen tambien por el proxy, y
// (3) añade cabeceras CORS. Asi el stream funciona en PC, TV, movil y web.

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

// Reescribe una playlist m3u8: cada URI hija se re-enruta por el proxy.
function rewritePlaylist(text, baseUrl) {
    const isMaster = text.includes('#EXT-X-STREAM-INF');
    const childKind = isMaster ? 'm3u8' : 'ts';

    return text.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
            // Reescribe URIs embebidas (p.ej. claves de cifrado EXT-X-KEY).
            return line.replace(/URI="([^"]+)"/g, (_, uri) => {
                const abs = new URL(uri, baseUrl).href;
                return `URI="${proxyUrl(abs, 'ts')}"`;
            });
        }

        const abs = new URL(trimmed, baseUrl).href;
        return proxyUrl(abs, childKind);
    }).join('\n');
}

app.options('/p/:enc', (req, res) => { setCors(res); res.sendStatus(204); });

app.get('/p/:enc', async (req, res) => {
    const raw = req.params.enc;
    const isPlaylist = raw.endsWith('.m3u8');
    const enc = raw.replace(/\.(m3u8|ts)$/, '');

    let targetUrl;
    try {
        targetUrl = b64urlDecode(enc);
    } catch {
        return res.status(400).send('bad url');
    }

    try {
        const upstream = await axios.get(targetUrl, {
            headers: OKRU_HEADERS,
            responseType: 'arraybuffer',
            timeout: 20000,
            maxRedirects: 5,
            validateStatus: () => true,
        });

        if (upstream.status >= 400) {
            return res.status(upstream.status).end();
        }

        setCors(res);
        const ct = upstream.headers['content-type'] || '';

        if (isPlaylist || ct.includes('mpegurl')) {
            const body = Buffer.from(upstream.data).toString('utf8');
            const rewritten = rewritePlaylist(body, targetUrl);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewritten);
        }

        res.setHeader('Content-Type', ct || 'video/mp2t');
        return res.send(Buffer.from(upstream.data));
    } catch (e) {
        console.error('[PROXY ERROR]', e.message);
        return res.status(502).end();
    }
});

app.use(addon.getRouter(builder.getInterface()));

app.listen(PORT, () => {
    console.log('');
    console.log('================================================');
    console.log('         LACartoons Addon  v1.2.1');
    console.log('  http://127.0.0.1:' + PORT + '/manifest.json');
    console.log('================================================');
    console.log('');

    buildFullCatalog()
        .then(s => console.log('[OK] Catalogo listo: ' + s.length + ' series disponibles.'))
        .catch(e => console.error('[WARN] Error pre-cargando catalogo:', e.message));
});