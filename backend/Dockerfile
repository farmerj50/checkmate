FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --no-audit

RUN npx prisma generate

COPY . .

EXPOSE 3001

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/server.ts"]
