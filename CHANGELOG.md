# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.

## [1.0.1] - 2026-10-19

### Corregido

- Restaurada la selección de audio en masters HLS de `cubeembed.rpmvid.com`: la pista española queda como `DEFAULT=YES` y `AUTOSELECT=YES` también cuando se usa el fallback de Playwright (#20).
- El proxy ya no reenvía `Content-Type: image/png` para segmentos MPEG-TS; ahora detecta MPEG-TS y fMP4 por sus bytes reales y evita aplicar la de-ofuscación a fMP4.

### Seguridad

- Actualizados `axios` a `1.20.0`, `proxy-addr` a `2.0.8` y `undici` a `7.30.1`.
- Añadidos overrides para `path-to-regexp` y `tmp`; `npm audit --omit=dev` queda sin vulnerabilidades conocidas.

### Documentación

- Añadido el enlace a la instancia pública y el enlace de instalación en Stremio (#25).
- Corregidas las instrucciones de clonado, URL local y variables de entorno.
- Añadidos `SECURITY.md`, `CONTRIBUTING.md`, `.env.example`, `.dockerignore` y CI.

## [1.0.0]

Primera release pública del addon.
