# 🎰 OnlineCasino Backend

Backend для децентрализованной игры **Slot Machine**.  
Сервис отвечает за:
- хранение истории игр, депозитов и выводов в MySQL,
- предоставление API для фронта,
- интеграцию с ончейн-событиями смарт-контракта (через `ethers`),
- автоподтяжку событий через индексатор.

---

## 🚀 Запуск проекта
npm run dev
npm run indexer
npx prisma studio - просмотр БД

### 1. Установить зависимости
cd backend
npm install

### 2. Запустить MySQL (Docker)

docker run --name mysql8 \
  -e MYSQL_ROOT_PASSWORD=pass \
  -e TZ=UTC \
  -p 3306:3306 \
  -v mysql8-data:/var/lib/mysql \
  -d mysql:8

### 3. Применить схему БД

npx prisma db pull    # подтянуть структуру (если БД уже создана)
npx prisma generate   # сгенерировать Prisma Client

### 4. Настроить .env

Пример есть в репозитории (.env.example).
Главное: DATABASE_URL, CHAIN_ID_DEFAULT, RPC_URL_*, CONTRACT_ADDRESS_*.

### 5. Запуск сервера

npm run dev

→ API будет доступно на http://localhost:4000.

### 6. Запуск индексатора

Индексатор слушает события контракта (Deposit, SpinResult, Withdraw)
и пишет их в БД автоматически.

npm run indexer

⚠️ Для корректной работы нужны ABI и CONTRACT_ADDRESS_<chainId> в .env.

⸻

### 7. 📡 API эндпоинты

🔹 Health
	•	GET /health → { ok: true, db: "up" }

⸻

🔹 Spins (/api/spins)
	•	GET /api/spins/test — последние N спинов (smoke-test).
	•	GET /api/spins/history/:address?chainId=&limit=&cursor= — история игрока.
	•	GET /api/spins/by-tx/:txHash?chainId= — найти спин по транзакции.
	•	GET /api/spins/recent?chainId=&limit= — последние спины (лента).
	•	POST /api/spins/confirm — подтвердить транзакцию спина, распарсить SpinResult и сохранить.

🔹 Deposits (/api/deposits)
	•	POST /api/deposits/confirm — подтвердить транзакцию депозита, записать в БД.

🔹 Withdrawals (/api/withdrawals)
	•	POST /api/withdrawals/confirm — подтвердить транзакцию вывода, записать в БД.

⸻

🔹 Players (/api/players)
	•	GET /api/players/:address/summary?chainId= — агрегированная сводка по игроку.
	•	GET /api/players/:address/spins?chainId=&limit=&cursor= — история спинов.
	•	POST /api/players/:address/recalc?chainId= — пересчёт агрегатов.
	•	GET /api/players/leaderboard/top?chainId=&metric=&limit= — лидерборд игроков.

🔹 Stats (/api/stats)
	•	GET /api/stats/summary?chainId= — общая сводка (ставки, выплаты, RTP).
	•	GET /api/stats/rtp?window=7d&chainId= — RTP за окно (24h / 7d / 30d).
	•	GET /api/stats/leaderboard?chainId=&metric=&limit= — лидерборд (дублирует players).

⸻

### 8. 🧩 Архитектура проекта

ONLINECASINO/
├── prisma/
│   └── schema.prisma                 # схема БД для Prisma
├── src/
│   ├── abi/
│   │   └── SlotMachine.json          # ABI смарт-контракта (от Димы). Используется для парсинга логов
│   ├── routes/                       # HTTP-эндпоинты (Express Router). Только бизнес-логика API
│   │   ├── deposits.js               # POST /api/deposits/confirm — подтверждение депозитов по txHash
│   │   ├── players.js                # профайл игрока, история спинов игрока, пересчёт агрегатов, лидерборд
│   │   ├── spins.js                  # история/лента/поиск по tx, POST /api/spins/confirm
│   │   ├── stats.js                  # общая статистика: summary, RTP за окно, общий лидерборд
│   │   └── withdrawals.js            # POST /api/withdrawals/confirm — подтверждение выводов
│   ├── services/                     # переиспользуемые сервисы, без Express
│   │   ├── abi.js                    # загрузка ABI: читает JSON из src/abi/SlotMachine.json и экспортирует массив
│   │   ├── chain-resolver.js         # pickNetwork(req): выбирает сеть по chainId из query/body, валидирует конфиг
│   │   ├── networks.js               # resolveChainId()/getNetworkConfig(): читает RPC_URL_<id>, CONTRACT_ADDRESS_<id> из .env
│   │   └── onchain.js                # интеграция с ethers, возврат нормализованных полей
│   ├── utils/
│   │   └── logger.js                 # pino-логгер
│   ├── workers/
│   │   └── indexer.js                # подписка на события контракта
│   ├── db.js                         # инициализация Prisma Client (используется роутами/воркерами)
│   └── index.js                      # точка входа сервера
├── .env                              # все конфиги окружения
├── .gitignore                        
├── package.json                      # скрипты и зависимости
├── package-lock.json                
├── README.md                        
└── schema.sql                        # SQL для первичного создания БД


### 9. 🧪 Тестовые сети
	•	Hardhat local (31337) — быстрые локальные тесты.
	•	Sepolia testnet (11155111) — публичная тестовая сеть.

Обе сети уже поддерживаются через .env.

⸻

### 10. ✅ TODO
	•	Вставить ABI в services/abi.js.
	•	Сделать idempotent insert в /spins/confirm (аналогично deposits/withdrawals).
	•	Подключить CRON/worker для периодического /players/:address/recalc.
	•	Реализовать reconciliation (сверка БД с ончейном).
	•	(Опц.) /bank/summary для отчётности.
