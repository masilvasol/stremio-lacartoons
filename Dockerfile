FROM node:20-bookworm

# Instalar dependencias del sistema para Playwright
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    libdrm2 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp
RUN apt-get update && apt-get install -y yt-dlp && rm -rf /var/lib/apt/lists/*

# Configurar Playwright
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Directorio de trabajo
WORKDIR /app

# Copiar archivos
COPY package*.json ./
COPY addon.js ./
COPY rpmvid.js ./
COPY mapping.json ./
COPY logo.png ./

# Instalar dependencias de Node
RUN npm install --production

# Instalar Chromium de Playwright
RUN npx playwright install chromium

# Exponer puerto
EXPOSE 10000

# Comando de inicio
CMD ["node", "addon.js"]