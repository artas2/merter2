# Bilinçli Sakin — üretim imajı
FROM node:22-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/data/site-app.sqlite

WORKDIR /app

# Yalnızca üretim bağımlılıkları (marked)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY public ./public
COPY merter ./merter
COPY scripts/kur-site.js scripts/seed-demo.js scripts/migrate.js ./scripts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Uygulama dosyaları root'a ait ve salt-okur kalır; süreç yetkisiz "node" kullanıcısıyla çalışır (giriş betiğinde setpriv).
RUN mkdir -p /data && chown node:node /data && chmod 0755 /usr/local/bin/docker-entrypoint.sh
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/saglik').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
