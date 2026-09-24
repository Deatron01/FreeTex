# FreeTex: web app + compile server with a full TeX Live installation.
#
#   docker build -t freetex .
#   docker run -p 3001:3001 freetex
#
# then open http://localhost:3001

FROM node:22-bookworm-slim AS web
WORKDIR /app/latex-web
COPY latex-web/package.json latex-web/package-lock.json ./
RUN npm ci
COPY latex-web/ ./
RUN npm run build

FROM texlive/texlive:latest
RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/ ./server/
COPY --from=web /app/latex-web/dist ./latex-web/dist
ENV HOST=0.0.0.0 \
    PORT=3001 \
    FREETEX_WORKDIR=/tmp/freetex-builds \
    HOME=/tmp
EXPOSE 3001
USER nobody
CMD ["node", "server/index.js"]
