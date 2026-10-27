'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../mapping.json');

const entries = mapping.mappings || mapping;

test('mapping.json contiene equivalencias válidas', () => {
    const keys = Object.keys(entries);
    assert.ok(keys.length > 0, 'mapping.json no debe estar vacío');

    for (const key of keys) {
        assert.match(key, /^lc_\d+$/, `clave inválida: ${key}`);
        const item = entries[key];
        assert.ok(item && (item.imdb || item.tmdb), `entrada sin IMDb/TMDB: ${key}`);
    }
});
