FROM mcr.microsoft.com/playwright:v1.61.1-noble AS dev

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=4173
ENV SLIDEOTTER_HOME=/data
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json .npmrc ./
COPY scripts/setup-git-hooks.mts ./scripts/setup-git-hooks.mts
RUN npm ci

COPY . .

EXPOSE 4173

CMD ["npm", "run", "studio:start"]
