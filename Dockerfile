FROM node:20-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-core \
    fontconfig \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -fv

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && \
    node -e "const fs=require('fs'),f='node_modules/haxball.js/src/index.js',c=fs.readFileSync(f,'utf8').replace('new HttpsProxyAgent(url.parse(k(\"proxy\", null)))','new HttpsProxyAgent(k(\"proxy\", null))');fs.writeFileSync(f,c);console.log('[patch] haxball.js proxy fix applied');"

COPY . .

CMD ["node", "bot.js"]
