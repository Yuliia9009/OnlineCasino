FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# для ожидания порта
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

ENV OUT_DIR=/out

EXPOSE 8545

# 1) поднимаем ноду на 0.0.0.0:8545
# 2) ждём порт
# 3) деплоим и пишем /out/slot.{json,env}
# 4) оставляем ноду жить в фоне (tail)
CMD sh -lc "npx hardhat node --hostname 0.0.0.0 & \
    until nc -z localhost 8545; do echo '⏳ waiting hardhat...'; sleep 2; done && \
    OUT_DIR=$OUT_DIR npx hardhat run scripts/deploy.js --network localhost && \
    tail -f /dev/null"