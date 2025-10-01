# 🎰 OnlineCasino (Blockchain dApp)

Онлайн-казино на **Ethereum** (Hardhat + Solidity) с фронтендом на **React** и бэкендом на **Node.js / Express / Prisma / MySQL**.  
Поддерживает депозиты, спины, историю игр, админ-панель и агрегированную статистику.

---

## 👨‍💻 Команда разработчиков
- **andMp** — Frontend  
- **DiMac1k** — Smart Contract  
- **Yuliia9009** — Backend  

---

## 🚀 Стек технологий
- **Смарт-контракт**: Solidity, Hardhat
- **Frontend**: React + Vite + Tailwind
- **Backend**: Node.js (Express), Prisma ORM
- **База данных**: MySQL (в Docker)
- **Web3**: ethers.js
- **DevOps**: Docker, Nodemon

---

## ⚙️ Установка и запуск

### 1. Клонирование репозитория
```bash
git clone https://github.com/Yuliia9009/OnlineCasino.git
cd OnlineCasino
```

### 2. Настройка окружения
Создайте `.env` файлы в **backend** и **frontend**:

**backend/.env**
```env
DATABASE_URL="mysql://root:pass@127.0.0.1:3306/onlinecasino"
CHAIN_ID_DEFAULT=31337
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:4000
VITE_CHAIN_ID=31337
VITE_CONTRACT_ADDRESS=0x...
VITE_ADMIN_ADDRESSES=0x...
```

---

### 3. Запуск базы данных (MySQL через Docker)
```bash
docker run -d --name oc-mysql   -e MYSQL_ROOT_PASSWORD=pass   -e MYSQL_DATABASE=onlinecasino   -p 3306:3306   mysql:8
```

Импорт схемы:
```bash
docker exec -i oc-mysql mysql -u root -ppass < ./schema.sql
```

---

### 4. Backend
```bash
cd backend
npm install
npm run dev
```
➡️ будет доступен на [http://localhost:4000](http://localhost:4000)

---

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```
➡️ будет доступен на [http://localhost:5173](http://localhost:5173)

---

### 6. Контракты
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

---

## 📊 Функционал

### 👤 Игрок
- регистрация кошелька через MetaMask
- пополнение (Deposit)
- спины 🎰 (игровые ставки)
- история игр (Feed)
- вывод средств (Withdraw)

### 🛠 Администратор
- панель администратора `/admin`
- просмотр игроков и их статистики
- агрегаты: депозиты, выводы, RTP
- просмотр последних игр
- управление параметрами (в будущем: пауза казино, бан игроков, пополнение/вывод трезори)

---

## 📜 Контракты
- `SlotMachine.sol` — основной контракт игры
- события:
  - `Deposit`
  - `Withdraw`
  - `SpinPlayed`
  - `SpinPriceUpdated` 

---

✍️ Командный проект: **andMp, DiMac1k, Yuliia9009**
=======
# OnlineCasino

Децентрализованное онлайн‑казино на смарт‑контракте (SlotMachine).

## Структура проекта

- `contracts/` — смарт‑контракты на Solidity (Hardhat), скрипт деплоя прокидывает адрес/ABI во фронт и бэкенд.
- `backend/` — API на Node.js + Express + Prisma + MySQL, индексатор ончейн‑событий.
- `frontend/` — клиент (React + Vite).

## Требования

- Node.js 20+
- npm 9+
- (для локальной БД) MySQL 8
- Браузер с MetaMask

---

## Локальный запуск (без Docker)

1) Клонируйте репозиторий
```bash
git clone https://github.com/yuliia9009/OnlineCasino.git
cd OnlineCasino
```

2) Установите зависимости монорепо (contracts, backend, frontend)
```bash
npm install
```

3) Подготовьте базу данных
- Если MySQL запущен **локально**: создайте БД и укажите строку подключения в `backend/.env` (`DATABASE_URL=...`).
- Примените схему Prisma:
```bash
npx prisma db push --schema backend/prisma/schema.prisma
```
> Команда сработает, потому что на шаге `npm install` Prisma уже установлен как dev‑зависимость.

4) Старт всего стека одной командой
```bash
npm run dev
```
Скрипт поднимет Hardhat node, задеплоит контракт, запустит backend, frontend и Prisma Studio. Адрес контракта автоматически прокинется в FE/BE.

5) Откройте:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Prisma Studio: http://localhost:5555

> В MetaMask выберите сеть **Localhost 8545 (chainId 31337)**. Аккаунты Hardhat имеют по 10000 ETH (только для локальной разработки).

---

## Запуск через Docker

```bash
docker compose up -d --build
```
Поднимутся сервисы: `mysql`, `hardhat`, `backend`, `frontend`. 
- БД инициализируется автоматически (см. `backend/schema.sql` и healthchecks).
- Адрес контракта после деплоя попадает в `.shared/slot.env` и читается FE/BE.

Откройте:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Prisma Studio (если включено в локальном режиме): http://localhost:5555

> Запуск отдельного сервиса вроде `docker compose up -d --build frontend` **не рекомендуем**: фронт ожидает, что уже работают `hardhat` и `backend`.

---

## Работа с базой данных

- **Локально:** MySQL ставится вручную, строка подключения — `backend/.env` → `DATABASE_URL`. Применить схему:
```bash
npx prisma db push --schema backend/prisma/schema.prisma
```
- **Docker:** MySQL поднимется сам, схема применится автоматически при старте контейнеров.

---

## Полезные команды

| Команда | Что делает |
|---|---|
| `npm install` | Установить зависимости во всех пакетах монорепо |
| `npm run dev` | Запустить hardhat, deploy, backend, frontend и Prisma Studio |
| `npx prisma db push --schema backend/prisma/schema.prisma` | Применить схему к локальной MySQL |
| `docker compose up -d --build` | Поднять весь стек в контейнерах |
| `docker compose logs -f backend` | Смотреть логи бэкенда |
| `docker compose down -v` | Остановить и удалить контейнеры и тома (осторожно: удалит данные БД) |

---

## Интеграция с MetaMask

- При первом заходе фронт попросит подключить кошелёк.
- Сеть: **Localhost 8545 / chainId 31337**.
- Адрес контракта и ABI подставляются автоматически после деплоя.

---

## Презентация

В приложении есть короткая презентация проекта.

---
