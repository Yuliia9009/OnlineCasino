FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# Включаем dev-сервер Vite так, чтобы он слушал на всех интерфейсах контейнера
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]