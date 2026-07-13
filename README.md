# 🎬 LACartoons Stremio Addon

Este proyecto es un complemento (addon) de código abierto para [Stremio](https://www.stremio.com/), diseñado para integrar de forma nativa y fluida el catálogo de series y caricaturas clásicas de `lacartoons.com` con audio Español Latino.

---

## ✨ Características

* **Catálogo Completo:** Acceso indexado a series, temporadas y episodios directamente en la interfaz de Stremio.
* **Streaming Optimizado:** Extracción dinámica de enlaces de video (`.m3u8`, `.mp4`) mediante scraping inteligente híbrido.
* **Respaldo con `yt-dlp`:** Uso integrado de herramientas de extracción secundaria para garantizar la estabilidad de los reproductores externos.

---

## 🛠️ Requisitos Previos

Antes de realizar la instalación, asegúrate de contar con los siguientes elementos en tu sistema:
* **Node.js:** Versión 18 o superior recomendada.
* **Git:** Configurado en tu entorno local.
* **Binarios locales:** El ejecutable `yt-dlp.exe` debe estar ubicado en la raíz del proyecto para dar soporte al motor de extracción.

---

## 💻 Instalación y Ejecución Local

Sigue estos pasos desde tu terminal preferida (**PowerShell** o **Bash**) para desplegar el entorno de desarrollo:

### 1. Clonar el repositorio
Navega hasta el directorio donde desees almacenar el proyecto y clona el código fuente:
```powershell
git clone https://github.com
cd stremio-lacartoons
```

### 2. Instalar dependencias y binarios de automatización
Este comando instalará los módulos del framework y ejecutará de forma automatizada la descarga del navegador Chromium headless requerido por el motor de Playwright:
```powershell
npm install
```

### 3. Iniciar el servidor local
Pon en marcha el entorno de desarrollo utilizando el script nativo configurado:
```powershell
npm start
```

Una vez iniciado, el addon expondrá una interfaz local en la dirección:  
`http://127.0.0`

---

## 🎮 Cómo Vincular el Addon en Stremio

1. Mantén la terminal con el comando de ejecución **activa**.
2. Abre la aplicación de **Stremio** en tu computadora o en cualquier dispositivo dentro de tu misma red local.
3. Dirígete a la sección de **Addons** (icono de la pieza de rompecabezas).
4. Pega la URL local `http://127.0.0` en la barra de búsqueda superior.
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