# Security Policy

## Versiones soportadas

| Versión | Soporte |
| --- | --- |
| `1.0.x` | Sí |
| `< 1.0.0` | No |

## Reportar una vulnerabilidad

No abras un issue público para problemas de seguridad. Usa el reporte privado de GitHub:

<https://github.com/masilvasol/stremio-lacartoons/security/advisories/new>

Incluye, si es posible:

- versión del addon y sistema operativo;
- pasos para reproducir el problema;
- impacto esperado;
- cualquier evidencia o propuesta de corrección.

## Secretos y configuración

- `.env` está ignorado por Git y no debe contener valores reales en el repositorio.
- Usa `.env.example` como plantilla.
- Si una credencial se publicó por error, rótala inmediatamente; borrar el commit no es suficiente.
- En Render, configura `PUBLIC_URL` y las demás variables desde el panel del servicio, no en el código.

## Dependencias

El proyecto ejecuta `npm audit --omit=dev` en CI. Las actualizaciones de dependencias se revisan antes de publicar una release.
