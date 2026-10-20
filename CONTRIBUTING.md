# Contribuir

Gracias por ayudar a mantener LACartoons. Antes de abrir un Pull Request:

1. Crea una rama descriptiva desde `main`:
   ```bash
   git switch -c fix/descripcion-corta
   ```
2. Instala dependencias y Chromium:
   ```bash
   npm ci
   npx playwright install chromium
   ```
3. Ejecuta las comprobaciones:
   ```bash
   npm run check
   npm test
   ```
4. Si cambias el proxy HLS o la extracción de video, prueba al menos:
   - un episodio de ok.ru;
   - un episodio de `cubeembed.rpmvid.com` con audio español;
   - los endpoints `manifest.json`, `catalog`, `meta` y `stream`.

## Reglas del repositorio

- No subir `.env`, tokens, cookies ni claves de API.
- No mover ni borrar tags publicados (`v1.0.0` debe permanecer intacto).
- No reescribir `main` ni hacer force-push.
- Mantener los binarios `yt-dlp` actualizados solo mediante un PR explícito.
- Un cambio de comportamiento debe incluir una entrada en `CHANGELOG.md`.

## Commits

Usa mensajes claros, por ejemplo:

```text
fix: restaurar la pista de audio HLS (#20)
docs: agregar enlace a la instancia pública (#25)
chore: anadir CI y plantillas de repositorio
```

## Releases

1. Actualizar la versión en `package.json` y `CHANGELOG.md`.
2. Ejecutar `npm ci`, `npm run check`, `npm test` y el smoke test manual.
3. Abrir y revisar el PR.
4. Crear un tag anotado nuevo, por ejemplo `v1.0.1`; nunca reutilizar `v1.0.0`.
5. Publicar la release con notas basadas en `CHANGELOG.md`.
6. Desplegar con `PUBLIC_URL` configurado y verificar el manifest público.
