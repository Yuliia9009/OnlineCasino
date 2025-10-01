FROM node:20

WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
# если Prisma — schema нужна до generate
COPY prisma ./prisma
RUN npm ci && npx prisma generate

# Копируем исходники
COPY . .

EXPOSE 4000
# Стартуем обычным прод-сервером
CMD ["node", "src/index.js"]