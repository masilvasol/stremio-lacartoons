'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mapping = require('../mapping.json');

const entries = mapping.mappings || mapping;

test('mapping.json contiene equivalencias validas', () => {
    const keys = Object.keys(entries);
    assert.ok(keys.length > 0, 'mapping.json no debe estar vacio');

    for (const key of keys) {
        assert.match(key, /^lc_\d+$/, `clave invalida: ${key}`);
        const item = entries[key];
        assert.ok(item && (item.imdb || item.tmdb), `entrada sin IMDb/TMDB: ${key}`);
    }
});
