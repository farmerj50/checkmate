FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --no-audit

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "start.sh"]
