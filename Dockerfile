FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /tmp/one-bullet-data && chown -R node:node /app /tmp/one-bullet-data

USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DATA_DIR=/tmp/one-bullet-data

EXPOSE 8080

CMD ["node", "server.js"]
