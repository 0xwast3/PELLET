FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY bin ./bin
COPY src ./src
COPY data ./data
COPY public ./public
COPY server.mjs ./

ENV PELLET_DATA_DIR=/app/.pellet
ENV PORT=4721
EXPOSE 4721

CMD ["node", "server.mjs"]
