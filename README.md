# 🎬 LACartoons Stremio Addon

Este proyecto es un complemento (addon) de código abierto para [Stremio](https://www.stremio.com/), diseñado para integrar de forma nativa y fluida el catálogo de series y caricaturas clásicas de `lacartoons.com` con audio Español Latino.

---

## 🌐 Instancia Pública

Puedes usar la instancia oficial sin instalar nada:

- **Manifest:** <https://stremio-lacartoons-h7ha.onrender.com/manifest.json>
- **Instalar en Stremio:** <stremio:///addons/install?manifestUrl=https%3A%2F%2Fstremio-lacartoons-h7ha.onrender.com%2Fmanifest.json>

> La instancia gratuita de Render puede tardar unos segundos en despertar tras un periodo de inactividad. Si no responde, usa la instalación local de más abajo.

---

## ✨ Características

* **Catálogo Completo:** Acceso indexado a series, temporadas y episodios directamente en la interfaz de Stremio.
* **Streaming Optimizado:** Extracción dinámica de enlaces de video (`.m3u8`, `.mp4`) mediante scraping inteligente híbrido.
* **Respaldo con `yt-dlp`:** Uso integrado de herramientas de extracción secundaria para garantizar la estabilidad de los reproductores externos.

---
### 🚀 Mejoras Recientes y Estado del Proyecto

Este addon se actualiza constantemente para mejorar la estabilidad, seguridad y experiencia de usuario. Las últimas incorporaciones incluyen:

| Área | Mejora Implementada | Impacto para el Usuario |
| :--- | :--- | :--- |
| **🛡️ Seguridad** | Parche **CVE-2024-45296** (`path-to-regexp`) | Protege el servidor de ataques de denegación de servicio (ReDoS). |
| **💻 Multiplataforma** | Soporte nativo para **Linux y macOS** | Binarios `yt-dlp` incluidos para todos los sistemas operativos (PR #22). |
| **🎬 Calidad de Video** | Soporte para **HLS nativo** y corrección de Stremio Web | Reproducción fluida en navegadores y resolución óptima (PR #15, #19). |
| **🔊 Audio** | Pista española marcada como predeterminada en masters HLS | Evita episodios que se reproducen sin sonido en Stremio (#20). |
| **🔍 Catálogo** | Filtros por género, cadena y sección "Recomendadas" | Búsqueda más precisa y descubrimiento de contenido (PR #11, #13). |
| **⚙️ Estabilidad** | Actualización a **Node.js 20** y Docker | Mayor rendimiento del servidor y compatibilidad con entornos modernos. |
| **🔗 Enlaces** | Uso de enlaces nativos de YouTube (sin proxy) | Carga más rápida y menor latencia en videos de YouTube (PR #7). |

> **Nota de Seguridad:** La actualización de `path-to-regexp` fue aplicada automáticamente por herramientas de seguridad IA y verificada manualmente para garantizar la compatibilidad con todas las rutas del addon.

---
## 🛠️ Requisitos Previos

Antes de realizar la instalación, asegúrate de contar con los siguientes elementos en tu sistema:
* **Node.js:** Versión 20 o superior.
* **Git:** Configurado en tu entorno local.
* **Binarios locales:** Los ejecutables `yt-dlp.exe` (Windows), `yt-dlp_linux` (Linux) o `yt-dlp_macos` (macOS) ya están incluidos en el repositorio.

---

## 💻 Instalación y Ejecución Local

Sigue estos pasos desde tu terminal preferida (**PowerShell** o **Bash**) para desplegar el entorno de desarrollo:

### 1. Clonar el repositorio
Navega hasta el directorio donde desees almacenar el proyecto y clona el código fuente:
```powershell
git clone https://github.com/masilvasol/stremio-lacartoons.git
cd stremio-lacartoons
```

### 2. Instalar dependencias y Chromium
El proyecto usa `npm ci` para respetar exactamente el `package-lock.json`. Después instala el navegador headless que necesita el fallback de Playwright:
```powershell
npm ci
npx playwright install chromium
```

### 3. Iniciar el servidor local
Pon en marcha el entorno de desarrollo utilizando el script nativo configurado:
```powershell
npm start
```

Si necesitas que los enlaces del proxy usen otra URL (por ejemplo, una IP de tu red local o un dominio público), define `PUBLIC_URL` antes de arrancar:
```powershell
$env:PUBLIC_URL = 'http://192.168.1.50:7000'
npm start
```

Una vez iniciado, el addon expondrá una interfaz local en la dirección:  
`http://127.0.0.1:7000/manifest.json`

El archivo `.env.example` documenta las variables disponibles (`PORT`, `PUBLIC_URL`, `BASE_URL`, `YT_DLP_PATH`). El addon no carga `.env` automáticamente; define esas variables en tu shell, en Docker o en el panel de Render.

---

## 🎮 Cómo Vincular el Addon en Stremio

1. Mantén la terminal con el comando de ejecución **activa**.
2. Abre la aplicación de **Stremio** en tu computadora o en cualquier dispositivo dentro de tu misma red local.
3. Dirígete a la sección de **Addons** (icono de la pieza de rompecabezas).
4. Pega la URL local `http://127.0.0.1:7000/manifest.json` en la barra de búsqueda superior.
5. Haz clic en el botón verde **Instalar**.

---

## 🤝 ¿Cómo colaborar?

¡Cualquier aporte para optimizar los selectores de scraping o la estabilidad del flujo de video es totalmente bienvenido!

1. Haz un **Fork** de este repositorio.
2. Crea una rama con tu nueva funcionalidad o corrección:
   ```bash
   git checkout -b feature/nueva-mejora
   ```
3. Registra tus cambios con un mensaje descriptivo:
   ```bash
   git commit -m 'feat: optimizar extractor de enlaces de video'
   ```
4. Sube la rama a tu repositorio remoto:
   ```bash
   git push origin feature/nueva-mejora
   ```
5. Abre un **Pull Request** detallando tus modificaciones.

---

## 📄 Licencia

Este proyecto se distribuye bajo la **Licencia MIT**. Consulta el archivo `LICENSE` para obtener más detalles.
