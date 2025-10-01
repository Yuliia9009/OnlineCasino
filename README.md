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

✍️ Командный проект: **andMp, DiMac1k, Yuliia9009**
