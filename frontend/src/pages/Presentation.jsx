import React, { useMemo, useState, useEffect, useCallback } from "react";

const slides = [
  // 1 — Титул
  {
    type: "title",
    title: "🎰 OnlineCasino dApp",
    subtitleLines: [
      "Командная работа студентов",
      "@andMp — фронт • @DiMac1k — контракт • @Yuliia9009 — бэкенд & интеграции",
    ],
    footnote: "Учебный проект: слот‑машина на блокчейне",
  },

  // 2 — Идея
  {
    title: "Зачем мы это делали?",
    bullets: [
      "Выбрали слот‑машину: просто начать, но есть где себя проявить.",
      "Честность держит смарт‑контракт, а данные пишет бэкенд.",
    ],
    image: "/assets/slides/screen.png",
    emoji: "💡",
  },

  // 3 — Архитектура
  {
    title: "Из чего всё состоит",
    bullets: [
      "Frontend: React + Vite (кабинет игрока, лента, админка).",
      "Backend: Node.js + Express + Prisma + MySQL.",
      "Smart‑contract: Solidity (Hardhat).",
    ],
    image: "/assets/slides/arch.svg",
    emoji: "🧱",
  },

  // 4 — Контракт
  {
    title: "Что делает контракт",
    bullets: [
      "Принимает ставки, крутит спин, отправляет выплату.",
      "События: Deposit, SpinResult, Withdraw — их ловит индексатор.",
      "Логика выигрыша упрощённая — учебный кейс, а не казино на реальные деньги 🙂",
    ],
    image: "/assets/slides/contract.svg",
    emoji: "🔐",
  },

  // 5 — Бэкенд
  {
    title: "Что делает бэкенд",
    bullets: [
      "Даёт REST‑API для фронта.",
      "Хранит игроков, депозиты, спины и выводы.",
      "Индексирует ончейн‑события и собирает агрегаты/статистику.",
    ],
    image: "/assets/slides/backend.svg",
    emoji: "🛠️",
  },

  // 6 — Фронт
  {
    title: "Что видит игрок и админ",
    bullets: [
      "Игрок: депозит, спин, вывод, история и лента.",
      "Админ: сводка, RTP, поиск по игрокам/транзакциям.",
      "Подключение через MetaMask (адрес контракта и ABI — автоматически).",
    ],
    image: "/assets/slides/frontend.svg",
    emoji: "🖥️",
  },

  // 7 — Админ‑панель
  {
    title: "Админ‑панель",
    bullets: [
      "📊 Общая статистика: ставки/выплаты, RTP.",
      "👤 Игроки: нетто, активность, их спины.",
      "🧾 Проверка транзакций и лента последних игр.",
    ],
    image: "/assets/slides/admin.svg",
    emoji: "🧭",
  },

  // 8 — Что ломалось и как чинили
  {
    title: "С чем встряли и что помогло",
    bullets: [
      "Большие числа (BigInt) → приводим к строкам там, где нужно.",
      "Разные .env → собрали централизованный запуск (monorepo + скрипты).",
      "MetaMask ругался на сеть → автопроверка ChainId и адреса контракта.",
      "MySQL в Docker → schema.sql + healthchecks, чтобы всё поднималось само.",
      "CORS/сетевые штуки → жестко фиксируем BASE_URL и прокидываем переменные окружения.",
      "Синхронизация FE/BE адреса контракта → авто‑генерация .env и JSON с адресом.",
    ],
    image: "/assets/slides/error.jpg",
    emoji: "🩹",
  },

  // 9 — Как это запустить у себя
  {
    title: "Запуск проекта (две кнопки)",
    bullets: [
      "Локально: `npm i` → `npm run dev` — поднимается Hardhat, деплой, бэкенд, фронт и Prisma Studio.",
      "Через Docker: `docker compose up -d --build` — всё в контейнерах.",
      "Адрес контракта прокидывается автоматом в FE/BE.",
    ],
    image: "/assets/slides/devops.svg",
    emoji: "🚀",
  },

  // 10 — Финал
  {
    title: "Что получилось",
    bullets: [
      "Связали всё: контракт ↔ индексатор ↔ API ↔ фронт.",
      "Есть админка и лента, удобно смотреть, что происходит.",
      "Что хотели, но что не успели: пауза казино, бан/разбан игроков, отчёты и т.п.",
      "Централизованный запуск: одна команда поднимает ноду, контракт, БД, API и фронт.",
      "Планы: получить хорошую оценку за коммандную работу.",
    ],
    image: "/assets/slides/cat.jpg",
    closing: "Спасибо за внимание! ✌️",
    emoji: "✅",
  },
];

