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