function Dot({ active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-2.5 h-2.5 rounded-full transition-all ${
        active
          ? "bg-emerald-400 ring-2 ring-emerald-400/40 scale-110"
          : "bg-gray-600 hover:bg-gray-500"
      }`}
      aria-label="go to slide"
    />
  );
}

export default function Presentation() {
  const [idx, setIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const total = slides.length;
  const current = slides[idx];
  const hasImage = Boolean(current.image);

  const next = useCallback(
    () => setIdx((i) => Math.min(i + 1, total - 1)),
    [total]
  );
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  const toggleZoom = useCallback(() => {
    setZoomed((z) => !z);
  }, []);

  // Клавиатура
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Клик по фону
  const onBackdropClick = (e) => {
    if (e.currentTarget === e.target) next();
  };

  const progress = useMemo(() => ((idx + 1) / total) * 100, [idx, total]);

  return (
    <div
      className="min-h-[calc(100vh-5rem)] relative rounded-2xl overflow-hidden p-4 md:p-6"
      onClick={onBackdropClick}
    >
      {/* Фон: градиенты + «неон» */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-950 via-gray-900 to-black" />
      <div
        className="pointer-events-none absolute -z-10 blur-3xl opacity-30"
        style={{
          inset: "-20%",
          background:
            "radial-gradient(40% 40% at 20% 20%, rgba(16,185,129,0.35), transparent 60%), radial-gradient(45% 45% at 80% 30%, rgba(59,130,246,0.25), transparent 60%), radial-gradient(35% 35% at 50% 85%, rgba(244,63,94,0.25), transparent 60%)",
        }}
      />

      {/* Верхняя панель */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">OnlineCasino • презентация</div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {idx + 1}/{total}
          </span>
          <div className="w-40 h-1.5 bg-gray-800/80 rounded overflow-hidden">
            <div
              className="h-1.5 bg-emerald-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Основная карточка */}
      <div className="relative overflow-hidden rounded-xl border border-gray-800/60 bg-gray-900/60 backdrop-blur-md p-6 md:p-10 shadow-[0_0_40px_-15px_rgba(16,185,129,0.4)] h-[540px] md:h-[600px] lg:h-[640px]">
        {/* Светящийся ободок */}
        <div className="pointer-events-none absolute -inset-[1px] rounded-xl ring-1 ring-emerald-400/10" />

        {current.type === "title" ? (
          <div className="h-full flex flex-col items-center justify-center text-center select-none">
            <h1 className="with-emoji text-4xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_0_25px_rgba(16,185,129,0.25)]">
              {current.title}
            </h1>
            {Array.isArray(current.subtitleLines) && (
              <div className="mt-5 space-y-1">
                {current.subtitleLines.map((line, i) => (
                  <p key={i} className="text-gray-300 md:text-lg">
                    {line}
                  </p>
                ))}
              </div>
            )}
            {current.footnote && (
              <p className="mt-4 text-sm text-gray-400">{current.footnote}</p>
            )}
          </div>
        ) : (
          <div
            className={`grid ${hasImage ? "md:grid-cols-2" : "grid-cols-1"} gap-10 items-stretch h-full`}
          >
            {/* Текст */}
            <div
              className={`space-y-5 overflow-y-auto ${hasImage ? "pr-2" : ""}`}
            >
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                {current.emoji && (
                  <span className="emoji text-2xl leading-none align-middle">
                    {current.emoji}
                  </span>
                )}
                <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-blue-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  {current.title}
                </span>
              </h2>

              {current.bullets && (
                <ul className="space-y-3">
                  {current.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="text-gray-200/95 leading-relaxed flex gap-2"
                    >
                      <span className="text-emerald-400">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {current.note && (
                <div className="text-xs text-gray-500">{current.note}</div>
              )}

              {current.closing && (
                <div className="pt-2 text-emerald-300/90 font-medium">
                  {current.closing}
                </div>
              )}
            </div>

            {/* Картинка */}
            {hasImage && (
              <div className="relative h-full flex items-center justify-center">
                <div className="rounded-xl border border-gray-800/70 bg-black/30 p-3 shadow-[0_0_30px_-15px_rgba(59,130,246,0.35)] h-full w-full flex items-center justify-center">
                  <img
                    src={current.image}
                    alt=""
                    className="rounded-lg w-full h-full object-contain max-h-full cursor-zoom-in"
                    onClick={toggleZoom}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Навигация */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={prev}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-750 disabled:opacity-40 transition-colors"
            disabled={idx === 0}
          >
            ← Назад
          </button>
          <button
            onClick={next}
            className="px-4 py-2 rounded-lg bg-emerald-500/95 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            disabled={idx === total - 1}
          >
            Далее →
          </button>
        </div>

        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <Dot key={i} active={i === idx} onClick={() => setIdx(i)} />
          ))}
        </div>
      </div>

      {/* Подсказка */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Листай ←/→ или пробел. Клик по фону — следующий слайд.
      </div>

      {/* Zoom Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 transition-opacity duration-300 ${
          zoomed
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setZoomed(false)}
      >
        {hasImage && (
          <img
            src={current.image}
            alt=""
            className={`rounded-lg max-w-5xl max-h-[90vh] object-contain transition-transform duration-300 ${zoomed ? "scale-100" : "scale-90"}`}
          />
        )}
      </div>
    </div>
  );
}
