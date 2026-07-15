/* ═══════════════════════════════════════════════════════════════════════
   PROJECT EGO — app.js
   Личная RPG-система: карьера, финансы, контент, здоровье, семья.
   Чистый JavaScript, без библиотек. Данные — в localStorage.

   Структура файла:
   1.  Утилиты
   2.  Хранилище (localStorage, экспорт/импорт)
   3.  Справочники и стартовые данные
   4.  Состояние по умолчанию
   5.  Движок XP, уровней и характеристик
   6.  Gold и награды
   7.  Движок дня: режимы, минимальный день, серии, стабильность
   8.  Квесты
   9.  Боссы и сезоны
   10. Главы (карьерная карта)
   11. Навыки
   12. Проекты
   13. Контент
   14. Финансы
   15. Здоровье
   16. Семья
   17. Идеи
   18. Недельный обзор
   19. Достижения
   20. Формула «Путь к свободе»
   21. Внутренние уведомления
   22. SVG-графики
   23. Рендер экранов
   24. Модальные окна и формы
   25. Онбординг
   26. Инициализация
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

/* ════════ 1. УТИЛИТЫ ════════ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function dateDiffDays(a, b) { // b - a в днях
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function fmtMoney(n) {
  return (Math.round(Number(n) || 0)).toLocaleString('ru-RU') + ' ₽';
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pct(a, b) { return b > 0 ? clamp(Math.round(a / b * 100), 0, 100) : 0; }

/* ════════ 2. ХРАНИЛИЩЕ ════════ */

const STORE_KEY = 'project_ego_v1';

function saveState() {
  try {
    S.meta.lastSaved = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    // если суточного снимка ещё не было вообще — создаём при первом же сохранении
    if (!localStorage.getItem('project_ego_snap_date')) {
      localStorage.setItem('project_ego_snap', localStorage.getItem(STORE_KEY));
      localStorage.setItem('project_ego_snap_date', todayStr());
    }
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    toast('⚠ Не удалось сохранить данные. Проверь свободное место браузера.', 'warn');
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.version) return null;
    return migrate(parsed);
  } catch (e) {
    console.error('Ошибка чтения сохранения:', e);
    return null;
  }
}

function migrate(st) {
  // Точка расширения: при изменении схемы данных повышаем version и дополняем поля.
  const def = defaultState();
  for (const k of Object.keys(def)) if (!(k in st)) st[k] = def[k];
  return st;
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'project-ego-backup-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  S.meta.lastBackup = new Date().toISOString();
  saveState();
  toast('Резервная копия сохранена в загрузки', 'ok');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !data.version || !data.profile) throw new Error('Не похоже на файл PROJECT EGO');
      S = migrate(data);
      saveState();
      toast('Данные импортированы', 'ok');
      renderAll();
    } catch (e) {
      toast('⚠ Файл не распознан: ' + e.message, 'warn');
    }
  };
  reader.readAsText(file);
}

/* ════════ 3. СПРАВОЧНИКИ ════════ */

const RANKS = [
  { min: 1, name: 'Новичок' }, { min: 5, name: 'Исследователь' },
  { min: 10, name: 'Практик' }, { min: 15, name: 'Архитектор' },
  { min: 20, name: 'AI-создатель' }, { min: 30, name: 'Системный инженер' },
  { min: 40, name: 'Предприниматель' }, { min: 50, name: 'Свободный создатель' },
];

const DIFF = {
  E: { xp: 15, gold: 5 },  D: { xp: 30, gold: 10 }, C: { xp: 65, gold: 20 },
  B: { xp: 125, gold: 40 }, A: { xp: 250, gold: 80 }, S: { xp: 550, gold: 160 },
};

const CATS = {
  story:   { n: 'Сюжетный',  ico: '📖' }, career: { n: 'Карьерный', ico: '🚀' },
  study:   { n: 'Учебный',   ico: '📚' }, project:{ n: 'Проектный', ico: '🛠' },
  content: { n: 'Контентный',ico: '🎬' }, finance:{ n: 'Финансовый',ico: '💰' },
  family:  { n: 'Семейный',  ico: '❤' },  home:   { n: 'Бытовой',   ico: '🏠' },
  health:  { n: 'Здоровье',  ico: '💪' }, recover:{ n: 'Восстановление', ico: '🌙' },
  weekly:  { n: 'Еженедельный', ico: '📅' }, boss: { n: 'Босс-квест', ico: '👹' },
  custom:  { n: 'Пользовательский', ico: '✦' },
};

// Как категории квестов влияют на характеристики персонажа (авторост статов)
const CAT_STATS = {
  career:  { discipline: 1, career: 0, tech: 1, intellect: 1 },
  study:   { intellect: 2, tech: 1 },
  project: { tech: 2, creativity: 1, discipline: 1 },
  content: { creativity: 2, reputation: 2, communication: 1 },
  finance: { finance: 2, discipline: 1 },
  family:  { relations: 2 },
  home:    { relations: 1, discipline: 1 },
  health:  { health: 2, endurance: 1 },
  recover: { health: 1, endurance: 1 },
  story:   { discipline: 1 },
  weekly:  { discipline: 2, intellect: 1 },
  boss:    { discipline: 2, reputation: 1 },
  custom:  { discipline: 1 },
};

const STAT_NAMES = {
  discipline: 'Дисциплина', intellect: 'Интеллект', creativity: 'Креативность',
  tech: 'Технический навык', communication: 'Коммуникация', finance: 'Фин. устойчивость',
  health: 'Здоровье', relations: 'Отношения', reputation: 'Репутация', endurance: 'Выносливость',
};

const MODES = {
  work:    { n: 'Рабочий день', ico: '☕', d: 'Смена в кофейне. Максимум 30–60 минут развития после работы.' },
  free:    { n: 'Выходной',     ico: '🔥', d: 'Глубокий блок карьеры, проект, контент, семья и отдых.' },
  low:     { n: 'Низкая энергия', ico: '🌫', d: 'Только минимум: 10–15 минут. Без вины за отказ от большего.' },
  recover: { n: 'Восстановление', ico: '🌙', d: 'Сон, прогулка, семья. Отдых — часть системы.' },
};

// Ежедневные шаблоны по режимам дня. mini = минимальная версия дня.
const DAY_TEMPLATES = {
  work: [
    { cat: 'career', name: 'Карьера: 10–20 минут (Vibe Coding / AI / курс)', xp: 25 },
    { cat: 'health', name: 'Здоровье: минимальное действие (вода / прогулка / разминка)', xp: 10 },
    { cat: 'family', name: 'Семья или быт: одно действие', xp: 10 },
  ],
  free: [
    { cat: 'career', name: 'Глубокий карьерный блок 60–120 минут', xp: 60 },
    { cat: 'project', name: 'Работа над активным проектом', xp: 40 },
    { cat: 'content', name: 'Подготовить один материал для контента', xp: 30 },
    { cat: 'family', name: 'Время с женой / бытовые дела', xp: 15 },
    { cat: 'recover', name: 'Полноценный отдых без чувства вины', xp: 10 },
  ],
  low: [
    { cat: 'career', name: 'Карьера: 10–15 минут, самое лёгкое действие', xp: 20 },
    { cat: 'health', name: 'Базовая забота о себе', xp: 10 },
    { cat: 'family', name: 'Одна небольшая семейная задача', xp: 10 },
  ],
  recover: [
    { cat: 'recover', name: 'Сон / прогулка / нормальная еда', xp: 15 },
    { cat: 'family', name: 'Время с семьёй', xp: 10 },
    { cat: 'recover', name: 'Лёгкий обзор прогресса (2 минуты)', xp: 5 },
  ],
};

const NAV_ITEMS = [
  { key: 'home', n: 'Главная', ico: '⌂' }, { key: 'today', n: 'Сегодня', ico: '☀' },
  { key: 'quests', n: 'Квесты', ico: '⚔' }, { key: 'career', n: 'Карьера', ico: '🗺' },
  { key: 'skills', n: 'Навыки', ico: '◈' }, { key: 'projects', n: 'Проекты', ico: '🛠' },
  { key: 'content', n: 'Контент', ico: '🎬' }, { key: 'finance', n: 'Финансы', ico: '💰' },
  { key: 'health', n: 'Здоровье', ico: '💪' }, { key: 'family', n: 'Семья', ico: '❤' },
  { key: 'analytics', n: 'Аналитика', ico: '📊' }, { key: 'achieve', n: 'Достижения', ico: '🏆' },
  { key: 'settings', n: 'Настройки', ico: '⚙' },
];

/* ── Карьерная карта: 8 глав ── */
function seedChapters() {
  const ch = (id, name, period, reward, goals, boss) => ({
    id, name, period, reward, boss,
    goals: goals.map(t => ({ t, done: false })),
    notes: '', completedAt: null,
  });
  return [
    ch(1, 'Глава 1. Стабилизация', 'Месяц 1', '+1 жетон защиты, открытие Главы 2', [
      'Начать ежедневно вести PROJECT EGO',
      'Определить реальные свободные часы в неделе',
      'Стабилизировать сон и энергию (без героизма)',
      'Сохранить все обязательные платежи',
      'Выбрать одно основное направление (Vibe Coding)',
      'Не создавать десять параллельных проектов',
    ], 'Хаос и незавершённость'),
    ch(2, 'Глава 2. Основа Vibe Coding', 'Месяцы 2–3', 'Достижение «Фундамент», открытие Главы 3', [
      'Разобраться в HTML и CSS',
      'Понять базовый JavaScript',
      'Освоить Cursor или аналог',
      'Научиться объяснять задачу AI',
      'Создавать и исправлять простые интерфейсы',
      'Разместить первый проект в интернете',
    ], 'Синтаксический страж'),
    ch(3, 'Глава 3. Первое портфолио', 'Месяцы 3–5', 'Портфолио-страница, открытие Главы 4', [
      'Создать 2–3 законченных проекта',
      'Оформить описание: задача → процесс → результат',
      'Сделать GitHub или другое доступное портфолио',
      'Записать демонстрации проектов',
    ], 'Пустая витрина'),
    ch(4, 'Глава 4. Первые деньги', 'Месяцы 5–7', 'Первый заработок из нового направления', [
      'Сформировать 1–2 понятных предложения услуг',
      'Найти потенциальных клиентов',
      'Отправить первые 10 осмысленных предложений',
      'Выполнить первый небольшой заказ',
      'Получить отзыв клиента',
    ], 'Страх первого клиента'),
    ch(5, 'Глава 5. Система контента', 'Месяцы 4–8 (параллельно)', 'Растущий личный бренд', [
      'Перезапустить TikTok-канал с новым позиционированием',
      'Определить 3–4 рубрики',
      'Публиковать регулярно (по этапам: 1–2 → 2–3 → 3–4 в неделю)',
      'Перерабатывать один материал под несколько площадок',
      'Показывать путь и реальные проекты',
    ], 'Тишина в ленте'),
    ch(6, 'Глава 6. Автоматизация', 'Месяцы 7–9', 'Навык, за который платят бизнесы', [
      'Изучить API на базовом уровне',
      'Научиться работать с webhook',
      'Создавать простые автоматизации',
      'Освоить n8n, Make или аналог',
      'Сделать автоматизацию для реальной задачи',
    ], 'Рутинный голем'),
    ch(7, 'Глава 7. Цифровой продукт', 'Месяцы 9–11', 'Первый пассивный доход', [
      'Определить повторяющуюся проблему аудитории',
      'Создать шаблон, мини-приложение или набор промптов',
      'Протестировать спрос',
      'Получить первые продажи',
    ], 'Полка без товара'),
    ch(8, 'Глава 8. Переход', 'Месяц 12+', 'Свобода. Безопасный уход из найма', [
      'Оценить дополнительный доход за последние 3 месяца',
      'Оценить финансовую подушку',
      'Оценить остаток долгов',
      'Определить возможность сокращения рабочих часов',
      'Принять решение без импульса — только по цифрам',
    ], 'Золотая клетка'),
  ];
}

/* ── Дерево навыков ── */
function seedSkills() {
  const n = (id, name, lvl = 0) => ({ id, name, lvl, xp: 0, status: lvl > 0 ? 'learning' : 'available', proofs: [] });
  return [
    { branch: 'AI', nodes: [
      n('ai_chatgpt', 'Эффективная работа с ChatGPT', 3), n('ai_claude', 'Claude', 2),
      n('ai_prompt', 'Prompt Engineering', 3), n('ai_img', 'Генерация изображений', 3),
      n('ai_docs', 'Анализ документов', 1), n('ai_research', 'AI для исследований', 1),
      n('ai_agents', 'AI-агенты', 0),
    ]},
    { branch: 'Разработка', nodes: [
      n('dev_html', 'HTML', 1), n('dev_css', 'CSS', 1), n('dev_js', 'JavaScript', 0),
      n('dev_git', 'Git', 0), n('dev_github', 'GitHub', 0), n('dev_vibe', 'Vibe Coding', 1),
      n('dev_debug', 'Отладка', 0), n('dev_responsive', 'Адаптивный дизайн', 0),
      n('dev_api', 'API', 0), n('dev_db', 'Базы данных', 0), n('dev_deploy', 'Развёртывание', 0),
    ]},
    { branch: 'Автоматизация', nodes: [
      n('auto_logic', 'Логика процессов', 1), n('auto_webhook', 'Webhook', 0),
      n('auto_n8n', 'n8n', 0), n('auto_make', 'Make', 0), n('auto_tg', 'Telegram-боты', 0),
      n('auto_integr', 'Интеграции', 0), n('auto_ai', 'AI-автоматизации', 0),
    ]},
    { branch: 'Контент', nodes: [
      n('ct_script', 'Сценарии', 1), n('ct_shorts', 'Короткие ролики', 2), n('ct_edit', 'Монтаж', 3),
      n('ct_present', 'Подача', 2), n('ct_story', 'Сторителлинг', 1), n('ct_analytics', 'Аналитика контента', 0),
      n('ct_brand', 'Личный бренд', 0), n('ct_repack', 'Перепаковка контента', 0),
    ]},
    { branch: 'Бизнес', nodes: [
      n('biz_problems', 'Поиск проблем', 1), n('biz_offer', 'Формирование предложения', 1),
      n('biz_sales', 'Продажи', 3), n('biz_nego', 'Переговоры', 2), n('biz_portfolio', 'Портфолио', 0),
      n('biz_pricing', 'Ценообразование', 0), n('biz_client', 'Работа с клиентом', 0),
      n('biz_products', 'Цифровые продукты', 0),
    ]},
    { branch: 'Личное развитие', nodes: [
      n('p_discipline', 'Дисциплина', 2), n('p_energy', 'Управление энергией', 2),
      n('p_planning', 'Планирование', 2), n('p_english', 'Английский', 3),
      n('p_comm', 'Коммуникация', 4), n('p_finlit', 'Финансовая грамотность', 2),
    ]},
  ];
}

/* ── Стартовые проекты ── */
function seedProjects() {
  return [
    { id: 'prj_ego', name: 'PROJECT EGO (это приложение)', problem: 'Системы планирования разваливаются после первого пропуска',
      audience: 'Я сам', idea: 'RPG-система жизни, устойчивая к срывам', status: 'active', priority: 'high',
      started: todayStr(), planned: '', tech: 'HTML, CSS, JS, Vibe Coding', skills: ['dev_html', 'dev_css', 'dev_js', 'dev_vibe'],
      tasks: [
        { t: 'Пройти первичную настройку', done: false },
        { t: 'Прожить с системой первую неделю', done: false },
        { t: 'Скорректировать шаблоны дня под реальный график', done: false },
        { t: 'Сделать первую резервную копию', done: false },
      ],
      link: '', result: '', learned: '', monetizable: 'Может стать кейсом и шаблоном для продажи', content: '', demo: false },
    { id: 'prj_landing', name: 'Лендинг для локального бизнеса', problem: 'У малого бизнеса Нижнего Новгорода нет нормальных сайтов',
      audience: 'Кофейни, барберы, мастера', idea: 'Простой продающий одностраничник', status: 'idea', priority: 'mid',
      started: '', planned: '', tech: 'HTML, CSS, AI-инструменты', skills: ['dev_html', 'dev_css', 'biz_offer'],
      tasks: [{ t: 'Выбрать бизнес (можно свою кофейню)', done: false }, { t: 'Сделать макет с AI', done: false }, { t: 'Сверстать и показать владельцу', done: false }],
      link: '', result: '', learned: '', monetizable: 'Да — первая услуга', content: '', demo: false },
    { id: 'prj_util', name: 'Простая AI-утилита или генератор', problem: 'Рутинные мелочи занимают время',
      audience: 'Бариста, контент-мейкеры', idea: 'Мини-инструмент на базе промптов', status: 'idea', priority: 'mid',
      started: '', planned: '', tech: 'JS, AI API или промпты', skills: ['ai_prompt', 'dev_js'],
      tasks: [{ t: 'Выбрать одну боль', done: false }, { t: 'Сделать прототип', done: false }],
      link: '', result: '', learned: '', monetizable: 'Возможно', content: '', demo: false },
    { id: 'prj_autom', name: 'Автоматизация повторяющейся задачи', problem: 'Ручная рутина',
      audience: 'Я / потенциальный клиент', idea: 'n8n/Make сценарий с демонстрацией до/после', status: 'idea', priority: 'low',
      started: '', planned: '', tech: 'n8n / Make / webhook', skills: ['auto_n8n', 'auto_webhook'],
      tasks: [{ t: 'Найти повторяющуюся задачу', done: false }, { t: 'Собрать сценарий', done: false }],
      link: '', result: '', learned: '', monetizable: 'Да — услуга среднего уровня', content: '', demo: false },
    { id: 'prj_portfolio', name: 'Страница-портфолио', problem: 'Работы негде показать клиенту',
      audience: 'Потенциальные клиенты', idea: 'Одностраничник: кто я, кейсы, контакты', status: 'idea', priority: 'mid',
      started: '', planned: '', tech: 'HTML, CSS', skills: ['dev_html', 'biz_portfolio'],
      tasks: [{ t: 'Собрать 2–3 кейса', done: false }, { t: 'Сверстать', done: false }, { t: 'Опубликовать', done: false }],
      link: '', result: '', learned: '', monetizable: 'Косвенно — приводит клиентов', content: '', demo: false },
  ];
}

/* ── Пути дохода ── */
const INCOME_PATHS = [
  { tier: 'Начальный уровень (доступно сейчас)', items: [
    { n: 'Оформление промптов', skills: 'Prompt Engineering', result: 'Набор рабочих промптов под задачу клиента', diff: 'E–D', step: 'Собрать 10 своих лучших промптов и красиво оформить', client: 'Малый бизнес, SMM-щики' },
    { n: 'AI-изображения: карточки, обложки, визуал', skills: 'Генерация изображений', result: 'Обложки для соцсетей, карточки товаров', diff: 'D', step: 'Сделать 5 обложек в едином стиле для своего TikTok', client: 'Магазины, блогеры' },
    { n: 'Простые лендинги', skills: 'HTML, CSS, Vibe Coding', result: 'Одностраничник за 3–7 дней', diff: 'C', step: 'Сверстать лендинг для вымышленной кофейни', client: 'Локальный бизнес НН' },
    { n: 'Монтаж коротких видео', skills: 'Монтаж (уже 5/10!)', result: 'Готовые Reels/TikTok из сырых съёмок', diff: 'D', step: 'Смонтировать 3 ролика для своего аккаунта как примеры', client: 'Эксперты, магазины' },
    { n: 'Настройка базовых AI-инструментов', skills: 'ChatGPT, Claude', result: 'Настроенный AI-помощник под задачи клиента', diff: 'D', step: 'Написать мини-гайд «AI для кофейни»', client: 'Знакомые предприниматели' },
  ]},
  { tier: 'Средний уровень (после Главы 3–4)', items: [
    { n: 'Сайты для локального бизнеса', skills: 'HTML, CSS, JS, деплой', result: 'Сайт под ключ 15–40 тыс. ₽', diff: 'B', step: 'Первый бесплатный/дешёвый сайт за отзыв', client: 'Бизнес НН' },
    { n: 'Автоматизация заявок', skills: 'n8n / Make, webhook', result: 'Заявки из форм сразу в Telegram', diff: 'B', step: 'Собрать демо на своей форме', client: 'Салоны, доставки' },
    { n: 'Telegram-боты', skills: 'API, боты', result: 'Бот записи/приёма заказов', diff: 'B', step: 'Бот-визитка для себя', client: 'Малый бизнес' },
    { n: 'Системы генерации контента', skills: 'AI + автоматизация', result: 'Полуавтоматический контент-конвейер', diff: 'B–A', step: 'Автоматизировать свой контент-план', client: 'SMM-агентства' },
  ]},
  { tier: 'Продвинутый уровень (после Главы 6–7)', items: [
    { n: 'Микро-SaaS / подписные продукты', skills: 'Полный стек Vibe Coding', result: 'Продукт с ежемесячной оплатой', diff: 'S', step: 'Найти нишу через боль своей аудитории', client: 'Ниша из контента' },
    { n: 'Сложные AI-автоматизации для бизнеса', skills: 'AI-агенты, интеграции', result: 'Процессы под ключ 50 тыс.+ ₽', diff: 'A–S', step: 'Кейс на своей рутине', client: 'Средний бизнес' },
    { n: 'Обучение и консультации', skills: 'Подтверждённый опыт + коммуникация 8/10', result: 'Консультации, мини-курс', diff: 'A', step: 'Разбор «как я ушёл из бариста» после реальных результатов', client: 'Аудитория из TikTok' },
  ]},
];

/* ── Достижения ── */
const ACHIEVEMENTS = [
  { id: 'first_day', ico: '🌅', n: 'Первый день', d: 'Провести первый активный день в системе', check: s => Object.values(s.days).some(d => d.active) },
  { id: 'first_week', ico: '📅', n: 'Первая стабильная неделя', d: '5+ активных дней за 7 дней', check: s => activeDaysInLast(7) >= 5 },
  { id: 'hero_return', ico: '🦅', n: 'Возвращение героя', d: 'Вернуться в систему после пропуска', check: s => s.flags.heroReturns > 0 },
  { id: 'career10', ico: '🚀', n: '10 карьерных действий', d: 'Выполнить 10 карьерных квестов или заданий дня', check: s => countLog('career') >= 10 },
  { id: 'first_project', ico: '🛠', n: 'Первый завершённый проект', d: 'Довести проект до статуса «завершён»', check: s => s.projects.some(p => ['done', 'published', 'monetized'].includes(p.status)) },
  { id: 'first_pub_project', ico: '🌐', n: 'Первый опубликованный проект', d: 'Проект со статусом «опубликован»', check: s => s.projects.some(p => ['published', 'monetized'].includes(p.status)) },
  { id: 'first_video', ico: '🎬', n: 'Первый ролик после перезапуска', d: 'Опубликовать контент после возвращения', check: s => s.content.some(c => ['published', 'analyzed', 'reworked'].includes(c.status)) },
  { id: 'pub10', ico: '📹', n: '10 публикаций', d: '10 опубликованных единиц контента', check: s => publishedCount() >= 10 },
  { id: 'pub30', ico: '🎥', n: '30 публикаций', d: '30 опубликованных единиц контента', check: s => publishedCount() >= 30 },
  { id: 'subs100', ico: '👥', n: '100 подписчиков после перезапуска', d: 'Суммарный прирост +100 подписчиков', check: s => (s.contentStats.subsGained || 0) >= 100 },
  { id: 'views10k', ico: '🔥', n: 'Ролик с 10 000 просмотров', d: 'Один ролик набрал 10 тыс. просмотров', check: s => s.content.some(c => (c.views || 0) >= 10000) },
  { id: 'first_offer', ico: '✉', n: 'Первое предложение услуги', d: 'Отправить первое предложение клиенту', check: s => s.flags.offersSent >= 1 },
  { id: 'first_lead', ico: '🤝', n: 'Первый потенциальный клиент', d: 'Получить первый ответ на предложение', check: s => s.flags.leads >= 1 },
  { id: 'first_order', ico: '💼', n: 'Первый платный заказ', d: 'Выполнить первый оплаченный заказ', check: s => newIncomeTotal() > 0 },
  { id: 'money1k', ico: '💵', n: 'Первые 1 000 ₽ из нового направления', d: 'Заработать 1 000 ₽ вне найма', check: s => newIncomeTotal() >= 1000 },
  { id: 'money10k', ico: '💰', n: 'Первые 10 000 ₽', d: 'Заработать 10 000 ₽ из новых источников', check: s => newIncomeTotal() >= 10000 },
  { id: 'no_debt_growth', ico: '🧊', n: 'Месяц без роста долгов', d: '30 дней без увеличения общего долга', check: s => s.flags.debtFreezeDays >= 30 },
  { id: 'early_payment', ico: '⚡', n: 'Первый досрочный платёж', d: 'Внести платёж сверх минимального', check: s => s.finance.debts.some(d => d.history.some(h => h.extra > 0)) },
  { id: 'debt_closed', ico: '🔓', n: 'Закрытие первого долга', d: 'Полностью закрыть один долг', check: s => s.finance.debts.some(d => d.balance <= 0 && d.initialBalance > 0) },
  { id: 'cushion', ico: '🛡', n: 'Финансовая подушка', d: 'Собрать подушку до цели', check: s => s.finance.cushion.current >= s.finance.cushion.goal && s.finance.cushion.goal > 0 },
  { id: 'days30', ico: '🗓', n: '30 дней устойчивого режима', d: 'Стабильность 28 дней ≥ 70%', check: s => stability(28) >= 70 },
  { id: 'hours100', ico: '⏱', n: '100 часов практики', d: 'Суммарно 100 часов карьерных действий', check: s => (s.flags.practiceMinutes || 0) >= 6000 },
  { id: 'first_product', ico: '📦', n: 'Первый цифровой продукт', d: 'Проект со статусом «монетизируется»', check: s => s.projects.some(p => p.status === 'monetized') },
  { id: 'first_workout', ico: '🏋', n: 'Первая тренировка', d: 'Записать первую тренировку', check: s => s.fitness && s.fitness.workouts.length >= 1 },
  { id: 'workouts10', ico: '💪', n: '10 тренировок', d: 'Записать 10 тренировок', check: s => s.fitness && s.fitness.workouts.length >= 10 },
  { id: 'workouts50', ico: '🦾', n: '50 тренировок', d: 'Полсотни тренировок — это уже характер', check: s => s.fitness && s.fitness.workouts.length >= 50 },
  { id: 'weight_track', ico: '⚖', n: 'Контроль веса', d: '4 записи веса (месяц наблюдений)', check: s => s.fitness && s.fitness.weights.length >= 4 },
  { id: 'weight_minus5', ico: '🔥', n: 'Минус 5 кг', d: 'Снизить вес на 5 кг от старта', check: s => s.fitness && s.fitness.weights.length > 0 && s.fitness.startWeight - Math.min(...s.fitness.weights.map(w => w.kg)) >= 5 },
  { id: 'weight_goal', ico: '🏆', n: 'V-образная цель', d: 'Достичь целевого веса 82 кг или ниже', check: s => s.fitness && s.fitness.weights.some(w => w.kg <= 82) },
];

/* ── Награды за Gold (редактируемые) ── */
function seedRewards() {
  return [
    { id: uid(), n: '30 минут игры', cost: 30 },
    { id: uid(), n: 'Игровой вечер (2–3 часа)', cost: 120 },
    { id: uid(), n: 'Фильм или пара серий аниме', cost: 50 },
    { id: uid(), n: 'Заказ любимой еды', cost: 100 },
    { id: uid(), n: 'Небольшая покупка до 1000 ₽', cost: 150 },
    { id: uid(), n: 'Полностью свободный вечер', cost: 80 },
    { id: uid(), n: 'Вечер Football Manager', cost: 100 },
  ];
}

/* ════════ 4. СОСТОЯНИЕ ПО УМОЛЧАНИЮ ════════ */

function defaultState() {
  return {
    version: 1,
    meta: { created: new Date().toISOString(), lastSaved: null, lastBackup: null },
    onboarded: false,
    screen: 'home',
    profile: {
      name: 'Герой', charName: 'HERO', city: 'Город N',
      job: 'Специалист', workHours: '09:00–18:00', freeHoursWeek: 5,
      goal12m: 'Пример цели: новый доход, новый навык, свобода от найма',
      babyDue: '',
    },
    settings: { theme: 'red', reviewDay: 0 /* воскресенье */, browserNotify: false },
    xp: { total: 0 },
    stats: { discipline: 20, intellect: 40, creativity: 35, tech: 20, communication: 70,
             finance: 25, health: 45, relations: 65, reputation: 15, endurance: 40 },
    gold: { balance: 0, history: [] },
    rewards: seedRewards(),
    days: {},           // 'YYYY-MM-DD' → { mode, energy, daily:[], active, minimal, note }
    streak: { current: 0, best: 0, lastActive: null, tokens: 1, pendingGap: 0 },
    quests: [],
    chapters: seedChapters(),
    skills: seedSkills(),
    projects: seedProjects(),
    content: [],
    contentStats: { subsGained: 0, tiktokSubs: 0, instaSubs: 0 },
    seasons: [seedSeason1()],
    finance: {
      incomes: [
        { id: uid(), n: 'Основной доход', sum: 50000 },
        { id: uid(), n: 'Доп. доход', sum: 20000 },
      ],
      fixedExpenses: [
        { id: uid(), n: 'Аренда / коммунальные', sum: 20000 },
        { id: uid(), n: 'Платёж 1', sum: 5000 },
        { id: uid(), n: 'Платёж 2', sum: 5000 },
      ],
      varExpenses: [
        { id: uid(), n: 'Еда', sum: 20000 },
        { id: uid(), n: 'Транспорт и прочее', sum: 8000 },
      ],
      debts: [
        { id: 'debt1', n: 'Кредит (пример)', balance: 50000, initialBalance: 50000, rate: 20,
          minPay: 5000, payDay: 10, priority: 1, history: [] },
        { id: 'debt2', n: 'Карта (пример)', balance: 30000, initialBalance: 30000, rate: 25,
          minPay: 3000, payDay: 1, priority: 2, history: [] },
      ],
      cushion: { goal: 100000, current: 0 },
      babyFund: { goal: 0, current: 0, items: [] },
      newIncome: [],   // {id, date, source, sum, type: content|service|product}
      extraPay: 3000,  // планируемый досрочный платёж в месяц (для сценария)
    },
    health: {},        // 'YYYY-MM-DD' → {sleep, energy, mood, steps, water, activity, note}
    fitness: { startWeight: 80, goalMin: 70, goalMax: 75, weights: [], measures: [], workouts: [], lastPhoto: null },
    family: {
      dates: [],
      log: [],         // {id, date, type, note} — время вдвоём, помощь, подготовка к ребёнку
      tasks: [],       // {id, t, done, cat}
    },
    ideas: [],
    reviews: [],
    achievements: {},  // id → dateUnlocked
    incomePathIncome: {}, // idx пути → фактический доход
    log: [],           // {d, xp, cat, note} — журнал начислений XP
    flags: { heroReturns: 0, offersSent: 0, leads: 0, debtFreezeDays: 0, practiceMinutes: 0, demoCleared: false },
    notices: { dismissed: {} },
  };
}

function seedSeason1() {
  return {
    id: 'season1', n: 'Сезон 1: Возвращение в систему',
    start: todayStr(), lengthDays: 30, status: 'active',
    goals: [
      { type: 'Карьера', t: 'Создать и начать ежедневно использовать PROJECT EGO', done: false },
      { type: 'Финансы', t: 'Не допустить роста долгов, начать фонд «Роды и ребёнок»', done: false },
      { type: 'Здоровье', t: 'Стабилизировать сон, отмечать энергию каждый день', done: false },
      { type: 'Семья', t: 'Сохранить время для жены и восстановления', done: false },
      { type: 'Контент', t: 'Создать первую единицу контента о своём пути', done: false },
    ],
    boss: {
      n: 'Хаос и незавершённость', hp: 100, maxHp: 100,
      actions: [
        { id: 'ba1', n: 'Заполнить первичную настройку', dmg: 10, done: false },
        { id: 'ba2', n: 'Определить недельные приоритеты', dmg: 10, done: false },
        { id: 'ba3', n: 'Выполнить 5 минимальных дней', dmg: 15, done: false, auto: 'minDays5' },
        { id: 'ba4', n: 'Пройти базовый блок HTML', dmg: 10, done: false },
        { id: 'ba5', n: 'Пройти базовый блок CSS', dmg: 10, done: false },
        { id: 'ba6', n: 'Создать мини-проект', dmg: 20, done: false },
        { id: 'ba7', n: 'Опубликовать первый контент после возвращения', dmg: 15, done: false, auto: 'firstContent' },
        { id: 'ba8', n: 'Провести недельный обзор', dmg: 10, done: false, auto: 'firstReview' },
      ],
      defeated: false,
    },
    summary: null,
  };
}

/* Демо-квесты (можно удалить в настройках) */
function seedDemoQuests() {
  const mk = (name, desc, cat, diff, opts = {}) => ({
    id: uid(), name, desc, cat, diff,
    xp: DIFF[diff].xp, gold: DIFF[diff].gold,
    time: opts.time || '', due: opts.due || '', repeat: opts.repeat || 'none',
    skill: opts.skill || '', project: opts.project || '',
    status: 'open', progress: 0, postponed: 0,
    mini: opts.mini || '', note: '', proof: '',
    created: todayStr(), doneAt: null, demo: true, subtasks: opts.subtasks || [],
  });
  return [
    mk('Пройти интерактивный урок по HTML (30 мин)', 'Например, первый блок HTML на любой бесплатной платформе. Минимум — 10 минут.', 'study', 'D',
      { skill: 'dev_html', mini: '10 минут чтения об HTML', time: '30 мин' }),
    mk('Написать 5 промптов для генерации обложек TikTok', 'В стиле тёмного минимализма с красными акцентами — как ты любишь.', 'career', 'E',
      { skill: 'ai_img', mini: '1 промпт', time: '15 мин' }),
    mk('Записать заметку: «почему я начал этот путь»', 'Это будущий сценарий первого ролика. Честно, без образа эксперта.', 'content', 'E',
      { skill: 'ct_script', mini: '3 предложения', time: '10 мин' }),
    mk('Проверить остатки по кредиту и карте', 'Обнови точные цифры в разделе «Финансы». Расчёты станут точнее.', 'finance', 'E',
      { mini: 'Проверить один долг', time: '10 мин' }),
    mk('Вечер без телефона с женой', 'Хотя бы 40 минут. Это тоже прогресс — и он учитывается в системе.', 'family', 'E',
      { mini: '20 минут', time: '40 мин' }),
  ];
}

/* ════════ 5. XP, УРОВНИ, ХАРАКТЕРИСТИКИ ════════ */

// XP, необходимый для перехода С уровня lvl НА lvl+1
function xpForLevel(lvl) { return Math.round(100 * Math.pow(lvl, 1.35)); }

// Текущий уровень и прогресс из общего XP
function levelInfo(totalXp = S.xp.total) {
  let lvl = 1, rest = totalXp;
  while (lvl < 50 && rest >= xpForLevel(lvl)) { rest -= xpForLevel(lvl); lvl++; }
  const need = lvl >= 50 ? 0 : xpForLevel(lvl);
  return { lvl, rest, need, pct: need ? Math.round(rest / need * 100) : 100 };
}

function rankFor(lvl) {
  let r = RANKS[0].name;
  for (const rk of RANKS) if (lvl >= rk.min) r = rk.name;
  return r;
}

function addXP(amount, cat = 'custom', note = '') {
  if (!amount) return;
  const before = levelInfo().lvl;
  S.xp.total += amount;
  S.log.push({ d: todayStr(), xp: amount, cat, note });
  const after = levelInfo().lvl;
  if (after > before) {
    toast(`⬆ Уровень ${after}! Звание: ${rankFor(after)}`, 'ok');
    if (after % 5 === 0) addTokens(1, 'Достигнут уровень ' + after);
  }
  applyStats(CAT_STATS[cat] || {});
}

function applyStats(delta) {
  for (const k of Object.keys(delta)) {
    if (k in S.stats) S.stats[k] = clamp(S.stats[k] + delta[k], 0, 100);
  }
}

function countLog(cat) { return S.log.filter(l => l.cat === cat).length; }

/* ════════ 6. GOLD И НАГРАДЫ ════════ */

function addGold(n, reason) {
  if (!n) return;
  S.gold.balance += n;
  S.gold.history.push({ d: todayStr(), sum: n, reason });
}
function spendGold(n, reason) {
  if (S.gold.balance < n) { toast('Недостаточно Gold. Заработай на квестах ⚔', 'warn'); return false; }
  S.gold.balance -= n;
  S.gold.history.push({ d: todayStr(), sum: -n, reason });
  return true;
}

/* ════════ 7. ДВИЖОК ДНЯ: РЕЖИМЫ, СЕРИИ, СТАБИЛЬНОСТЬ ════════ */

function getDay(date = todayStr()) {
  if (!S.days[date]) S.days[date] = { mode: null, energy: null, daily: [], active: false, minimal: false, note: '' };
  return S.days[date];
}

function setDayMode(mode, date = todayStr()) {
  const day = getDay(date);
  day.mode = mode;
  // генерируем задания дня из шаблона (сохраняем выполненные при смене режима)
  const doneNames = new Set(day.daily.filter(t => t.done).map(t => t.name));
  day.daily = DAY_TEMPLATES[mode].map(t => ({ id: uid(), ...t, done: doneNames.has(t.name) }));
  saveState();
}

function completeDailyTask(taskId, date = todayStr()) {
  const day = getDay(date);
  const t = day.daily.find(x => x.id === taskId);
  if (!t || t.done) return;
  t.done = true;
  addXP(t.xp, t.cat, 'Задание дня: ' + t.name);
  addGold(Math.round(t.xp / 3), 'Задание дня');
  if (t.cat === 'career' || t.cat === 'study' || t.cat === 'project') S.flags.practiceMinutes += 15;
  markDayActive(date);
  checkAchievements();
  saveState();
  toast(`✔ +${t.xp} XP, +${Math.round(t.xp / 3)} Gold`);
}

/* Минимальный день: карьера 10 мин + здоровье + семья/быт + отметка состояния.
   Даёт меньше XP, но сохраняет серию и стабильность. */
function completeMinimalDay(checks, energyVal, date = todayStr()) {
  const day = getDay(date);
  if (day.minimal) return;
  day.minimal = true;
  day.energy = energyVal ?? day.energy;
  const xp = 30; // меньше полноценного дня
  addXP(xp, 'recover', 'Минимальный день');
  addGold(10, 'Минимальный день');
  S.flags.practiceMinutes += 10;
  markDayActive(date);
  // счётчик минимальных дней для босс-действия
  const minDays = Object.values(S.days).filter(d => d.minimal).length;
  if (minDays >= 5) autoBossAction('minDays5');
  checkAchievements();
  saveState();
  toast('🌙 Минимальный день засчитан: +30 XP. Стабильность важнее подвига.', 'ok');
}

/* Активный день = хотя бы одно реальное действие. Управляет серией. */
function markDayActive(date = todayStr()) {
  const day = getDay(date);
  const first = !day.active;
  day.active = true;
  if (!first) return;
  const last = S.streak.lastActive;
  if (!last) {
    S.streak.current = 1;
  } else {
    const gap = dateDiffDays(last, date) - 1;
    if (gap <= 0) {
      if (dateDiffDays(last, date) === 1) S.streak.current++;
      // тот же день — ничего
    } else {
      // Пропуск. Механика «Возвращение героя»:
      // жетоны защиты покрывают пропущенные дни (1 жетон = до 2 дней);
      // без жетонов серия не обнуляется, а сохраняется на 60%.
      const tokensNeeded = Math.ceil(gap / 2);
      if (S.streak.tokens >= tokensNeeded) {
        S.streak.tokens -= tokensNeeded;
        S.streak.current++;
        toast(`🛡 Жетон защиты сохранил серию (${S.streak.current} дн.)`, 'ok');
      } else {
        S.streak.current = Math.max(1, Math.floor(S.streak.current * 0.6) + 1);
        toast('🦅 Возвращение героя: серия сохранена частично. Главное — ты вернулся.', 'ok');
      }
      S.flags.heroReturns++;
      addXP(20, 'story', 'Возвращение героя');
    }
  }
  S.streak.lastActive = date;
  S.streak.best = Math.max(S.streak.best, S.streak.current);
  // жетон за каждые 5 дней серии
  if (S.streak.current > 0 && S.streak.current % 5 === 0) addTokens(1, 'Серия ' + S.streak.current + ' дней');
}

function addTokens(n, reason) {
  const before = S.streak.tokens;
  S.streak.tokens = clamp(S.streak.tokens + n, 0, 3);
  if (S.streak.tokens > before) toast(`🛡 +${S.streak.tokens - before} жетон защиты (${reason})`, 'ok');
}

function activeDaysInLast(n, endDate = todayStr()) {
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(endDate); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (S.days[key] && S.days[key].active) cnt++;
  }
  return cnt;
}

function stability(n = 28) { return Math.round(activeDaysInLast(n) / n * 100); }

/* Пропущены ли дни с последней активности (для баннера «Возвращение героя») */
function missedDays() {
  if (!S.streak.lastActive) return 0;
  const gap = dateDiffDays(S.streak.lastActive, todayStr()) - 1;
  return Math.max(0, gap);
}

/* ════════ 8. КВЕСТЫ ════════ */

function createQuest(data) {
  const diff = data.diff || 'D';
  const q = {
    id: uid(), name: data.name || 'Без названия', desc: data.desc || '',
    cat: data.cat || 'custom', diff,
    xp: data.xp ?? DIFF[diff].xp, gold: data.gold ?? DIFF[diff].gold,
    time: data.time || '', due: data.due || '', repeat: data.repeat || 'none',
    skill: data.skill || '', project: data.project || '',
    status: 'open', progress: 0, postponed: 0,
    mini: data.mini || '', note: '', proof: '',
    created: todayStr(), doneAt: null, demo: false, subtasks: data.subtasks || [],
  };
  // Защита от саботажа: задача без срока и следующего шага помечается
  q.unstructured = !q.due && !q.desc && !q.mini;
  S.quests.push(q);
  saveState();
  return q;
}

function completeQuest(id, useMini = false) {
  const q = S.quests.find(x => x.id === id);
  if (!q || q.status === 'done') return;
  q.status = 'done';
  q.doneAt = todayStr();
  q.progress = 100;
  const mult = useMini ? 0.6 : 1;  // минимальная версия даёт 60% награды
  const xp = Math.round(q.xp * mult), gold = Math.round(q.gold * mult);
  addXP(xp, q.cat, 'Квест: ' + q.name);
  addGold(gold, 'Квест: ' + q.name);
  if (q.skill) addSkillXP(q.skill, Math.round(xp / 2), 'Квест: ' + q.name);
  if (q.project) bumpProject(q.project);
  if (['career', 'study', 'project'].includes(q.cat)) S.flags.practiceMinutes += parseTimeMin(q.time) || 20;
  markDayActive();
  // повторяющийся квест пересоздаётся
  if (q.repeat !== 'none') {
    const next = { ...q, id: uid(), status: 'open', progress: 0, doneAt: null, created: todayStr(),
      due: nextRepeatDate(q.repeat) };
    S.quests.push(next);
  }
  checkAchievements();
  saveState();
  toast(`⚔ Квест завершён: +${xp} XP, +${gold} Gold${useMini ? ' (минимальная версия)' : ''}`, 'ok');
}

function parseTimeMin(t) {
  const m = String(t || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
function nextRepeatDate(repeat) {
  return repeat === 'daily' ? todayStr(1) : repeat === 'weekly' ? todayStr(7) : todayStr(30);
}

function postponeQuest(id) {
  const q = S.quests.find(x => x.id === id);
  if (!q) return;
  q.postponed++;
  q.due = q.due ? todayStr(1) : '';
  if (q.postponed >= 3) {
    toast('⚠ Этот квест переносился уже ' + q.postponed + ' раза. Уменьши его, удали или пересмотри.', 'warn');
    q.unstructured = true;
  } else {
    toast('Квест перенесён на завтра');
  }
  saveState();
}

function deleteQuest(id) {
  S.quests = S.quests.filter(q => q.id !== id);
  saveState();
}

/* Квесты на сегодня: срок сегодня/просрочен или без срока и открыт */
function questsForToday() {
  const t = todayStr();
  return S.quests.filter(q => q.status === 'open' && (!q.due || q.due <= t));
}
function overdueQuests() {
  const t = todayStr();
  return S.quests.filter(q => q.status === 'open' && q.due && q.due < t);
}

/* ════════ 9. БОССЫ И СЕЗОНЫ ════════ */

function activeSeason() { return S.seasons.find(s => s.status === 'active') || null; }

function hitBoss(actionId) {
  const season = activeSeason();
  if (!season || season.boss.defeated) return;
  const a = season.boss.actions.find(x => x.id === actionId);
  if (!a || a.done) return;
  a.done = true;
  season.boss.hp = Math.max(0, season.boss.hp - a.dmg);
  addXP(a.dmg * 3, 'boss', 'Удар по боссу: ' + a.n);
  addGold(a.dmg, 'Босс: ' + a.n);
  markDayActive();
  if (season.boss.hp <= 0 && !season.boss.defeated) {
    season.boss.defeated = true;
    addXP(300, 'boss', 'Босс повержен: ' + season.boss.n);
    addGold(150, 'Победа над боссом');
    addTokens(1, 'Босс повержен');
    toast(`👹 БОСС ПОВЕРЖЕН: «${season.boss.n}»! +300 XP, +150 Gold`, 'ok');
  } else {
    toast(`🗡 −${a.dmg} HP боссу «${season.boss.n}» (${season.boss.hp}/${season.boss.maxHp})`);
  }
  checkAchievements();
  saveState();
}

/* Автоматические удары по боссу от событий системы */
function autoBossAction(key) {
  const season = activeSeason();
  if (!season) return;
  const a = season.boss.actions.find(x => x.auto === key && !x.done);
  if (a) hitBoss(a.id);
}

function seasonDaysLeft(season) {
  const end = new Date(season.start);
  end.setDate(end.getDate() + season.lengthDays);
  return Math.max(0, dateDiffDays(todayStr(), end.toISOString().slice(0, 10)));
}

function finishSeason(seasonId, summaryData) {
  const season = S.seasons.find(s => s.id === seasonId);
  if (!season) return;
  season.status = 'done';
  season.summary = summaryData;
  addXP(150, 'story', 'Сезон завершён: ' + season.n);
  addTokens(1, 'Сезон завершён');
  saveState();
  toast('🏁 Сезон завершён. Это не экзамен — это глава истории.', 'ok');
}

function startNewSeason(data) {
  const num = S.seasons.length + 1;
  S.seasons.push({
    id: 'season' + num, n: data.n || ('Сезон ' + num),
    start: todayStr(), lengthDays: data.lengthDays || 30, status: 'active',
    goals: data.goals || [],
    boss: data.boss || { n: data.bossName || 'Новый вызов', hp: 100, maxHp: 100, actions: data.bossActions || [], defeated: false },
    summary: null,
  });
  saveState();
}

/* ════════ 10. ГЛАВЫ ════════ */

function chapterProgress(ch) {
  const done = ch.goals.filter(g => g.done).length;
  return pct(done, ch.goals.length);
}
function currentChapter() {
  return S.chapters.find(c => chapterProgress(c) < 100) || S.chapters[S.chapters.length - 1];
}
function toggleChapterGoal(chId, idx) {
  const ch = S.chapters.find(c => c.id === chId);
  if (!ch) return;
  ch.goals[idx].done = !ch.goals[idx].done;
  if (ch.goals[idx].done) {
    addXP(40, 'career', 'Цель главы: ' + ch.goals[idx].t);
    markDayActive();
    if (chapterProgress(ch) === 100 && !ch.completedAt) {
      ch.completedAt = todayStr();
      addXP(200, 'story', ch.name + ' завершена');
      addGold(100, ch.name);
      toast(`📖 ${ch.name} завершена! Награда: ${ch.reward}`, 'ok');
    }
  }
  checkAchievements();
  saveState();
}

/* ════════ 11. НАВЫКИ ════════ */

function findSkill(id) {
  for (const br of S.skills) {
    const n = br.nodes.find(x => x.id === id);
    if (n) return n;
  }
  return null;
}
function skillLevelNeed(lvl) { return (lvl + 1) * 60; } // XP до следующего уровня навыка

function addSkillXP(id, xp, proofNote) {
  const sk = findSkill(id);
  if (!sk) return;
  sk.xp += xp;
  if (sk.status === 'available') sk.status = 'learning';
  if (proofNote) sk.proofs.push({ d: todayStr(), t: proofNote });
  while (sk.lvl < 10 && sk.xp >= skillLevelNeed(sk.lvl)) {
    sk.xp -= skillLevelNeed(sk.lvl);
    sk.lvl++;
    toast(`◈ Навык «${sk.name}» — уровень ${sk.lvl}/10`, 'ok');
  }
  // Освоенным навык считается только с практическим доказательством
  if (sk.lvl >= 7 && sk.proofs.length >= 3) sk.status = 'mastered';
  saveState();
}

function avgSkillLevel() {
  let sum = 0, n = 0;
  for (const br of S.skills) for (const node of br.nodes) { sum += node.lvl; n++; }
  return n ? sum / n : 0;
}

/* ════════ 12. ПРОЕКТЫ ════════ */

const PRJ_STATUSES = {
  idea: 'Идея', check: 'Проверка', planned: 'Запланирован', active: 'В работе',
  frozen: 'Заморожен', done: 'Завершён', published: 'Опубликован', monetized: 'Монетизируется',
};

function activeProjects() { return S.projects.filter(p => p.status === 'active'); }

function setProjectStatus(id, status) {
  const p = S.projects.find(x => x.id === id);
  if (!p) return false;
  if (status === 'active' && p.status !== 'active' && activeProjects().length >= 2) {
    modalInfo('Лимит активных проектов',
      'У тебя уже есть два активных проекта: <b>' + activeProjects().map(x => esc(x.name)).join('</b> и <b>') +
      '</b>.<br><br>Заверши, заморозь или откажись от одного из них. Распыление — главный убийца прогресса.');
    return false;
  }
  const wasNotDone = !['done', 'published', 'monetized'].includes(p.status);
  p.status = status;
  if (status === 'active' && !p.started) p.started = todayStr();
  if (['done', 'published', 'monetized'].includes(status) && wasNotDone) {
    addXP(250, 'project', 'Проект: ' + p.name);
    addGold(120, 'Проект завершён');
    markDayActive();
    toast('🛠 Проект «' + p.name + '» — статус: ' + PRJ_STATUSES[status] + '. +250 XP!', 'ok');
  }
  checkAchievements();
  saveState();
  return true;
}

function toggleProjectTask(prjId, idx) {
  const p = S.projects.find(x => x.id === prjId);
  if (!p) return;
  p.tasks[idx].done = !p.tasks[idx].done;
  if (p.tasks[idx].done) { addXP(25, 'project', p.name + ': ' + p.tasks[idx].t); markDayActive(); }
  checkAchievements();
  saveState();
}
function projectProgress(p) {
  if (['done', 'published', 'monetized'].includes(p.status)) return 100;
  if (!p.tasks.length) return 0;
  return pct(p.tasks.filter(t => t.done).length, p.tasks.length);
}
function bumpProject(id) {
  const p = S.projects.find(x => x.id === id);
  if (p) { const t = p.tasks.find(x => !x.done); if (t) t.done = true; }
}

/* ════════ 13. КОНТЕНТ ════════ */

const CONTENT_STATUSES = {
  idea: 'Идея', script: 'Сценарий', shot: 'Снято', edited: 'Смонтировано',
  ready: 'Готово', published: 'Опубликовано', analyzed: 'Проанализировано', reworked: 'Переработано',
};
const RUBRICS = [
  'Путь бариста к AI-создателю', 'Создание проекта с помощью AI', 'Ошибки новичка в Vibe Coding',
  'До/после автоматизации', 'Генерация изображений и дизайн', 'Игровые и аниме-сравнения',
  'Итоги недели', 'Честный прогресс',
];
const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Telegram', 'Twitch'];

function createContent(data) {
  const c = {
    id: uid(), topic: data.topic || '', rubric: data.rubric || RUBRICS[0],
    platform: data.platform || 'TikTok', format: data.format || 'Короткий ролик',
    hook: data.hook || '', script: data.script || '', project: data.project || '',
    status: data.status || 'idea', created: todayStr(), published: null,
    views: 0, likes: 0, comments: 0, saves: 0, subs: 0,
    notes: '', worked: '', improve: '', demo: !!data.demo,
  };
  S.content.push(c);
  saveState();
  return c;
}

function setContentStatus(id, status) {
  const c = S.content.find(x => x.id === id);
  if (!c) return;
  const wasPublished = ['published', 'analyzed', 'reworked'].includes(c.status);
  c.status = status;
  if (status === 'published' && !wasPublished) {
    c.published = todayStr();
    addXP(80, 'content', 'Публикация: ' + c.topic);
    addGold(30, 'Публикация');
    markDayActive();
    autoBossAction('firstContent');
    toast('🎬 Опубликовано! +80 XP. Контент — побочный продукт твоего пути.', 'ok');
  }
  checkAchievements();
  saveState();
}

function publishedCount() {
  return S.content.filter(c => ['published', 'analyzed', 'reworked'].includes(c.status)).length;
}
function publishedInLast(days) {
  const from = todayStr(-days);
  return S.content.filter(c => c.published && c.published >= from).length;
}
function bestContent() {
  let best = null;
  for (const c of S.content) if (c.views > 0 && (!best || c.views > best.views)) best = c;
  return best;
}
/* Рекомендуемый этап контента (постепенное наращивание) */
function contentStage() {
  const total = publishedCount();
  if (total < 8) return { stage: 1, target: '1–2 ролика в неделю' };
  if (total < 20) return { stage: 2, target: '2–3 ролика в неделю' };
  return { stage: 3, target: '3–4 ролика в неделю (если нет перегрузки)' };
}

/* ════════ 14. ФИНАНСЫ ════════ */

function totalDebt() { return S.finance.debts.reduce((s, d) => s + Math.max(0, d.balance), 0); }
function initialDebt() { return S.finance.debts.reduce((s, d) => s + (d.initialBalance || 0), 0); }
function newIncomeTotal() { return S.finance.newIncome.reduce((s, i) => s + i.sum, 0); }
function newIncomeInLast(days) {
  const from = todayStr(-days);
  return S.finance.newIncome.filter(i => i.date >= from).reduce((s, i) => s + i.sum, 0);
}

/* Оценочный расчёт погашения долга (аннуитетная логика упрощена).
   ВАЖНО: это ориентир, не банковский расчёт. */
function debtProjection(debt, extraMonthly = 0) {
  let bal = debt.balance, months = 0, interest = 0;
  const monthlyRate = debt.rate / 100 / 12;
  const pay = debt.minPay + extraMonthly;
  if (pay <= bal * monthlyRate) return { months: Infinity, interest: Infinity };
  while (bal > 0 && months < 360) {
    const int = bal * monthlyRate;
    interest += int;
    bal = bal + int - pay;
    months++;
  }
  return { months, interest: Math.round(interest) };
}

function recordDebtPayment(debtId, sum, extra = 0) {
  const d = S.finance.debts.find(x => x.id === debtId);
  if (!d) return;
  // упрощение: часть платежа уходит на проценты этого месяца
  d.balance = Math.max(0, d.balance - Math.max(0, sum - d.balance * d.rate / 100 / 12));
  d.history.push({ d: todayStr(), sum, extra, balanceAfter: Math.round(d.balance) });
  addXP(extra > 0 ? 60 : 30, 'finance', 'Платёж по долгу: ' + d.n);
  addGold(extra > 0 ? 25 : 10, 'Платёж по долгу');
  markDayActive();
  if (d.balance <= 0) {
    toast('🔓 Долг «' + d.n + '» ЗАКРЫТ! Это огромный шаг к свободе.', 'ok');
    addXP(400, 'finance', 'Долг закрыт: ' + d.n);
  }
  checkAchievements();
  saveState();
}

function nextPayment() {
  const today = new Date();
  let best = null;
  for (const d of S.finance.debts) {
    if (d.balance <= 0) continue;
    const pd = new Date(today.getFullYear(), today.getMonth(), d.payDay);
    if (pd < today) pd.setMonth(pd.getMonth() + 1);
    const days = Math.round((pd - today) / 86400000);
    if (!best || days < best.days) best = { debt: d, days, date: pd };
  }
  return best;
}

function monthBalance() {
  const inc = S.finance.incomes.reduce((s, i) => s + i.sum, 0);
  const exp = S.finance.fixedExpenses.reduce((s, i) => s + i.sum, 0)
            + S.finance.varExpenses.reduce((s, i) => s + i.sum, 0);
  return { inc, exp, free: inc - exp };
}

/* ════════ 15. ЗДОРОВЬЕ ════════ */

function saveHealth(date, data) {
  S.health[date] = { ...(S.health[date] || {}), ...data };
  const day = getDay(date);
  if (data.energy) day.energy = data.energy;
  applyStats({ health: 1 });
  saveState();
}

function avgEnergy(days = 14) {
  let sum = 0, n = 0;
  for (let i = 0; i < days; i++) {
    const key = todayStr(-i);
    const e = (S.health[key] && S.health[key].energy) || (S.days[key] && S.days[key].energy);
    if (e) { sum += e; n++; }
  }
  return n ? sum / n : 0;
}

/* Три дня подряд энергия < 4 → мягкое предупреждение */
function lowEnergyStreak() {
  let cnt = 0;
  for (let i = 0; i < 7; i++) {
    const key = todayStr(-i);
    const e = (S.health[key] && S.health[key].energy) || (S.days[key] && S.days[key].energy);
    if (e && e < 4) cnt++; else break;
  }
  return cnt;
}

/* ════════ 16. СЕМЬЯ ════════ */

function logFamily(type, note) {
  S.family.log.push({ id: uid(), date: todayStr(), type, note: note || '' });
  addXP(15, 'family', type);
  markDayActive();
  applyStats({ relations: 2 });
  checkAchievements();
  saveState();
}
function familyActionsInLast(days) {
  const from = todayStr(-days);
  return S.family.log.filter(l => l.date >= from).length;
}
/* Стратегия неустойчива, если карьера идёт каждый день, а семья — ноль */
function unsustainableWarning() {
  const from = todayStr(-7);
  const careerDays = new Set(S.log.filter(l => l.d >= from && ['career', 'study', 'project'].includes(l.cat)).map(l => l.d)).size;
  const fam = familyActionsInLast(7);
  const energy = avgEnergy(7);
  if (careerDays >= 5 && fam === 0) return 'За неделю много карьерных действий и ни одного семейного. Это неустойчивая стратегия — семья имеет вес в общем прогрессе.';
  if (careerDays >= 5 && energy > 0 && energy < 4) return 'Карьера идёт активно, но энергия всю неделю низкая. Сократи нагрузку — выгорание отбросит назад сильнее, чем отдых.';
  return null;
}

/* ════════ 17. ИДЕИ ════════ */

function addIdea(data) {
  S.ideas.push({ id: uid(), t: data.t, cat: data.cat || 'Прочее', benefit: data.benefit || '',
    cost: data.cost || '', date: todayStr(), decision: 'later', demo: !!data.demo });
  saveState();
}

/* ════════ 18. НЕДЕЛЬНЫЙ ОБЗОР ════════ */

const REVIEW_QUESTIONS = [
  ['doneWhat', 'Что было завершено?'],
  ['mainResult', 'Какой результат недели самый важный?'],
  ['notDone', 'Что не было выполнено?'],
  ['whyNot', 'Почему это не было выполнено?'],
  ['rootCause', 'Проблема была в дисциплине, времени, энергии или неверном плане?'],
  ['learned', 'Чему я научился?'],
  ['portfolioValue', 'Что принесло пользу для портфолио или дохода?'],
  ['contentIdeas', 'Что можно превратить в контент?'],
  ['stopDoing', 'Что нужно прекратить делать?'],
  ['top3', 'Какие 3 приоритетные цели на следующую неделю?'],
  ['familyState', 'Как чувствует себя семья?'],
  ['bodyState', 'Как чувствует себя тело?'],
  ['overload', 'Не слишком ли велика нагрузка?'],
];
const REVIEW_SCORES = ['Дисциплина', 'Энергия', 'Карьера', 'Деньги', 'Семья', 'Здоровье', 'Контент'];

function saveReview(answers, scores) {
  const r = { id: uid(), date: todayStr(), answers, scores };
  // авто-резюме недели
  const week = activeDaysInLast(7);
  const quests = S.quests.filter(q => q.doneAt && q.doneAt >= todayStr(-7)).length;
  const pubs = publishedInLast(7);
  r.summary = `Активных дней: ${week}/7 · Квестов: ${quests} · Публикаций: ${pubs} · ` +
    `Средняя оценка: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}/10. ` +
    (answers.mainResult ? 'Главное: ' + answers.mainResult : '');
  S.reviews.push(r);
  addXP(70, 'weekly', 'Недельный обзор');
  addGold(30, 'Недельный обзор');
  addTokens(1, 'Недельный обзор');
  markDayActive();
  autoBossAction('firstReview');
  checkAchievements();
  saveState();
  return r;
}

function reviewDueToday() {
  const today = new Date();
  if (today.getDay() !== S.settings.reviewDay) return false;
  const t = todayStr();
  return !S.reviews.some(r => r.date === t);
}

/* Три недели подряд < 40% плана → предложить снизить нагрузку */
function chronicUnderload() {
  if (S.reviews.length < 3) return false;
  const last3 = S.reviews.slice(-3);
  return last3.every(r => {
    const avg = r.scores.reduce((a, b) => a + b, 0) / r.scores.length;
    return avg < 4;
  });
}

/* ════════ 19. ДОСТИЖЕНИЯ ════════ */

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (S.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(S); } catch (e) { /* защита от ошибок в проверках */ }
    if (ok) {
      S.achievements[a.id] = todayStr();
      addXP(50, 'story', 'Достижение: ' + a.n);
      addGold(25, 'Достижение');
      toast(`🏆 Достижение: «${a.n}»`, 'ok');
    }
  }
}

/* ════════ 20. ФОРМУЛА «ПУТЬ К СВОБОДЕ» ════════
   Взвешенная сумма 9 направлений (в сумме 100%):
   навыки 15 · портфолио 12 · новые доходы 15 · дисциплина 10 ·
   долги 15 · подушка 12 · контент 8 · здоровье 6 · семья 7 */
function freedomProgress() {
  const skills = clamp(avgSkillLevel() / 7, 0, 1);                       // средний навык до 7/10
  const portfolio = clamp(S.projects.filter(p => ['done', 'published', 'monetized'].includes(p.status)).length / 3, 0, 1);
  const income = clamp(newIncomeInLast(90) / 150000, 0, 1);              // 150 тыс. за 3 мес доп. дохода
  const discipline = stability(28) / 100;
  const debts = initialDebt() > 0 ? clamp(1 - totalDebt() / initialDebt(), 0, 1) : 1;
  const cushion = S.finance.cushion.goal > 0 ? clamp(S.finance.cushion.current / S.finance.cushion.goal, 0, 1) : 0;
  const content = clamp(publishedCount() / 30, 0, 1);
  const health = clamp(avgEnergy(14) / 8, 0, 1);
  const family = clamp(familyActionsInLast(28) / 12, 0, 1);
  const parts = { skills, portfolio, income, discipline, debts, cushion, content, health, family };
  const total = skills * 15 + portfolio * 12 + income * 15 + discipline * 10 +
    debts * 15 + cushion * 12 + content * 8 + health * 6 + family * 7;
  return { total: Math.round(total), parts };
}

/* ════════ 21. ВНУТРЕННИЕ УВЕДОМЛЕНИЯ ════════ */

function systemNotices() {
  const list = [];
  const pay = nextPayment();
  if (pay && pay.days <= 5) list.push({ ico: '💳', t: `Платёж «${pay.debt.n}» ${fmtMoney(pay.debt.minPay)} через ${pay.days} дн. (${pay.date.toLocaleDateString('ru-RU')})`, key: 'pay' + pay.debt.id + pay.date.getMonth() });
  const od = overdueQuests();
  if (od.length) list.push({ ico: '⏰', t: `Просроченных квестов: ${od.length}. Перенеси или уменьши их — не тащи хвост.`, key: 'overdue' });
  if (reviewDueToday()) list.push({ ico: '📋', t: 'Сегодня день недельного обзора. 10 минут — и неделя сложится в картину.', key: 'review' + todayStr() });
  const stale = S.projects.filter(p => p.status === 'active' && projectProgress(p) < 100 && p.started && dateDiffDays(p.started, todayStr()) > 21 && projectProgress(p) < 30);
  if (stale.length) list.push({ ico: '🧊', t: `Проект «${stale[0].name}» три недели почти без движения. Продолжить, заморозить или уменьшить?`, key: 'stale' + stale[0].id });
  const gap = missedDays();
  if (gap >= 1) list.push({ ico: '🦅', t: `Тебя не было ${gap} дн. Никакого провала — выполни одно действие, и серия сохранится (механика «Возвращение героя»).`, key: 'gap' + todayStr() });
  const les = lowEnergyStreak();
  if (les >= 3) list.push({ ico: '🌫', t: 'Энергия ниже 4/10 уже ' + les + ' дня подряд. Сократи задачи, включи восстановительный день, проверь сон. Если есть тревожные симптомы — к врачу.', key: 'lowe' + todayStr() });
  if (!S.meta.lastBackup || dateDiffDays(S.meta.lastBackup.slice(0, 10), todayStr()) > 14) {
    list.push({ ico: '💾', t: 'Резервной копии не было больше двух недель. Экспортируй JSON в настройках.', key: 'backup' });
  }
  for (const d of S.family.dates) {
    const diff = dateDiffDays(todayStr(), d.date);
    if (diff >= 0 && diff <= 14) list.push({ ico: '📅', t: `«${d.n}» — через ${diff} дн. (${fmtDate(d.date)})`, key: 'date' + d.id });
  }
  const uw = unsustainableWarning();
  if (uw) list.push({ ico: '⚠', t: uw, key: 'unsust' + todayStr().slice(0, 7) });
  const F = S.fitness;
  if (F) {
    const weekNum = Math.floor(dateDiffDays('2026-01-01', todayStr()) / 7);
    const lastWeight = F.weights.length ? F.weights[F.weights.length - 1].d : null;
    if (!lastWeight || dateDiffDays(lastWeight, todayStr()) >= 7)
      list.push({ ico: '⚖', t: 'Пора взвеситься — раз в неделю, в одно и то же время (раздел «Здоровье»).', key: 'weight' + weekNum });
    if (!F.lastPhoto || dateDiffDays(F.lastPhoto, todayStr()) >= 14)
      list.push({ ico: '📸', t: 'Фото прогресса раз в 2 недели: спереди, сбоку, сзади. Зеркало врёт, фото — нет.', key: 'photo' + Math.floor(weekNum / 2) });
  }
  if (chronicUnderload()) list.push({ ico: '🪶', t: 'Три недели подряд план выполняется меньше чем на 40%. Это не лень — план слишком большой. Уменьши его.', key: 'under' });
  return list.filter(n => !S.notices.dismissed[n.key]);
}

/* ════════ 22. SVG-ГРАФИКИ (без библиотек) ════════ */

function svgLine(data, { w = 600, h = 160, color = 'var(--accent)', fill = true } = {}) {
  if (!data.length) return '<div class="empty">Нет данных</div>';
  const max = Math.max(...data.map(d => d.v), 1);
  const stepX = w / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [i * stepX, h - 14 - (d.v / max) * (h - 30)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${w},${h - 14} L0,${h - 14} Z`;
  const labels = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}">
    <line x1="0" y1="${h - 14}" x2="${w}" y2="${h - 14}" stroke="var(--line)"/>
    ${fill ? `<path d="${area}" fill="${color}" opacity=".12"/>` : ''}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.length <= 40 ? pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${color}"/>`).join('') : ''}
    <text x="2" y="${h - 2}" fill="var(--text3)" font-size="10">${esc(labels[0].l)}</text>
    <text x="${w / 2}" y="${h - 2}" fill="var(--text3)" font-size="10" text-anchor="middle">${esc(labels[1].l)}</text>
    <text x="${w - 2}" y="${h - 2}" fill="var(--text3)" font-size="10" text-anchor="end">${esc(labels[2].l)}</text>
    <text x="2" y="12" fill="var(--text3)" font-size="10">макс: ${max}</text>
  </svg></div>`;
}

function svgBars(data, { w = 600, h = 160, color = 'var(--accent)' } = {}) {
  if (!data.length) return '<div class="empty">Нет данных</div>';
  const max = Math.max(...data.map(d => d.v), 1);
  const bw = Math.max(2, w / data.length - 3);
  const bars = data.map((d, i) => {
    const bh = (d.v / max) * (h - 30);
    return `<rect x="${(i * (w / data.length)).toFixed(1)}" y="${(h - 14 - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity="${d.v ? '.9' : '.15'}"/>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}">
    <line x1="0" y1="${h - 14}" x2="${w}" y2="${h - 14}" stroke="var(--line)"/>
    ${bars}
    <text x="2" y="${h - 2}" fill="var(--text3)" font-size="10">${esc(data[0].l)}</text>
    <text x="${w - 2}" y="${h - 2}" fill="var(--text3)" font-size="10" text-anchor="end">${esc(data[data.length - 1].l)}</text>
    <text x="2" y="12" fill="var(--text3)" font-size="10">макс: ${max}</text>
  </svg></div>`;
}

/* Радар характеристик */
function svgRadar(stats) {
  const keys = Object.keys(STAT_NAMES);
  const cx = 150, cy = 130, R = 95;
  const pt = (i, r) => {
    const a = Math.PI * 2 * i / keys.length - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const grid = [0.33, 0.66, 1].map(f =>
    '<polygon points="' + keys.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(',')).join(' ') + '" fill="none" stroke="var(--line)"/>').join('');
  const poly = keys.map((k, i) => pt(i, R * clamp(stats[k], 0, 100) / 100).map(v => v.toFixed(1)).join(',')).join(' ');
  const labels = keys.map((k, i) => {
    const [x, y] = pt(i, R + 16);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="var(--text3)" font-size="8.5" text-anchor="middle">${esc(STAT_NAMES[k].split(' ')[0])}</text>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 300 265">
    ${grid}
    <polygon points="${poly}" fill="var(--accent)" opacity=".22" stroke="var(--accent)" stroke-width="2"/>
    ${labels}
  </svg></div>`;
}

/* ════════ 23. РЕНДЕР ЭКРАНОВ ════════ */

function toast(msg, type = '') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg; // textContent, не innerHTML: имена квестов/проектов вводит пользователь
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3400);
  setTimeout(() => el.remove(), 3900);
}

function renderHud() {
  const li = levelInfo();
  $('#hudAvatar').textContent = li.lvl;
  $('#hudName').textContent = S.profile.charName || S.profile.name;
  $('#hudRank').textContent = rankFor(li.lvl) + ' · ур. ' + li.lvl;
  $('#hudXpFill').style.width = li.pct + '%';
  $('#hudXpText').textContent = li.lvl >= 50 ? 'Максимальный уровень' : `${li.rest} / ${li.need} XP до уровня ${li.lvl + 1}`;
  $('#hudGold').textContent = '◈ ' + S.gold.balance;
  $('#hudTokens').textContent = '🛡 ' + S.streak.tokens;
  $('#hudStreak').textContent = '⚡ ' + S.streak.current;
}

function renderNav() {
  $('#nav').innerHTML = NAV_ITEMS.map(i => `
    <div class="nav-item ${S.screen === i.key ? 'active' : ''}" data-nav="${i.key}">
      <span class="nav-ico">${i.ico}</span><span>${i.n}</span>
    </div>`).join('');
  $$('#nav .nav-item').forEach(el => el.onclick = () => go(el.dataset.nav));
}

function go(screen) {
  S.screen = screen;
  saveState();
  renderAll();
  $('#screen').scrollTop = 0;
}

function renderAll() {
  renderHud();
  renderNav();
  const R = {
    home: rHome, today: rToday, quests: rQuests, career: rCareer, skills: rSkills,
    projects: rProjects, content: rContent, finance: rFinance, health: rHealth,
    family: rFamily, analytics: rAnalytics, achieve: rAchieve, settings: rSettings,
  };
  (R[S.screen] || rHome)();
}

/* ── Главная ── */
function rHome() {
  const day = getDay();
  const fp = freedomProgress();
  const season = activeSeason();
  const ch = currentChapter();
  const pay = nextPayment();
  const notices = systemNotices();
  const gap = missedDays();
  const hint = 'Формула: навыки 15% + портфолио 12% + новые доходы 15% + дисциплина 10% + долги 15% + подушка 12% + контент 8% + здоровье 6% + семья 7%';

  // Короткое сообщение системы — одно, по контексту
  let sysMsg;
  if (gap >= 1) sysMsg = 'Система не сгорела за время отсутствия. Одно действие — и ты снова в строю.';
  else if (day.mode === 'low') sysMsg = 'Сегодня достаточно минимума. Минимум — тоже победа.';
  else if (day.mode === 'recover') sysMsg = 'Восстановление — часть тренировки. Герои тоже спят.';
  else if (S.streak.current >= 5) sysMsg = `Серия ${S.streak.current} дней. Ровный темп сильнее рывков.`;
  else sysMsg = 'Лучше выполнить минимум, чем сорвать идеальный план.';

  // ФОКУС: одно следующее действие, чтобы взгляду было за что зацепиться
  const nextDaily = day.daily.find(t => !t.done);
  const mainQuest = questsForToday()[0];
  let focusHtml;
  if (!day.mode) {
    focusHtml = `<div class="card-title">Фокус</div>
      <div style="font-size:17px;font-weight:700;margin-bottom:10px">Какой сегодня день?</div>
      <div class="card-note" style="margin-bottom:10px">Один честный ответ — и система сама уберёт лишнее.</div>
      <button class="btn primary" data-act="pickMode">Выбрать режим дня</button>`;
  } else if (nextDaily) {
    focusHtml = `<div class="card-title">Фокус · ${MODES[day.mode].ico} ${MODES[day.mode].n}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:10px">${esc(nextDaily.name)}</div>
      <div class="btn-row" style="margin:0">
        <button class="btn primary" data-focusdone="${nextDaily.id}">✔ Сделал · +${nextDaily.xp} XP</button>
        <button class="btn ghost small" data-act="goToday">все задания</button>
        <button class="btn ghost small" data-act="minDay">🌙 минимальный день</button>
      </div>`;
  } else if (mainQuest) {
    focusHtml = `<div class="card-title">Фокус · задания дня выполнены ✔</div>
      <div class="card-note" style="margin-bottom:6px">Если есть силы — главный квест:</div>
      ${questCard(mainQuest, true)}`;
  } else {
    focusHtml = `<div class="card-title">Фокус</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">На сегодня — всё ✔</div>
      <div class="card-note">Отдых — часть системы. Хочешь ещё — раздел «Квесты».</div>`;
  }

  // Уведомления: показываем одно, остальные — свёрнуты
  const noticesHtml = !notices.length ? '' : `
    <div class="warn-box" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:${notices.length > 1 ? '6' : '12'}px">
      <span>${notices[0].ico}</span><span style="flex:1">${esc(notices[0].t)}</span>
      <button class="iconbtn" data-dismiss="${notices[0].key}" title="Скрыть">✕</button>
    </div>
    ${notices.length > 1 ? `<details class="adv" style="margin:0 0 12px">
      <summary>ещё уведомлений: ${notices.length - 1}</summary>
      ${notices.slice(1).map(n => `<div style="display:flex;gap:8px;font-size:12.5px;color:var(--text2);padding:5px 0;align-items:flex-start">
        <span>${n.ico}</span><span style="flex:1">${esc(n.t)}</span>
        <button class="iconbtn" data-dismiss="${n.key}" title="Скрыть">✕</button></div>`).join('')}
    </details>` : ''}`;

  $('#screen').innerHTML = `
    <h1 class="screen-title">${esc(S.profile.charName)}</h1>
    <div class="screen-sub">${esc(ch.name)}${season ? ' · ' + esc(season.n) + ' · ' + seasonDaysLeft(season) + ' дн.' : ''}</div>
    ${gap >= 1 ? `<div class="warn-box">🦅 Пропущено ${gap} дн. Одно действие сегодня — и серия сохранится. Без чувства вины.</div>` : ''}
    ${noticesHtml}

    <div class="card accent" style="margin-bottom:12px">${focusHtml}</div>

    <div class="grid cols3" style="margin-bottom:12px">
      <div class="card">
        <div class="card-title">Путь к свободе <span class="kbd" title="${esc(hint)}">?</span></div>
        <div class="card-big" style="font-size:22px">${fp.total}%</div>
        <div class="bar" style="margin-top:6px"><div class="bar-fill" style="width:${fp.total}%"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Стабильность 28 дн</div>
        <div class="card-big" style="font-size:22px">${stability(28)}%</div>
        <div class="card-note">⚡ серия ${S.streak.current} · 🛡 ${S.streak.tokens}/3</div>
      </div>
      <div class="card">
        <div class="card-title">Сегодня</div>
        <div class="card-big" style="font-size:22px">${day.daily.filter(t => t.done).length}/${day.daily.length || '—'}</div>
        <div class="card-note">${day.mode ? MODES[day.mode].n : 'режим не выбран'} · энергия ${day.energy ? day.energy + '/10' : '—'}</div>
      </div>
    </div>

    ${season && !season.boss.defeated ? `
    <div class="boss" style="margin-bottom:12px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div class="boss-name" style="font-size:14px">👹 ${esc(season.boss.n)}</div>
        <span class="tag">${season.boss.hp}/${season.boss.maxHp} HP · бить на экране «Карьера»</span>
      </div>
      <div class="boss-hpbar" style="height:9px;margin:8px 0 0"><div class="boss-hpfill" style="width:${pct(season.boss.hp, season.boss.maxHp)}%"></div></div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Система</div>
      <div style="font-size:13px;color:var(--text2);border-left:2px solid var(--accent);padding-left:10px;margin-bottom:8px">${esc(sysMsg)}</div>
      ${pay ? `<div class="card-note">💳 ${esc(pay.debt.n)}: ${fmtMoney(pay.debt.minPay)} через ${pay.days} дн.</div>` : ''}
      ${S.family.dates[0] ? `<div class="card-note">📅 ${esc(S.family.dates[0].n)}: ${fmtDate(S.family.dates[0].date)}</div>` : ''}
      <div class="card-note">Глава: ${chapterProgress(ch)}% · Финансовая готовность: ${Math.round(fp.parts.debts * 50 + fp.parts.cushion * 50)}% · Характеристики — в «Аналитике»</div>
    </div>`;

  $$('[data-dismiss]').forEach(b => b.onclick = () => { S.notices.dismissed[b.dataset.dismiss] = true; saveState(); renderAll(); });
  $$('[data-focusdone]').forEach(b => b.onclick = () => { completeDailyTask(b.dataset.focusdone); renderAll(); });
  bindCommon();
}

/* Карточка квеста (общая) */
function questCard(q, compact = false) {
  return `
  <div class="quest ${q.status === 'done' ? 'done' : ''}" data-qid="${q.id}">
    <div class="quest-check" data-qdone="${q.id}" title="Завершить">✔</div>
    <div class="quest-body">
      <div class="quest-name">${esc(q.name)} ${q.unstructured ? '<span class="tag" title="Нет срока или следующего шага — уточни">неструктурир.</span>' : ''}</div>
      ${q.desc && !compact ? `<div class="quest-desc">${esc(q.desc)}</div>` : ''}
      <div class="quest-meta">
        <span class="tag rank-${q.diff}">${q.diff}</span>
        <span class="tag">${CATS[q.cat] ? CATS[q.cat].ico + ' ' + CATS[q.cat].n : q.cat}</span>
        <span class="tag xp">+${q.xp} XP</span>
        <span class="tag gold">+${q.gold} ◈</span>
        ${q.time ? `<span class="tag">⏱ ${esc(q.time)}</span>` : ''}
        ${q.due ? `<span class="tag" style="${q.due < todayStr() && q.status === 'open' ? 'color:var(--danger)' : ''}">📅 ${fmtDate(q.due)}</span>` : ''}
        ${q.repeat !== 'none' ? '<span class="tag">🔁</span>' : ''}
        ${q.mini && q.status === 'open' ? `<span class="tag" title="Минимальная версия: ${esc(q.mini)}">🌙 есть минимум</span>` : ''}
      </div>
      ${q.subtasks && q.subtasks.length ? `<div style="margin-top:6px">${q.subtasks.map((st, i) => `
        <label style="display:flex;gap:6px;font-size:12px;color:var(--text2);cursor:pointer">
          <input type="checkbox" data-qsub="${q.id}:${i}" ${st.done ? 'checked' : ''}> ${esc(st.t)}</label>`).join('')}</div>` : ''}
    </div>
    ${q.status === 'open' ? `<div class="quest-actions">
      ${q.mini ? `<button class="iconbtn" data-qmini="${q.id}" title="Выполнить минимальную версию (60% награды): ${esc(q.mini)}">🌙</button>` : ''}
      <button class="iconbtn" data-qedit="${q.id}" title="Редактировать">✎</button>
      <button class="iconbtn" data-qlater="${q.id}" title="Перенести на завтра">↷</button>
      <button class="iconbtn" data-qdel="${q.id}" title="Удалить">✕</button>
    </div>` : ''}
  </div>`;
}

function bindQuestCards() {
  $$('[data-qdone]').forEach(el => el.onclick = () => { completeQuest(el.dataset.qdone); renderAll(); });
  $$('[data-qmini]').forEach(el => el.onclick = () => { completeQuest(el.dataset.qmini, true); renderAll(); });
  $$('[data-qlater]').forEach(el => el.onclick = () => { postponeQuest(el.dataset.qlater); renderAll(); });
  $$('[data-qdel]').forEach(el => el.onclick = () => confirmModal('Удалить квест?', 'Действие нельзя отменить.', () => { deleteQuest(el.dataset.qdel); renderAll(); }));
  $$('[data-qedit]').forEach(el => el.onclick = () => questModal(S.quests.find(q => q.id === el.dataset.qedit)));
  $$('[data-qsub]').forEach(el => el.onchange = () => {
    const [qid, idx] = el.dataset.qsub.split(':');
    const q = S.quests.find(x => x.id === qid);
    if (q) { q.subtasks[+idx].done = el.checked; q.progress = pct(q.subtasks.filter(s => s.done).length, q.subtasks.length); saveState(); }
  });
}

function bindCommon() {
  $$('[data-act]').forEach(el => {
    const act = el.dataset.act;
    el.onclick = () => {
      if (act === 'pickMode') dayModeModal();
      if (act === 'goToday') go('today');
      if (act === 'minDay') minimalDayModal();
      if (act === 'newQuest') questModal();
      if (act === 'newIdea') ideaModal();
      if (act === 'review') reviewModal();
    };
  });
  bindQuestCards();
}

/* ── Сегодня ── */
function rToday() {
  const day = getDay();
  const todayQuests = questsForToday().slice(0, 8);
  const gap = missedDays();
  $('#screen').innerHTML = `
    <h1 class="screen-title">Сегодня · ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
    <div class="screen-sub">Максимум 3 главных задачи. Лучше минимум, чем сорванный идеал.</div>

    ${gap >= 1 ? `<div class="warn-box">🦅 <b>Возвращение героя.</b> Ты пропустил ${gap} дн. Это не провал — выполни любое одно действие сегодня, и серия сохранится${S.streak.tokens > 0 ? ' (есть жетоны защиты 🛡' + S.streak.tokens + ')' : ' (жетонов нет, но серия сохранится на 60%)'}. </div>` : ''}

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Режим дня</div>
      ${day.mode ? `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:22px">${MODES[day.mode].ico}</span>
          <div style="flex:1"><b>${MODES[day.mode].n}</b><div class="card-note">${MODES[day.mode].d}</div></div>
          <button class="btn small" data-act="pickMode">Сменить</button>
        </div>` : `
        <div class="card-note" style="margin-bottom:8px">Какой сегодня день? Это определит нагрузку.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${Object.keys(MODES).map(m => `
          <div class="mode-btn" data-mode="${m}">
            <div class="mi">${MODES[m].ico}</div><div class="mn">${MODES[m].n}</div><div class="md">${MODES[m].d}</div>
          </div>`).join('')}</div>`}
      <div style="margin-top:12px">
        <div class="card-note">Энергия сейчас:</div>
        <div class="energy-row">${[1,2,3,4,5,6,7,8,9,10].map(v => `
          <div class="energy-dot ${day.energy === v ? 'sel' : ''}" data-energy="${v}">${v}</div>`).join('')}</div>
      </div>
    </div>

    ${day.mode ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Задания дня (${day.daily.filter(t => t.done).length}/${day.daily.length})</div>
      ${day.daily.map(t => `
        <div class="quest ${t.done ? 'done' : ''}">
          <div class="quest-check ${t.done ? 'done' : ''}" data-daily="${t.id}">✔</div>
          <div class="quest-body">
            <div class="quest-name">${esc(t.name)}</div>
            <div class="quest-meta"><span class="tag">${CATS[t.cat].ico} ${CATS[t.cat].n}</span><span class="tag xp">+${t.xp} XP</span></div>
          </div>
        </div>`).join('')}
      <div class="btn-row">
        <button class="btn ghost small" data-act="minDay">🌙 Завершить минимальный день</button>
        ${reviewDueToday() ? '<button class="btn primary small" data-act="review">📋 Недельный обзор</button>' : ''}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-title">Квесты на сегодня <button class="btn small" data-act="newQuest">+ Новый</button></div>
      ${todayQuests.length ? todayQuests.map(q => questCard(q)).join('') : '<div class="empty">Открытых квестов нет. И это нормально.</div>'}
    </div>`;

  $$('[data-mode]').forEach(el => el.onclick = () => { setDayMode(el.dataset.mode); renderAll(); });
  $$('[data-energy]').forEach(el => el.onclick = () => {
    getDay().energy = +el.dataset.energy;
    saveHealth(todayStr(), { energy: +el.dataset.energy });
    renderAll();
  });
  $$('[data-daily]').forEach(el => el.onclick = () => { completeDailyTask(el.dataset.daily); renderAll(); });
  bindCommon();
}

/* ── Квесты ── */
let questFilter = { cat: 'all', status: 'open', search: '' };

function rQuests() {
  let list = S.quests.filter(q =>
    (questFilter.cat === 'all' || q.cat === questFilter.cat) &&
    (questFilter.status === 'all' || q.status === questFilter.status) &&
    (!questFilter.search || q.name.toLowerCase().includes(questFilter.search.toLowerCase()))
  );
  list = list.sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);
  $('#screen').innerHTML = `
    <h1 class="screen-title">Квесты</h1>
    <div class="screen-sub">Открытых: ${S.quests.filter(q => q.status === 'open').length} · Выполнено всего: ${S.quests.filter(q => q.status === 'done').length}</div>
    <div class="pill-row">
      <div class="pill ${questFilter.status === 'open' ? 'active' : ''}" data-fs="open">Открытые</div>
      <div class="pill ${questFilter.status === 'done' ? 'active' : ''}" data-fs="done">Выполненные</div>
      <div class="pill ${questFilter.status === 'all' ? 'active' : ''}" data-fs="all">Все</div>
    </div>
    <div class="pill-row">
      <div class="pill ${questFilter.cat === 'all' ? 'active' : ''}" data-fc="all">Все категории</div>
      ${Object.keys(CATS).map(c => `<div class="pill ${questFilter.cat === c ? 'active' : ''}" data-fc="${c}">${CATS[c].ico} ${CATS[c].n}</div>`).join('')}
    </div>
    <input class="f" id="qSearch" placeholder="Поиск по названию…" value="${esc(questFilter.search)}" style="margin-bottom:12px">
    <div class="btn-row" style="margin:0 0 12px"><button class="btn primary" data-act="newQuest">+ Новый квест</button></div>
    ${list.length ? list.map(q => questCard(q)).join('') : '<div class="empty">Ничего не найдено</div>'}`;
  $$('[data-fs]').forEach(el => el.onclick = () => { questFilter.status = el.dataset.fs; rQuests(); });
  $$('[data-fc]').forEach(el => el.onclick = () => { questFilter.cat = el.dataset.fc; rQuests(); });
  $('#qSearch').oninput = e => { questFilter.search = e.target.value;
    clearTimeout(window._qs); window._qs = setTimeout(rQuests, 300); };
  // возвращаем фокус и курсор в поле поиска после перерендера
  if (questFilter.search) {
    const inp = $('#qSearch');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  bindCommon();
}

/* ── Карьера: главы, босс, сезон, пути дохода ── */
function rCareer() {
  const season = activeSeason();
  const cur = currentChapter();
  $('#screen').innerHTML = `
    <h1 class="screen-title">Карьерная карта</h1>
    <div class="screen-sub">бариста → AI-инструменты → Vibe Coding → проекты → первые деньги → контент → продукты → свобода. Сроки ориентировочные, не гарантированные.</div>

    ${season ? `
    <div class="card accent" style="margin-bottom:14px">
      <div class="card-title">${esc(season.n)} · осталось ${seasonDaysLeft(season)} дн.</div>
      ${season.goals.map((g, i) => `
        <div class="quest ${g.done ? 'done' : ''}" style="padding:9px 12px">
          <div class="quest-check" data-sgoal="${i}">✔</div>
          <div class="quest-body"><div class="quest-name" style="font-size:13px">${esc(g.t)}</div>
          <div class="quest-meta"><span class="tag">${esc(g.type)}</span></div></div>
        </div>`).join('')}
      <div class="btn-row">
        ${seasonDaysLeft(season) === 0 || season.goals.every(g => g.done) ? '<button class="btn primary small" data-endseason="1">🏁 Завершить сезон</button>' :
          '<button class="btn ghost small" data-endseason="1">Завершить сезон досрочно</button>'}
        <button class="btn ghost small" data-extendseason="1">+7 дней к сезону</button>
      </div>
    </div>

    ${!season.boss.defeated ? `
    <div class="boss" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="boss-name">👹 ${esc(season.boss.n)}</div>
        <span class="tag">${season.boss.hp}/${season.boss.maxHp} HP</span>
      </div>
      <div class="boss-hpbar"><div class="boss-hpfill" style="width:${pct(season.boss.hp, season.boss.maxHp)}%"></div></div>
      ${season.boss.actions.map(a => `
        <div class="boss-action ${a.done ? 'done' : ''}">
          <div class="quest-check" style="width:20px;height:20px;font-size:11px" data-bhit="${a.id}">${a.done ? '✔' : ''}</div>
          <span>${esc(a.n)}</span><span class="dmg">−${a.dmg} HP</span>
        </div>`).join('')}
    </div>` : `<div class="card" style="margin-bottom:14px;border-color:var(--ok)"><div class="card-title">👑 Босс «${esc(season.boss.n)}» повержен</div></div>`}` : `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Активного сезона нет</div>
      <button class="btn primary" data-newseason="1">Начать новый сезон (30 дней)</button>
    </div>`}

    ${S.chapters.map(ch => {
      const p = chapterProgress(ch);
      const active = ch.id === cur.id;
      return `
      <div class="card ${active ? 'accent' : ''}" style="margin-bottom:12px;${p === 100 ? 'opacity:.7' : ''}">
        <div class="card-title">
          <span>${p === 100 ? '✅' : active ? '▶' : '🔒'} ${esc(ch.name)}</span>
          <span>${esc(ch.period)} · ${p}%</span>
        </div>
        <div class="bar" style="margin-bottom:10px"><div class="bar-fill ${p === 100 ? 'ok' : ''}" style="width:${p}%"></div></div>
        ${active || p === 100 ? ch.goals.map((g, i) => `
          <label style="display:flex;gap:8px;font-size:13px;padding:4px 0;cursor:pointer;color:${g.done ? 'var(--text3)' : 'var(--text)'}">
            <input type="checkbox" data-chgoal="${ch.id}:${i}" ${g.done ? 'checked' : ''}>
            <span style="${g.done ? 'text-decoration:line-through' : ''}">${esc(g.t)}</span>
          </label>`).join('') : `<div class="card-note">Цели откроются, когда дойдёшь до этой главы. Босс: «${esc(ch.boss)}»</div>`}
        <div class="card-note" style="margin-top:8px">👹 Босс: «${esc(ch.boss)}» · 🎁 Награда: ${esc(ch.reward)}${ch.completedAt ? ' · Завершена ' + fmtDate(ch.completedAt) : ''}</div>
      </div>`;
    }).join('')}

    <h2 style="font-size:17px;margin:20px 0 10px">💸 Пути дохода</h2>
    <div class="info-box">Это меню возможностей, а не обещание заработка. Начинай с верхних — они доступны уже сейчас.</div>
    ${INCOME_PATHS.map((tier, ti) => `
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">${esc(tier.tier)}</div>
        ${tier.items.map((it, ii) => `
          <details class="adv" style="margin-top:6px">
            <summary><b style="color:var(--text)">${esc(it.n)}</b> · сложность ${esc(it.diff)}</summary>
            <div style="font-size:12.5px;color:var(--text2);padding:8px 0">
              <div>◈ Навыки: ${esc(it.skills)}</div>
              <div>◈ Результат: ${esc(it.result)}</div>
              <div>◈ Первый шаг: ${esc(it.step)}</div>
              <div>◈ Потенциальный клиент: ${esc(it.client)}</div>
              <label class="f">Фактический доход с этого пути, ₽</label>
              <input class="f" type="number" data-pathincome="${ti}:${ii}" value="${S.incomePathIncome[ti + ':' + ii] || 0}">
            </div>
          </details>`).join('')}
      </div>`).join('')}`;

  $$('[data-sgoal]').forEach(el => el.onclick = () => {
    const g = season.goals[+el.dataset.sgoal];
    g.done = !g.done;
    if (g.done) { addXP(60, 'story', 'Сезонная цель: ' + g.t); markDayActive(); }
    checkAchievements(); saveState(); rCareer(); renderHud();
  });
  $$('[data-bhit]').forEach(el => el.onclick = () => { hitBoss(el.dataset.bhit); rCareer(); renderHud(); });
  $$('[data-chgoal]').forEach(el => el.onchange = () => {
    const [id, i] = el.dataset.chgoal.split(':');
    toggleChapterGoal(+id, +i); rCareer(); renderHud();
  });
  $$('[data-pathincome]').forEach(el => el.onchange = () => {
    S.incomePathIncome[el.dataset.pathincome] = Number(el.value) || 0; saveState();
  });
  $$('[data-endseason]').forEach(el => el.onclick = () => seasonEndModal(season));
  $$('[data-extendseason]').forEach(el => el.onclick = () => { season.lengthDays += 7; saveState(); rCareer(); toast('Сезон продлён на 7 дней. Это не провал, а настройка темпа.'); });
  $$('[data-newseason]').forEach(el => el.onclick = () => newSeasonModal());
  bindCommon();
}

/* ── Навыки ── */
function rSkills() {
  $('#screen').innerHTML = `
    <h1 class="screen-title">Дерево навыков</h1>
    <div class="screen-sub">Навык растёт только от практики: квесты, проекты, публикации. Просмотр видео — не прокачка. Средний уровень: ${avgSkillLevel().toFixed(1)}/10</div>
    ${S.skills.map(br => `
      <div class="skill-branch">
        <div class="skill-branch-title">◈ ${esc(br.branch)}</div>
        ${br.nodes.map(sk => `
          <div class="skill-node ${sk.status === 'mastered' ? 'mastered' : ''} ${sk.status === 'locked' ? 'locked' : ''}" data-skill="${sk.id}">
            <div class="skill-lvl">${sk.lvl}</div>
            <div class="skill-info">
              <div class="skill-nm">${esc(sk.name)}</div>
              <div class="skill-st">${sk.status === 'mastered' ? '✅ освоен (есть доказательства)' : sk.status === 'learning' ? '📖 изучается · ' + sk.xp + '/' + skillLevelNeed(sk.lvl) + ' XP' : 'доступен'} · практик: ${sk.proofs.length}</div>
            </div>
            <div class="bar"><div class="bar-fill cold" style="width:${sk.lvl * 10}%"></div></div>
          </div>`).join('')}
      </div>`).join('')}`;
  $$('[data-skill]').forEach(el => el.onclick = () => skillModal(el.dataset.skill));
  bindCommon();
}

/* ── Проекты ── */
function rProjects() {
  const act = activeProjects();
  $('#screen').innerHTML = `
    <h1 class="screen-title">Проекты и портфолио</h1>
    <div class="screen-sub">Активных: ${act.length}/2. Каждый проект = навык + портфолио + контент + возможный доход.</div>
    ${act.length >= 2 ? '<div class="info-box">Лимит активных проектов: 2. Хочешь новый — заверши или заморозь текущий.</div>' : ''}
    <div class="btn-row" style="margin:0 0 14px"><button class="btn primary" id="newPrj">+ Новый проект</button></div>
    ${S.projects.map(p => {
      const prog = projectProgress(p);
      return `
      <div class="card ${p.status === 'active' ? 'accent' : ''}" style="margin-bottom:12px">
        <div class="card-title"><span>${esc(p.name)}</span><span class="tag">${PRJ_STATUSES[p.status]}</span></div>
        <div class="bar" style="margin-bottom:8px"><div class="bar-fill ${prog === 100 ? 'ok' : ''}" style="width:${prog}%"></div></div>
        <div class="card-note">🎯 ${esc(p.problem)}</div>
        ${p.tasks.map((t, i) => `
          <label style="display:flex;gap:8px;font-size:13px;padding:3px 0;cursor:pointer">
            <input type="checkbox" data-ptask="${p.id}:${i}" ${t.done ? 'checked' : ''}>
            <span style="${t.done ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(t.t)}</span>
          </label>`).join('')}
        <div class="btn-row">
          <select class="f" style="width:auto" data-pstatus="${p.id}">
            ${Object.keys(PRJ_STATUSES).map(st => `<option value="${st}" ${p.status === st ? 'selected' : ''}>${PRJ_STATUSES[st]}</option>`).join('')}
          </select>
          <button class="btn small" data-pedit="${p.id}">Подробнее / изменить</button>
          <button class="btn small ghost" data-pcontent="${p.id}">🎬 Идея ролика из проекта</button>
        </div>
      </div>`;
    }).join('')}`;
  $('#newPrj').onclick = () => projectModal();
  $$('[data-ptask]').forEach(el => el.onchange = () => { const [id, i] = el.dataset.ptask.split(':'); toggleProjectTask(id, +i); rProjects(); renderHud(); });
  $$('[data-pstatus]').forEach(el => el.onchange = () => { if (!setProjectStatus(el.dataset.pstatus, el.value)) rProjects(); else { rProjects(); renderHud(); } });
  $$('[data-pedit]').forEach(el => el.onclick = () => projectModal(S.projects.find(p => p.id === el.dataset.pedit)));
  $$('[data-pcontent]').forEach(el => el.onclick = () => {
    const p = S.projects.find(x => x.id === el.dataset.pcontent);
    createContent({ topic: 'Как я делал: ' + p.name, rubric: RUBRICS[1], project: p.id, status: 'idea' });
    toast('🎬 Идея ролика создана в разделе «Контент»', 'ok');
  });
  bindCommon();
}

/* ── Контент ── */
function rContent() {
  const stage = contentStage();
  const best = bestContent();
  $('#screen').innerHTML = `
    <h1 class="screen-title">Контент-система</h1>
    <div class="screen-sub">Позиционирование: «Путь бариста к AI-создателю». Контент — побочный продукт реальных проектов, а не отдельная повинность.</div>

    <div class="grid cols4" style="margin-bottom:14px">
      <div class="card"><div class="card-title">За неделю</div><div class="card-big">${publishedInLast(7)}</div><div class="card-note">Этап ${stage.stage}: ${stage.target}</div></div>
      <div class="card"><div class="card-title">Всего публикаций</div><div class="card-big">${publishedCount()}</div></div>
      <div class="card"><div class="card-title">Лучший ролик</div><div class="card-big">${best ? best.views.toLocaleString('ru-RU') : '—'}</div><div class="card-note">${best ? esc(best.topic) : 'пока нет данных'}</div></div>
      <div class="card"><div class="card-title">Прирост подписчиков</div><div class="card-big">+${S.contentStats.subsGained}</div>
        <div class="card-note">TikTok: ${S.contentStats.tiktokSubs} · Inst: ${S.contentStats.instaSubs}</div></div>
    </div>

    <div class="info-box">Воронка: действие → заметка → идея → сценарий → публикация → аналитика → улучшенная версия.
    Из реальных проектов: ${S.content.filter(c => c.project).length} из ${S.content.length}.</div>

    <div class="btn-row" style="margin:0 0 14px">
      <button class="btn primary" id="newContent">+ Идея контента</button>
      <button class="btn small" id="updSubs">Обновить подписчиков</button>
    </div>

    ${Object.keys(CONTENT_STATUSES).map(st => {
      const items = S.content.filter(c => c.status === st);
      if (!items.length) return '';
      return `<div class="card" style="margin-bottom:12px">
        <div class="card-title">${CONTENT_STATUSES[st]} (${items.length})</div>
        ${items.map(c => `
          <div class="quest" style="align-items:center">
            <div class="quest-body">
              <div class="quest-name">${esc(c.topic)}</div>
              <div class="quest-meta">
                <span class="tag">${esc(c.rubric)}</span><span class="tag">${esc(c.platform)}</span>
                ${c.project ? '<span class="tag">из проекта</span>' : ''}
                ${c.published ? `<span class="tag">📅 ${fmtDate(c.published)}</span>` : ''}
                ${c.views ? `<span class="tag">👁 ${c.views.toLocaleString('ru-RU')}</span>` : ''}
              </div>
            </div>
            <div class="quest-actions">
              <select class="f" style="width:auto;padding:5px" data-cstatus="${c.id}">
                ${Object.keys(CONTENT_STATUSES).map(s2 => `<option value="${s2}" ${c.status === s2 ? 'selected' : ''}>${CONTENT_STATUSES[s2]}</option>`).join('')}
              </select>
              <button class="iconbtn" data-cedit="${c.id}" title="Редактировать">✎</button>
              <button class="iconbtn" data-cdel="${c.id}" title="Удалить">✕</button>
            </div>
          </div>`).join('')}
      </div>`;
    }).join('') || '<div class="empty">Пока нет контента. Начни с одной идеи — например, «почему бариста учит Vibe Coding».</div>'}

    <div class="card">
      <div class="card-title">Рубрики</div>
      <div style="font-size:13px;color:var(--text2)">${RUBRICS.map((r, i) => (i + 1) + '. ' + esc(r)).join('<br>')}</div>
    </div>`;
  $('#newContent').onclick = () => contentModal();
  $('#updSubs').onclick = () => subsModal();
  $$('[data-cstatus]').forEach(el => el.onchange = () => { setContentStatus(el.dataset.cstatus, el.value); rContent(); renderHud(); });
  $$('[data-cedit]').forEach(el => el.onclick = () => contentModal(S.content.find(c => c.id === el.dataset.cedit)));
  $$('[data-cdel]').forEach(el => el.onclick = () => confirmModal('Удалить?', 'Единица контента будет удалена.', () => { S.content = S.content.filter(c => c.id !== el.dataset.cdel); saveState(); rContent(); }));
  bindCommon();
}

/* ── Финансы ── */
function rFinance() {
  const mb = monthBalance();
  const pay = nextPayment();
  const fund = S.finance.babyFund;
  const fundBought = fund.items.filter(i => i.bought).reduce((s, i) => s + i.cost, 0);
  $('#screen').innerHTML = `
    <h1 class="screen-title">Финансы</h1>
    <div class="screen-sub">⚠ Финансовые расчёты являются ориентировочными и не заменяют банковскую выписку или консультацию специалиста.</div>

    <div class="grid cols4" style="margin-bottom:14px">
      <div class="card"><div class="card-title">Доходы / мес</div><div class="card-big" style="font-size:20px">${fmtMoney(mb.inc)}</div></div>
      <div class="card"><div class="card-title">Расходы / мес</div><div class="card-big" style="font-size:20px">${fmtMoney(mb.exp)}</div></div>
      <div class="card ${mb.free < 0 ? '' : ''}"><div class="card-title">Свободно</div><div class="card-big" style="font-size:20px;color:${mb.free >= 0 ? 'var(--ok)' : 'var(--danger)'}">${fmtMoney(mb.free)}</div></div>
      <div class="card"><div class="card-title">Общий долг</div><div class="card-big" style="font-size:20px;color:var(--warn)">${fmtMoney(totalDebt())}</div>
        <div class="card-note">Погашено: ${pct(initialDebt() - totalDebt(), initialDebt())}%</div></div>
    </div>

    ${pay ? `<div class="${pay.days <= 5 ? 'warn-box' : 'info-box'}">💳 Ближайший платёж: <b>${esc(pay.debt.n)}</b> — ${fmtMoney(pay.debt.minPay)}, ${pay.date.toLocaleDateString('ru-RU')} (через ${pay.days} дн.)</div>` : ''}

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Долги · приоритет досрочного погашения — большая ставка</div>
      ${S.finance.debts.sort((a, b) => b.rate - a.rate).map(d => {
        const base = debtProjection(d, 0);
        const withExtra = debtProjection(d, S.finance.extraPay);
        return `
        <div style="border:1px solid var(--line);border-radius:11px;padding:12px;margin-bottom:10px;${d.balance <= 0 ? 'opacity:.55' : ''}">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <b>${esc(d.n)} ${d.balance <= 0 ? '— ЗАКРЫТ 🔓' : ''}</b>
            <span class="tag">ставка ${d.rate}% · платёж до ${d.payDay} числа</span>
          </div>
          <div class="bar" style="margin:8px 0"><div class="bar-fill gold" style="width:${pct(d.initialBalance - d.balance, d.initialBalance)}%"></div></div>
          <div class="frow3">
            <div><label class="f">Остаток, ₽</label><input class="f" type="number" data-dbal="${d.id}" value="${d.balance}"></div>
            <div><label class="f">Ставка, %</label><input class="f" type="number" step="0.1" data-drate="${d.id}" value="${d.rate}"></div>
            <div><label class="f">Мин. платёж, ₽</label><input class="f" type="number" data-dmin="${d.id}" value="${d.minPay}"></div>
          </div>
          ${d.balance > 0 ? `
          <div class="card-note" style="margin-top:8px">
            Только минимальный платёж: ~${base.months === Infinity ? '∞ (платёж меньше процентов!)' : base.months + ' мес, переплата ~' + fmtMoney(base.interest)}<br>
            С доп. платежом ${fmtMoney(S.finance.extraPay)}/мес: ~${withExtra.months} мес, переплата ~${fmtMoney(withExtra.interest)}
          </div>
          <div class="btn-row"><button class="btn small ok" data-dpay="${d.id}">✔ Записать платёж</button></div>` : ''}
        </div>`;
      }).join('')}
      <label class="f">Планируемый досрочный платёж в месяц (для сценария), ₽</label>
      <input class="f" type="number" id="extraPay" value="${S.finance.extraPay}" style="max-width:220px">
    </div>

    <div class="grid cols2" style="margin-bottom:14px">
      <div class="card">
        <div class="card-title">🛡 Финансовая подушка</div>
        <div class="bar-row"><span>${fmtMoney(S.finance.cushion.current)} из ${fmtMoney(S.finance.cushion.goal)}</span><b>${pct(S.finance.cushion.current, S.finance.cushion.goal)}%</b></div>
        <div class="bar"><div class="bar-fill ok" style="width:${pct(S.finance.cushion.current, S.finance.cushion.goal)}%"></div></div>
        <div class="frow" style="margin-top:8px">
          <div><label class="f">Накоплено, ₽</label><input class="f" type="number" id="cushCur" value="${S.finance.cushion.current}"></div>
          <div><label class="f">Цель, ₽</label><input class="f" type="number" id="cushGoal" value="${S.finance.cushion.goal}"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">👶 Фонд «Роды и ребёнок» · до ${fmtDate(S.profile.babyDue)}</div>
        <div class="bar-row"><span>${fmtMoney(fund.current)} из ${fmtMoney(fund.goal)} (куплено на ${fmtMoney(fundBought)})</span><b>${pct(fund.current, fund.goal)}%</b></div>
        <div class="bar"><div class="bar-fill violet" style="width:${pct(fund.current, fund.goal)}%"></div></div>
        <div class="frow" style="margin-top:8px">
          <div><label class="f">Накоплено, ₽</label><input class="f" type="number" id="babyCur" value="${fund.current}"></div>
          <div><label class="f">Цель, ₽</label><input class="f" type="number" id="babyGoal" value="${fund.goal}"></div>
        </div>
        <div style="margin-top:10px">${fund.items.map((i, idx) => `
          <label style="display:flex;gap:8px;font-size:13px;padding:3px 0;cursor:pointer;align-items:center">
            <input type="checkbox" data-baby="${idx}" ${i.bought ? 'checked' : ''}>
            <span style="flex:1;${i.bought ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(i.n)} ${i.pr === 'high' ? '🔴' : ''}</span>
            <span class="tag">${fmtMoney(i.cost)}</span>
            <button class="iconbtn" data-babydel="${idx}">✕</button>
          </label>`).join('')}
          <button class="btn small" id="babyAdd" style="margin-top:6px">+ Покупка</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">💵 Доход от новых направлений (контент / услуги / продукты)</div>
      <div class="card-big" style="font-size:20px;color:var(--ok)">${fmtMoney(newIncomeTotal())}</div>
      <div class="card-note">За 90 дней: ${fmtMoney(newIncomeInLast(90))} · Цель через 6 мес: 150 000 ₽/мес · через 12: 250 000 ₽/мес</div>
      <div class="btn-row"><button class="btn primary small" id="addNewIncome">+ Записать доход</button></div>
      ${S.finance.newIncome.length ? `<table class="t" style="margin-top:8px"><tr><th>Дата</th><th>Источник</th><th>Тип</th><th>Сумма</th></tr>
        ${S.finance.newIncome.slice(-8).reverse().map(i => `<tr><td>${fmtDate(i.date)}</td><td>${esc(i.source)}</td><td>${esc(i.type)}</td><td style="color:var(--ok)">${fmtMoney(i.sum)}</td></tr>`).join('')}</table>` : ''}
    </div>

    ${['incomes', 'fixedExpenses', 'varExpenses'].map(key => {
      const title = { incomes: 'Доходы', fixedExpenses: 'Обязательные расходы (платятся первыми)', varExpenses: 'Переменные расходы' }[key];
      return `<div class="card" style="margin-bottom:12px">
        <div class="card-title">${title} <button class="btn small" data-finadd="${key}">+ Добавить</button></div>
        ${S.finance[key].map(i => `
          <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
            <input class="f" data-finname="${key}:${i.id}" value="${esc(i.n)}" style="flex:2">
            <input class="f" type="number" data-finsum="${key}:${i.id}" value="${i.sum}" style="flex:1">
            <button class="iconbtn" data-findel="${key}:${i.id}">✕</button>
          </div>`).join('')}
      </div>`;
    }).join('')}`;

  // Привязки
  $$('[data-dbal]').forEach(el => el.onchange = () => { const d = S.finance.debts.find(x => x.id === el.dataset.dbal); d.balance = +el.value; if (d.balance > d.initialBalance) d.initialBalance = d.balance; checkAchievements(); saveState(); rFinance(); });
  $$('[data-drate]').forEach(el => el.onchange = () => { S.finance.debts.find(x => x.id === el.dataset.drate).rate = +el.value; saveState(); rFinance(); });
  $$('[data-dmin]').forEach(el => el.onchange = () => { S.finance.debts.find(x => x.id === el.dataset.dmin).minPay = +el.value; saveState(); rFinance(); });
  $$('[data-dpay]').forEach(el => el.onclick = () => debtPayModal(el.dataset.dpay));
  $('#extraPay').onchange = e => { S.finance.extraPay = +e.target.value || 0; saveState(); rFinance(); };
  $('#cushCur').onchange = e => { S.finance.cushion.current = +e.target.value || 0; checkAchievements(); saveState(); rFinance(); renderHud(); };
  $('#cushGoal').onchange = e => { S.finance.cushion.goal = +e.target.value || 0; saveState(); rFinance(); };
  $('#babyCur').onchange = e => { S.finance.babyFund.current = +e.target.value || 0; saveState(); rFinance(); };
  $('#babyGoal').onchange = e => { S.finance.babyFund.goal = +e.target.value || 0; saveState(); rFinance(); };
  $$('[data-baby]').forEach(el => el.onchange = () => { S.finance.babyFund.items[+el.dataset.baby].bought = el.checked; saveState(); rFinance(); });
  $$('[data-babydel]').forEach(el => el.onclick = () => { S.finance.babyFund.items.splice(+el.dataset.babydel, 1); saveState(); rFinance(); });
  $('#babyAdd').onclick = () => babyItemModal();
  $('#addNewIncome').onclick = () => newIncomeModal();
  $$('[data-finadd]').forEach(el => el.onclick = () => { S.finance[el.dataset.finadd].push({ id: uid(), n: 'Новая строка', sum: 0 }); saveState(); rFinance(); });
  $$('[data-finname]').forEach(el => el.onchange = () => { const [k, id] = el.dataset.finname.split(':'); S.finance[k].find(x => x.id === id).n = el.value; saveState(); });
  $$('[data-finsum]').forEach(el => el.onchange = () => { const [k, id] = el.dataset.finsum.split(':'); S.finance[k].find(x => x.id === id).sum = +el.value || 0; saveState(); rFinance(); });
  $$('[data-findel]').forEach(el => el.onclick = () => { const [k, id] = el.dataset.findel.split(':'); S.finance[k] = S.finance[k].filter(x => x.id !== id); saveState(); rFinance(); });
  bindCommon();
}

/* ── Здоровье и тренировки ── */
function rHealth() {
  const t = todayStr();
  const h = S.health[t] || {};
  const F = fitnessState();
  const les = lowEnergyStreak();
  const lastW = F.weights.length ? F.weights[F.weights.length - 1] : null;
  const lastM = F.measures.length ? F.measures[F.measures.length - 1] : null;
  const wkCount = workoutsThisWeek();
  const startDate = S.meta.created.slice(0, 10);
  const earlyPhase = dateDiffDays(startDate, t) < 42; // первые 6 недель — щадящий режим

  $('#screen').innerHTML = `
    <h1 class="screen-title">Здоровье и тренировки</h1>
    <div class="screen-sub">Наблюдения, не диагнозы. Восстановление важнее подвига.</div>
    ${les >= 3 ? `<div class="warn-box">🌫 Энергия ниже 4/10 уже ${les} дн. подряд. Сократи задачи, включи восстановительный день, проверь сон. При тревожных симптомах — к врачу.</div>` : ''}
    ${earlyPhase ? `<div class="info-box">🫁 Первые 4–6 недель: НЕ тренируйся до отказа, оставляй 2–3 повторения в запасе. При боли в груди, необычной одышке или ухудшении самочувствия — прекрати тренировку и обратись к врачу.</div>` : ''}

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">Отметка за сегодня</div>
      <div class="frow3">
        <div><label class="f">Сон, ч</label><input class="f" type="number" step="0.5" id="hSleep" value="${h.sleep ?? ''}" placeholder="7+"></div>
        <div><label class="f">Энергия 1–10</label><input class="f" type="number" min="1" max="10" id="hEnergy" value="${h.energy ?? ''}"></div>
        <div><label class="f">Настроение 1–10</label><input class="f" type="number" min="1" max="10" id="hMood" value="${h.mood ?? ''}"></div>
      </div>
      <details class="adv">
        <summary>шаги · вода · активность · заметки</summary>
        <div class="frow3">
          <div><label class="f">Шаги</label><input class="f" type="number" id="hSteps" value="${h.steps ?? ''}" placeholder="10–12 тыс."></div>
          <div><label class="f">Вода, стаканов</label><input class="f" type="number" id="hWater" value="${h.water ?? ''}" placeholder="~12 (3 л)"></div>
          <div><label class="f">Активность</label><input class="f" id="hAct" value="${esc(h.activity ?? '')}" placeholder="ходьба 30 мин"></div>
        </div>
        <label class="f">Симптомы / заметки</label>
        <textarea class="f" id="hNote">${esc(h.note ?? '')}</textarea>
      </details>
      <div class="btn-row"><button class="btn primary small" id="hSave">Сохранить · +10 XP</button></div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="card-title">🏋 Тренировка · на этой неделе: ${wkCount}</div>
      <div class="card-note" style="margin-bottom:8px">План: Д1 грудь+трицепс · Д2 спина+бицепс · Д3 отдых/кардио · Д4 ноги · Д5 плечи+пресс. Кардио 4×/нед по 20–30 мин. Прогрессия: +1 повтор ИЛИ +2,5 кг в неделю при правильной технике.</div>
      <div class="btn-row" style="margin:0">
        ${WORKOUTS.map(w => `<button class="btn small" data-workout="${w.id}">${esc(w.n)}</button>`).join('')}
      </div>
      ${F.workouts.length ? `<div class="card-note" style="margin-top:8px">Последняя: ${fmtDate(F.workouts[F.workouts.length - 1].d)} · ${esc(F.workouts[F.workouts.length - 1].name)} · всего: ${F.workouts.length}</div>` : ''}
    </div>

    <div class="grid cols2" style="margin-bottom:12px">
      <div class="card">
        <div class="card-title">⚖ Вес · цель ${F.goalMin}–${F.goalMax} кг</div>
        <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:8px">
          <div style="flex:1"><label class="f" style="margin-top:0">Сегодня, кг</label>
          <input class="f" type="number" step="0.1" id="wKg" value="${lastW && lastW.d === t ? lastW.kg : ''}" placeholder="${lastW ? lastW.kg : F.startWeight}"></div>
          <button class="btn primary small" id="wSave" style="margin-bottom:2px">Записать</button>
        </div>
        ${lastW ? `<div class="card-note">Старт: ${F.startWeight} кг → сейчас: <b>${lastW.kg} кг</b> (${(lastW.kg - F.startWeight) <= 0 ? '' : '+'}${(lastW.kg - F.startWeight).toFixed(1)} кг) · до цели: ${Math.max(0, (lastW.kg - F.goalMax)).toFixed(1)} кг</div>` : `<div class="card-note">Старт: ${F.startWeight} кг. Взвешивайся раз в неделю, в одно время.</div>`}
        ${F.weights.length >= 2 ? svgLine(F.weights.slice(-26).map(w => ({ l: fmtDate(w.d), v: w.kg })), { color: 'var(--ok)', h: 130 }) : ''}
        <details class="adv"><summary>ожидаемый прогресс</summary>
          <div style="font-size:12.5px;color:var(--text2);padding-top:6px">Плавно, без рывков: ориентир ~0,5–0,7 кг в неделю от старта (${F.startWeight} кг) к цели (${F.goalMin}–${F.goalMax} кг). Быстрее не значит лучше.</div>
        </details>
      </div>
      <div class="card">
        <div class="card-title">📏 Замеры (раз в месяц) и фото (раз в 2 недели)</div>
        ${lastM ? `<div class="card-note">Последние (${fmtDate(lastM.d)}): талия ${lastM.waist || '—'} · грудь ${lastM.chest || '—'} · руки ${lastM.arms || '—'} · бёдра ${lastM.hips || '—'} · шея ${lastM.neck || '—'}</div>` : '<div class="card-note">Замеров пока нет.</div>'}
        <div class="btn-row" style="margin-top:8px">
          <button class="btn small" id="mAdd">+ Замеры</button>
          <button class="btn small ${F.lastPhoto && dateDiffDays(F.lastPhoto, t) < 14 ? '' : 'ok'}" id="photoBtn">📸 Фото сделано</button>
        </div>
        <div class="card-note" style="margin-top:6px">${F.lastPhoto ? 'Последнее фото: ' + fmtDate(F.lastPhoto) + (dateDiffDays(F.lastPhoto, t) >= 14 ? ' — пора новое!' : '') : 'Сделай стартовые фото: спереди, сбоку, сзади.'}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <details class="adv" style="border:none;padding:0;margin:0">
        <summary style="font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--text3)">🍽 Питание и нормы (из твоего плана)</summary>
        <div style="font-size:13px;color:var(--text2);padding-top:8px;line-height:1.8">
          Калории: <b>2300–2400</b> · Белки: <b>180–200 г</b> · Жиры: 70–80 г · Углеводы: 180–220 г<br>
          Основа: курица, индейка, яйца, творог, рыба, говядина; рис, гречка, овсянка, картофель; овощи ежедневно.<br>
          Минимизировать: газировка, сладости, фастфуд, чипсы, выпечка, майонез.<br>
          Вода: 3 л/день · Сон: минимум 7 часов.<br>
          Добавки: креатин 5 г/день · протеин при недоборе белка · омега-3 · витамин D — только после анализа на дефицит.
        </div>
      </details>
    </div>

    <div class="grid cols2">
      <div class="card"><div class="card-title">Энергия · 14 дн</div>
        ${svgLine(rangeData(14, d => (S.health[d] && S.health[d].energy) || (S.days[d] && S.days[d].energy) || 0), { color: 'var(--cold)', h: 120 })}</div>
      <div class="card"><div class="card-title">Сон · 14 дн</div>
        ${svgLine(rangeData(14, d => (S.health[d] && S.health[d].sleep) || 0), { color: 'var(--violet)', h: 120 })}</div>
    </div>`;

  $('#hSave').onclick = () => {
    saveHealth(t, {
      sleep: +$('#hSleep').value || null, energy: clamp(+$('#hEnergy').value || 0, 0, 10) || null,
      mood: clamp(+$('#hMood').value || 0, 0, 10) || null, steps: +$('#hSteps').value || null,
      water: +$('#hWater').value || null, activity: $('#hAct').value, note: $('#hNote').value,
    });
    addXP(10, 'health', 'Отметка здоровья');
    markDayActive();
    saveState(); renderAll();
  };
  $$('[data-workout]').forEach(el => el.onclick = () => workoutModal(el.dataset.workout));
  $('#wSave').onclick = () => {
    const kg = +$('#wKg').value;
    if (!kg || kg < 30 || kg > 250) { toast('Введи реальный вес в кг', 'warn'); return; }
    logWeight(kg); renderAll();
  };
  $('#mAdd').onclick = () => measureModal();
  $('#photoBtn').onclick = () => {
    F.lastPhoto = t;
    addXP(15, 'health', 'Фото прогресса');
    markDayActive(); saveState(); renderAll();
    toast('📸 Отмечено. Через 3 месяца скажешь себе спасибо.', 'ok');
  };
  bindCommon();
}

function rangeData(n, getter) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = todayStr(-i);
    out.push({ l: fmtDate(d), v: getter(d) || 0 });
  }
  return out;
}

/* ── Семья ── */
function rFamily() {
  $('#screen').innerHTML = `
    <h1 class="screen-title">Семья и быт</h1>
    <div class="screen-sub">Семья — не конкурент карьеры, а часть общего прогресса (7% формулы свободы + фундамент всего остального).</div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Быстрые действия (каждое = +15 XP, отношения ↑)</div>
      <div class="btn-row" style="margin:0">
        <button class="btn" data-fam="Время вдвоём без телефона">📵 Время вдвоём</button>
        <button class="btn" data-fam="Помощь по дому">🏠 Помощь по дому</button>
        <button class="btn" data-fam="Подготовка к ребёнку">👶 Подготовка к ребёнку</button>
        <button class="btn" data-fam="Совместное дело">🤝 Совместное дело</button>
        <button class="btn" data-fam="Поддержка жены">❤ Поддержка жены</button>
        <button class="btn" data-fam="Семейный отдых">🌿 Семейный отдых</button>
      </div>
      <div class="card-note">За 28 дней: ${familyActionsInLast(28)} действий</div>
    </div>

    <div class="grid cols2">
      <div class="card">
        <div class="card-title">Важные даты <button class="btn small" id="dateAdd">+ Дата</button></div>
        ${S.family.dates.map(d => `
          <div style="display:flex;gap:8px;align-items:center;padding:5px 0;font-size:13.5px">
            <span style="flex:1">${esc(d.n)}</span>
            <span class="tag">📅 ${fmtDate(d.date)} (${dateDiffDays(todayStr(), d.date)} дн.)</span>
            <button class="iconbtn" data-datedel="${d.id}">✕</button>
          </div>`).join('') || '<div class="empty">Нет дат</div>'}
      </div>
      <div class="card">
        <div class="card-title">Семейные задачи <button class="btn small" id="famTaskAdd">+ Задача</button></div>
        ${S.family.tasks.map((t, i) => `
          <label style="display:flex;gap:8px;font-size:13px;padding:3px 0;cursor:pointer">
            <input type="checkbox" data-famtask="${i}" ${t.done ? 'checked' : ''}>
            <span style="${t.done ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(t.t)}</span>
          </label>`).join('') || '<div class="empty">Нет задач</div>'}
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-title">Журнал (последние 10)</div>
      ${S.family.log.slice(-10).reverse().map(l => `
        <div style="font-size:13px;color:var(--text2);padding:4px 0">${fmtDate(l.date)} · ${esc(l.type)}${l.note ? ' — ' + esc(l.note) : ''}</div>`).join('') || '<div class="empty">Пока пусто</div>'}
    </div>`;
  $$('[data-fam]').forEach(el => el.onclick = () => { logFamily(el.dataset.fam); renderAll(); });
  $('#dateAdd').onclick = () => familyDateModal();
  $('#famTaskAdd').onclick = () => familyTaskModal();
  $$('[data-datedel]').forEach(el => el.onclick = () => { S.family.dates = S.family.dates.filter(d => d.id !== el.dataset.datedel); saveState(); rFamily(); });
  $$('[data-famtask]').forEach(el => el.onchange = () => {
    const t = S.family.tasks[+el.dataset.famtask];
    t.done = el.checked;
    if (t.done) { addXP(12, 'home', t.t); markDayActive(); }
    saveState(); rFamily(); renderHud();
  });
  bindCommon();
}

/* ── Аналитика ── */
let analyticsPeriod = 28;
function rAnalytics() {
  const n = analyticsPeriod;
  const xpData = rangeData(n, d => S.log.filter(l => l.d === d).reduce((s, l) => s + l.xp, 0));
  const questData = rangeData(n, d => S.quests.filter(q => q.doneAt === d).length);
  const debtHistory = [];
  for (const d of S.finance.debts) for (const h of d.history) debtHistory.push(h);
  debtHistory.sort((a, b) => a.d < b.d ? -1 : 1);
  let runBal = initialDebt();
  const debtData = [{ l: 'старт', v: runBal }];
  for (const h of debtHistory) { runBal = Math.max(0, runBal - h.sum); debtData.push({ l: fmtDate(h.d), v: runBal }); }
  debtData.push({ l: 'сейчас', v: totalDebt() });
  const catTime = {};
  for (const l of S.log.filter(l => l.d >= todayStr(-n))) catTime[l.cat] = (catTime[l.cat] || 0) + l.xp;

  $('#screen').innerHTML = `
    <h1 class="screen-title">Аналитика</h1>
    <div class="screen-sub">Смотри на недели и месяцы, а не на отдельные дни.</div>
    <div class="pill-row">
      ${[7, 28, 90].map(p => `<div class="pill ${analyticsPeriod === p ? 'active' : ''}" data-period="${p}">${p} дней</div>`).join('')}
    </div>

    <div class="grid cols3" style="margin-bottom:14px">
      <div class="card"><div class="card-title">Стабильность 7 дн</div><div class="card-big">${stability(7)}%</div></div>
      <div class="card"><div class="card-title">Стабильность 28 дн</div><div class="card-big">${stability(28)}%</div><div class="card-note">Главная метрика — важнее серии</div></div>
      <div class="card"><div class="card-title">Стабильность 90 дн</div><div class="card-big">${stability(90)}%</div></div>
    </div>

    <div class="grid cols2" style="margin-bottom:14px">
      <div class="card"><div class="card-title">XP по дням</div>${svgBars(xpData)}</div>
      <div class="card"><div class="card-title">Квесты по дням</div>${svgBars(questData, { color: 'var(--violet)' })}</div>
      <div class="card"><div class="card-title">Изменение общего долга</div>${svgLine(debtData, { color: 'var(--gold)' })}</div>
      <div class="card"><div class="card-title">Энергия</div>${svgLine(rangeData(n, d => (S.health[d] && S.health[d].energy) || (S.days[d] && S.days[d].energy) || 0), { color: 'var(--cold)' })}</div>
    </div>

    <div class="grid cols2" style="margin-bottom:14px">
      <div class="card">
        <div class="card-title">Баланс направлений (XP за ${n} дн.)</div>
        ${Object.keys(catTime).length ? Object.entries(catTime).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
          <div class="bar-row"><span>${CATS[c] ? CATS[c].ico + ' ' + CATS[c].n : c}</span><b>${v} XP</b></div>
          <div class="bar" style="margin-bottom:7px"><div class="bar-fill" style="width:${pct(v, Math.max(...Object.values(catTime)))}%"></div></div>`).join('') : '<div class="empty">Нет данных</div>'}
      </div>
      <div class="card">
        <div class="card-title">Ключевые цифры</div>
        <table class="t">
          <tr><td>Всего XP</td><td><b>${S.xp.total}</b></td></tr>
          <tr><td>Часов практики (оценка)</td><td><b>${Math.round((S.flags.practiceMinutes || 0) / 60)}</b></td></tr>
          <tr><td>Публикаций за период</td><td><b>${publishedInLast(n)}</b></td></tr>
          <tr><td>Доход от новых направлений за период</td><td><b>${fmtMoney(newIncomeInLast(n))}</b></td></tr>
          <tr><td>Накоплено (подушка + детский фонд)</td><td><b>${fmtMoney(S.finance.cushion.current + S.finance.babyFund.current)}</b></td></tr>
          <tr><td>Прогресс проектов</td><td><b>${S.projects.filter(p => ['done','published','monetized'].includes(p.status)).length} завершено / ${activeProjects().length} в работе</b></td></tr>
          <tr><td>Недельных обзоров</td><td><b>${S.reviews.length}</b></td></tr>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Характеристики персонажа · растут автоматически от действий</div>
      <div class="grid cols2">
        <div>${Object.keys(STAT_NAMES).map(k => `
          <div class="stat-row">
            <span class="stat-name">${STAT_NAMES[k]}</span>
            <div class="bar"><div class="bar-fill cold" style="width:${S.stats[k]}%"></div></div>
            <span class="stat-val">${S.stats[k]}</span>
          </div>`).join('')}
        </div>
        <div>${svgRadar(S.stats)}</div>
      </div>
    </div>

    ${S.reviews.length ? `<div class="card"><div class="card-title">Последний недельный обзор (${fmtDate(S.reviews[S.reviews.length-1].date)})</div>
      <div style="font-size:13px;color:var(--text2)">${esc(S.reviews[S.reviews.length-1].summary || '')}</div></div>` : ''}`;
  $$('[data-period]').forEach(el => el.onclick = () => { analyticsPeriod = +el.dataset.period; rAnalytics(); });
  bindCommon();
}

/* ── Достижения ── */
function rAchieve() {
  const unlocked = Object.keys(S.achievements).length;
  $('#screen').innerHTML = `
    <h1 class="screen-title">Достижения</h1>
    <div class="screen-sub">Открыто: ${unlocked} из ${ACHIEVEMENTS.length}. Открываются автоматически — за реальные действия, не за вход.</div>
    <div class="grid cols2">
      ${ACHIEVEMENTS.map(a => {
        const date = S.achievements[a.id];
        return `<div class="ach ${date ? '' : 'locked'}">
          <div class="ach-ico">${a.ico}</div>
          <div><div class="ach-nm">${esc(a.n)}</div><div class="ach-ds">${esc(a.d)}</div></div>
          ${date ? `<div class="ach-dt">${fmtDate(date)}</div>` : '<div class="ach-dt">🔒</div>'}
        </div>`;
      }).join('')}
    </div>

    <h2 style="font-size:17px;margin:22px 0 10px">◈ Магазин наград (Gold: ${S.gold.balance})</h2>
    <div class="info-box">Сон, еда, отдых и семья — бесплатны всегда. Gold — только для дополнительных удовольствий. Награды и цены редактируются.</div>
    <div class="grid cols3">
      ${S.rewards.map(r => `
        <div class="card">
          <div style="font-weight:600;font-size:13.5px;margin-bottom:8px">${esc(r.n)}</div>
          <div class="btn-row" style="margin:0">
            <button class="btn small primary" data-buy="${r.id}">◈ ${r.cost}</button>
            <button class="iconbtn" data-redit="${r.id}">✎</button>
            <button class="iconbtn" data-rdel="${r.id}">✕</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="btn-row"><button class="btn" id="rewardAdd">+ Своя награда</button></div>

    <div class="card" style="margin-top:14px">
      <div class="card-title">История Gold (последние 12)</div>
      ${S.gold.history.slice(-12).reverse().map(h => `
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0;color:var(--text2)">
          <span>${fmtDate(h.d)} · ${esc(h.reason)}</span>
          <b style="color:${h.sum > 0 ? 'var(--ok)' : 'var(--warn)'}">${h.sum > 0 ? '+' : ''}${h.sum}</b>
        </div>`).join('') || '<div class="empty">Пока пусто</div>'}
    </div>`;
  $$('[data-buy]').forEach(el => el.onclick = () => {
    const r = S.rewards.find(x => x.id === el.dataset.buy);
    if (spendGold(r.cost, 'Награда: ' + r.n)) { toast('🎁 Награда куплена: ' + r.n + '. Наслаждайся без чувства вины.', 'ok'); saveState(); rAchieve(); renderHud(); }
  });
  $$('[data-redit]').forEach(el => el.onclick = () => rewardModal(S.rewards.find(x => x.id === el.dataset.redit)));
  $$('[data-rdel]').forEach(el => el.onclick = () => { S.rewards = S.rewards.filter(x => x.id !== el.dataset.rdel); saveState(); rAchieve(); });
  $('#rewardAdd').onclick = () => rewardModal();
  bindCommon();
}

/* ── Настройки ── */
function rSettings() {
  $('#screen').innerHTML = `
    <h1 class="screen-title">Настройки</h1>
    <div class="screen-sub">Профиль, темы, данные, резервные копии.</div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Профиль</div>
      <div class="frow">
        <div><label class="f">Имя</label><input class="f" id="setName" value="${esc(S.profile.name)}"></div>
        <div><label class="f">Имя персонажа</label><input class="f" id="setChar" value="${esc(S.profile.charName)}"></div>
      </div>
      <div class="frow">
        <div><label class="f">Рабочий график</label><input class="f" id="setWork" value="${esc(S.profile.workHours)}"></div>
        <div><label class="f">Свободных часов в неделю</label><input class="f" type="number" id="setFree" value="${S.profile.freeHoursWeek}"></div>
      </div>
      <label class="f">Цель на 12 месяцев</label>
      <textarea class="f" id="setGoal">${esc(S.profile.goal12m)}</textarea>
      <label class="f">Ожидаемая дата родов</label>
      <input class="f" type="date" id="setBaby" value="${S.profile.babyDue}" style="max-width:220px">
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Оформление</div>
      <div class="btn-row" style="margin:0">
        <button class="btn ${S.settings.theme === 'red' ? 'primary' : ''}" data-settheme="red">🔴 Тёмно-красная</button>
        <button class="btn ${S.settings.theme === 'blue' ? 'primary' : ''}" data-settheme="blue">🔵 Тёмно-синяя</button>
        <button class="btn ${S.settings.theme === 'mono' ? 'primary' : ''}" data-settheme="mono">⚪ Минимализм</button>
      </div>
      <label class="f">День недельного обзора</label>
      <select class="f" id="setReviewDay" style="max-width:220px">
        ${['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'].map((d, i) => `<option value="${i}" ${S.settings.reviewDay === i ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Уведомления браузера (необязательно)</div>
      <div class="card-note" style="margin-bottom:8px">Приложение полностью работает и без них. Внутренние напоминания всегда включены.</div>
      <button class="btn small" id="notifBtn">${S.settings.browserNotify ? '✔ Разрешены' : 'Запросить разрешение'}</button>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📱 На телефоне (iPhone)</div>
      <div class="card-note" style="line-height:1.7">
        1. Опубликуй приложение бесплатно (GitHub Pages / Netlify — инструкция в README).<br>
        2. Открой адрес в Safari → «Поделиться» → <b>«На экран "Домой"»</b> — появится иконка EGO, откроется как полноценное приложение и будет работать без интернета.<br>
        3. Данные на телефоне и компьютере живут отдельно. Перенос: здесь «Экспорт JSON» → на телефоне «Импорт JSON» (и наоборот).<br>
        ⚠ Если пользоваться сайтом просто во вкладке Safari и не заходить ~7 дней, iOS может стереть его данные. Установка на экран «Домой» решает это, но экспорт раз в неделю всё равно делай.
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Данные</div>
      <div class="card-note" style="margin-bottom:8px">Последняя резервная копия: ${S.meta.lastBackup ? new Date(S.meta.lastBackup).toLocaleString('ru-RU') : 'ещё не делалась'}</div>
      <div class="btn-row" style="margin:0">
        <button class="btn primary" id="btnExport">💾 Экспорт JSON (резервная копия)</button>
        <button class="btn" id="btnImport">📥 Импорт JSON</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
      </div>
      <hr class="divider">
      <div class="btn-row" style="margin:0">
        <button class="btn" id="btnSnapRestore">🕐 Восстановить вчерашний снимок</button>
        <button class="btn" id="btnClearDemo" ${S.flags.demoCleared ? 'disabled' : ''}>🧹 Очистить демо-данные</button>
        <button class="btn danger" id="btnReset">⚠ Полный сброс</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">💡 Хранилище идей</div>
      <div class="card-note" style="margin-bottom:8px">Новые идеи — сюда, а не сразу в задачи. Раз в неделю решай: позже / удалить / в проект.</div>
      <button class="btn small primary" data-act="newIdea">+ Идея</button>
      ${S.ideas.map(i => `
        <div class="quest" style="margin-top:8px;align-items:center">
          <div class="quest-body">
            <div class="quest-name">${esc(i.t)}</div>
            <div class="quest-meta"><span class="tag">${esc(i.cat)}</span>${i.benefit ? `<span class="tag">польза: ${esc(i.benefit)}</span>` : ''}${i.cost ? `<span class="tag">⏱ ${esc(i.cost)}</span>` : ''}<span class="tag">${fmtDate(i.date)}</span></div>
          </div>
          <div class="quest-actions">
            <button class="iconbtn" data-idea2prj="${i.id}" title="Превратить в проект">🛠</button>
            <button class="iconbtn" data-ideadel="${i.id}" title="Удалить">✕</button>
          </div>
        </div>`).join('')}
    </div>`;

  $('#setName').onchange = e => { S.profile.name = e.target.value; saveState(); renderHud(); };
  $('#setChar').onchange = e => { S.profile.charName = e.target.value; saveState(); renderHud(); };
  $('#setWork').onchange = e => { S.profile.workHours = e.target.value; saveState(); };
  $('#setFree').onchange = e => { S.profile.freeHoursWeek = +e.target.value || 5; saveState(); };
  $('#setGoal').onchange = e => { S.profile.goal12m = e.target.value; saveState(); };
  $('#setBaby').onchange = e => { S.profile.babyDue = e.target.value; saveState(); };
  $('#setReviewDay').onchange = e => { S.settings.reviewDay = +e.target.value; saveState(); };
  // ВАЖНО: селектор должен быть data-settheme, а не data-theme —
  // иначе он захватит <html data-theme="..."> и обработчик повиснет на всём документе.
  $$('[data-settheme]').forEach(el => el.onclick = () => {
    S.settings.theme = el.dataset.settheme;
    document.documentElement.dataset.theme = el.dataset.settheme;
    saveState(); rSettings();
  });
  $('#notifBtn').onclick = async () => {
    if (!('Notification' in window)) { toast('Браузер не поддерживает уведомления', 'warn'); return; }
    const perm = await Notification.requestPermission();
    S.settings.browserNotify = perm === 'granted';
    saveState(); rSettings();
    if (perm === 'granted') toast('Уведомления разрешены', 'ok');
  };
  $('#btnExport').onclick = exportJSON;
  $('#btnImport').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); };
  $('#btnSnapRestore').onclick = () => {
    let snap = null, snapDate = null;
    try { snap = localStorage.getItem('project_ego_snap'); snapDate = localStorage.getItem('project_ego_snap_date'); } catch (e) {}
    if (!snap) { toast('Снимка пока нет — он появится после первого дня использования', 'warn'); return; }
    confirmModal('Восстановить снимок от ' + (snapDate || '—') + '?',
      'Текущие данные будут заменены состоянием на начало этого дня. Сегодняшние изменения пропадут.', () => {
      try {
        S = migrate(JSON.parse(snap));
        saveState(); renderAll();
        toast('🕐 Снимок восстановлен', 'ok');
      } catch (e) { toast('Снимок повреждён: ' + e.message, 'warn'); }
    });
  };
  $('#btnClearDemo').onclick = () => confirmModal('Очистить демо-данные?', 'Будут удалены примерные квесты, идеи и контент, помеченные как демо. Твои данные останутся.', () => {
    S.quests = S.quests.filter(q => !q.demo);
    S.ideas = S.ideas.filter(i => !i.demo);
    S.content = S.content.filter(c => !c.demo);
    S.flags.demoCleared = true;
    saveState(); rSettings(); toast('Демо-данные удалены', 'ok');
  });
  $('#btnReset').onclick = () => confirmModal('ПОЛНЫЙ СБРОС', 'Все данные будут безвозвратно удалены: XP, квесты, финансы, история. Сначала сделай экспорт! Точно продолжить?', () => {
    confirmModal('Последнее подтверждение', 'Это действие нельзя отменить. Удалить всё?', () => {
      localStorage.removeItem(STORE_KEY);
      location.reload();
    });
  });
  $$('[data-idea2prj]').forEach(el => el.onclick = () => {
    const i = S.ideas.find(x => x.id === el.dataset.idea2prj);
    if (activeProjects().length >= 2) {
      modalInfo('Лимит проектов', 'Два активных проекта уже есть. Идея останется в хранилище — вернись к ней, когда завершишь текущее.');
      return;
    }
    S.projects.push({ id: uid(), name: i.t, problem: i.benefit || '', audience: '', idea: i.t, status: 'planned',
      priority: 'mid', started: '', planned: '', tech: '', skills: [], tasks: [{ t: 'Определить первый шаг', done: false }],
      link: '', result: '', learned: '', monetizable: '', content: '', demo: false });
    S.ideas = S.ideas.filter(x => x.id !== i.id);
    saveState(); toast('Идея превращена в проект (статус: запланирован)', 'ok'); rSettings();
  });
  $$('[data-ideadel]').forEach(el => el.onclick = () => { S.ideas = S.ideas.filter(x => x.id !== el.dataset.ideadel); saveState(); rSettings(); });
  bindCommon();
}

/* ════════ 24. МОДАЛЬНЫЕ ОКНА ════════ */

function openModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modalBackdrop').classList.remove('hidden');
  // единая привязка кнопок закрытия (без inline-обработчиков — совместимо с CSP)
  $$('[data-mclose]', $('#modalBox')).forEach(b => b.onclick = closeModal);
}
function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
  $('#modalBox').innerHTML = '';
}

function modalInfo(title, html) {
  openModal(`<h3>${esc(title)}</h3><div style="font-size:13.5px;color:var(--text2);margin:10px 0">${html}</div>
    <div class="btn-row"><button class="btn primary" data-mclose="1">Понял</button></div>`);
}

function confirmModal(title, text, onYes) {
  openModal(`<h3>${esc(title)}</h3><div class="msub">${esc(text)}</div>
    <div class="btn-row"><button class="btn danger" id="mYes">Да, продолжить</button>
    <button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mYes').onclick = () => { closeModal(); onYes(); };
}

/* Создание/редактирование квеста. Простая форма + раскрывающиеся детали. */
function questModal(q = null) {
  const isEdit = !!q;
  openModal(`
    <h3>${isEdit ? 'Редактировать квест' : 'Новый квест'}</h3>
    <div class="msub">Для простой задачи хватит названия. Остальное — по желанию.</div>
    <label class="f">Название *</label>
    <input class="f" id="mqName" value="${esc(q ? q.name : '')}" placeholder="Например: 20 минут HTML-курса">
    <div class="frow">
      <div><label class="f">Категория</label>
        <select class="f" id="mqCat">${Object.keys(CATS).map(c => `<option value="${c}" ${q && q.cat === c ? 'selected' : ''}>${CATS[c].ico} ${CATS[c].n}</option>`).join('')}</select></div>
      <div><label class="f">Сложность</label>
        <select class="f" id="mqDiff">${Object.keys(DIFF).map(d => `<option value="${d}" ${q && q.diff === d ? 'selected' : (!q && d === 'D' ? 'selected' : '')}>${d} · ${DIFF[d].xp} XP</option>`).join('')}</select></div>
    </div>
    <details class="adv" ${isEdit ? 'open' : ''}>
      <summary>Дополнительные настройки</summary>
      <label class="f">Описание / следующий конкретный шаг</label>
      <textarea class="f" id="mqDesc">${esc(q ? q.desc : '')}</textarea>
      <label class="f">Минимальная версия (для тяжёлых дней)</label>
      <input class="f" id="mqMini" value="${esc(q ? q.mini : '')}" placeholder="Например: только 5 минут">
      <div class="frow3">
        <div><label class="f">Срок</label><input class="f" type="date" id="mqDue" value="${q ? q.due : ''}"></div>
        <div><label class="f">Время</label><input class="f" id="mqTime" value="${esc(q ? q.time : '')}" placeholder="30 мин"></div>
        <div><label class="f">Повтор</label>
          <select class="f" id="mqRepeat">
            <option value="none" ${q && q.repeat === 'none' ? 'selected' : ''}>Нет</option>
            <option value="daily" ${q && q.repeat === 'daily' ? 'selected' : ''}>Ежедневно</option>
            <option value="weekly" ${q && q.repeat === 'weekly' ? 'selected' : ''}>Еженедельно</option>
            <option value="monthly" ${q && q.repeat === 'monthly' ? 'selected' : ''}>Ежемесячно</option>
          </select></div>
      </div>
      <div class="frow">
        <div><label class="f">Связанный навык</label>
          <select class="f" id="mqSkill"><option value="">—</option>
            ${S.skills.map(br => br.nodes.map(n => `<option value="${n.id}" ${q && q.skill === n.id ? 'selected' : ''}>${esc(br.branch)}: ${esc(n.name)}</option>`).join('')).join('')}</select></div>
        <div><label class="f">Связанный проект</label>
          <select class="f" id="mqProject"><option value="">—</option>
            ${S.projects.map(p => `<option value="${p.id}" ${q && q.project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <label class="f">Подзадачи (по одной на строку)</label>
      <textarea class="f" id="mqSubs">${q ? q.subtasks.map(s => s.t).join('\n') : ''}</textarea>
    </details>
    <div class="btn-row">
      <button class="btn primary" id="mqSave">${isEdit ? 'Сохранить' : 'Создать квест'}</button>
      <button class="btn" data-mclose="1">Отмена</button>
    </div>`);
  $('#mqSave').onclick = () => {
    const name = $('#mqName').value.trim();
    if (!name) { toast('Нужно название', 'warn'); return; }
    const data = {
      name, cat: $('#mqCat').value, diff: $('#mqDiff').value,
      desc: $('#mqDesc').value.trim(), mini: $('#mqMini').value.trim(),
      due: $('#mqDue').value, time: $('#mqTime').value.trim(), repeat: $('#mqRepeat').value,
      skill: $('#mqSkill').value, project: $('#mqProject').value,
      subtasks: $('#mqSubs').value.split('\n').map(s => s.trim()).filter(Boolean).map(t => ({ t, done: false })),
    };
    if (isEdit) {
      Object.assign(q, data, { xp: DIFF[data.diff].xp, gold: DIFF[data.diff].gold });
      q.unstructured = !q.due && !q.desc && !q.mini;
      saveState();
    } else {
      createQuest(data);
    }
    closeModal(); renderAll();
  };
}

function dayModeModal() {
  openModal(`
    <h3>Какой сегодня день?</h3>
    <div class="msub">Режим определяет нагрузку. Честный выбор важнее амбициозного.</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${Object.keys(MODES).map(m => `
        <div class="mode-btn" data-mmode="${m}" style="text-align:left;display:flex;gap:12px;align-items:center">
          <div class="mi">${MODES[m].ico}</div>
          <div><div class="mn">${MODES[m].n}</div><div class="md">${MODES[m].d}</div></div>
        </div>`).join('')}
    </div>`);
  $$('[data-mmode]').forEach(el => el.onclick = () => { setDayMode(el.dataset.mmode); closeModal(); renderAll(); });
}

function minimalDayModal() {
  const day = getDay();
  if (day.minimal) { modalInfo('Уже засчитан', 'Минимальный день сегодня уже выполнен. Всё сверх — бонус.'); return; }
  openModal(`
    <h3>🌙 Минимальный день</h3>
    <div class="msub">Отметь, что реально сделал. Все три пункта + энергия = день засчитан (+30 XP). Это защита от выпадения, а не наказание.</div>
    <label style="display:flex;gap:8px;padding:6px 0;cursor:pointer"><input type="checkbox" id="md1"> 10 минут карьерного действия (что угодно: урок, промпт, заметка)</label>
    <label style="display:flex;gap:8px;padding:6px 0;cursor:pointer"><input type="checkbox" id="md2"> Одно действие для здоровья (вода, прогулка, сон вовремя)</label>
    <label style="display:flex;gap:8px;padding:6px 0;cursor:pointer"><input type="checkbox" id="md3"> Одно действие для семьи или быта</label>
    <label class="f">Энергия сегодня (1–10)</label>
    <div class="energy-row" id="mdEnergy">${[1,2,3,4,5,6,7,8,9,10].map(v => `<div class="energy-dot" data-me="${v}">${v}</div>`).join('')}</div>
    <div class="btn-row">
      <button class="btn primary" id="mdSave">Засчитать минимальный день</button>
      <button class="btn" data-mclose="1">Позже</button>
    </div>`);
  let energy = getDay().energy || null;
  $$('[data-me]').forEach(el => {
    if (+el.dataset.me === energy) el.classList.add('sel');
    el.onclick = () => { energy = +el.dataset.me; $$('[data-me]').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); };
  });
  $('#mdSave').onclick = () => {
    if (!$('#md1').checked || !$('#md2').checked || !$('#md3').checked) { toast('Отметь все три пункта — они совсем маленькие', 'warn'); return; }
    if (!energy) { toast('Отметь энергию — это и есть «короткая отметка состояния»', 'warn'); return; }
    completeMinimalDay(true, energy);
    closeModal(); renderAll();
  };
}

function skillModal(id) {
  const sk = findSkill(id);
  if (!sk) return;
  openModal(`
    <h3>◈ ${esc(sk.name)}</h3>
    <div class="msub">Уровень ${sk.lvl}/10 · ${sk.xp}/${skillLevelNeed(sk.lvl)} XP до следующего · статус: ${sk.status === 'mastered' ? 'освоен' : sk.status === 'learning' ? 'изучается' : 'доступен'}</div>
    <div class="bar" style="margin-bottom:12px"><div class="bar-fill cold" style="width:${sk.lvl * 10}%"></div></div>
    <div class="info-box">Навык прокачивается практикой: связанные квесты и запись практики ниже. «Освоен» = уровень 7+ и минимум 3 доказательства.</div>
    <label class="f">Записать практику (что конкретно сделал?)</label>
    <input class="f" id="skProof" placeholder="Например: сверстал карточку товара по макету">
    <div class="btn-row">
      <button class="btn primary" id="skAdd">+ Практика (+20 XP навыка)</button>
      <button class="btn" data-mclose="1">Закрыть</button>
    </div>
    ${sk.proofs.length ? `<hr class="divider"><div class="card-title">Доказательства практики</div>
      ${sk.proofs.slice(-6).reverse().map(p => `<div style="font-size:12.5px;color:var(--text2);padding:3px 0">${fmtDate(p.d)} · ${esc(p.t)}</div>`).join('')}` : ''}`);
  $('#skAdd').onclick = () => {
    const t = $('#skProof').value.trim();
    if (!t) { toast('Опиши, что сделал — это твоё доказательство', 'warn'); return; }
    addSkillXP(id, 20, t);
    addXP(10, 'study', 'Практика: ' + sk.name);
    markDayActive();
    closeModal(); renderAll();
  };
}

function projectModal(p = null) {
  const isEdit = !!p;
  openModal(`
    <h3>${isEdit ? esc(p.name) : 'Новый проект'}</h3>
    <label class="f">Название *</label><input class="f" id="mpName" value="${esc(p ? p.name : '')}">
    <label class="f">Какую проблему решает</label><input class="f" id="mpProblem" value="${esc(p ? p.problem : '')}">
    <div class="frow">
      <div><label class="f">Для кого</label><input class="f" id="mpAud" value="${esc(p ? p.audience : '')}"></div>
      <div><label class="f">Приоритет</label>
        <select class="f" id="mpPr"><option value="high" ${p && p.priority === 'high' ? 'selected' : ''}>Высокий</option>
        <option value="mid" ${!p || p.priority === 'mid' ? 'selected' : ''}>Средний</option>
        <option value="low" ${p && p.priority === 'low' ? 'selected' : ''}>Низкий</option></select></div>
    </div>
    <details class="adv" ${isEdit ? 'open' : ''}>
      <summary>Детали</summary>
      <label class="f">Идея решения</label><textarea class="f" id="mpIdea">${esc(p ? p.idea : '')}</textarea>
      <div class="frow">
        <div><label class="f">Технологии</label><input class="f" id="mpTech" value="${esc(p ? p.tech : '')}"></div>
        <div><label class="f">Планируемое завершение</label><input class="f" type="date" id="mpPlanned" value="${p ? p.planned : ''}"></div>
      </div>
      <label class="f">Ссылка (когда появится)</label><input class="f" id="mpLink" value="${esc(p ? p.link : '')}">
      <label class="f">Результат</label><textarea class="f" id="mpResult">${esc(p ? p.result : '')}</textarea>
      <label class="f">Чему научился</label><textarea class="f" id="mpLearned">${esc(p ? p.learned : '')}</textarea>
      <label class="f">Можно ли монетизировать</label><input class="f" id="mpMon" value="${esc(p ? p.monetizable : '')}">
      <label class="f">Задачи (по одной на строку)</label>
      <textarea class="f" id="mpTasks">${p ? p.tasks.map(t => (t.done ? '✔ ' : '') + t.t).join('\n') : ''}</textarea>
    </details>
    <div class="btn-row">
      <button class="btn primary" id="mpSave">${isEdit ? 'Сохранить' : 'Создать (статус: идея)'}</button>
      ${isEdit && !['done','published','monetized'].includes(p.status) ? '<button class="btn ok" id="mpActivate">▶ Сделать активным</button>' : ''}
      <button class="btn" data-mclose="1">Отмена</button>
    </div>`);
  $('#mpSave').onclick = () => {
    const name = $('#mpName').value.trim();
    if (!name) { toast('Нужно название', 'warn'); return; }
    const tasks = $('#mpTasks').value.split('\n').map(s => s.trim()).filter(Boolean)
      .map(t => t.startsWith('✔') ? { t: t.replace(/^✔\s*/, ''), done: true } : { t, done: false });
    const data = { name, problem: $('#mpProblem').value, audience: $('#mpAud').value, priority: $('#mpPr').value,
      idea: $('#mpIdea').value, tech: $('#mpTech').value, planned: $('#mpPlanned').value,
      link: $('#mpLink').value, result: $('#mpResult').value, learned: $('#mpLearned').value,
      monetizable: $('#mpMon').value, tasks };
    if (isEdit) { Object.assign(p, data); }
    else S.projects.push({ id: uid(), status: 'idea', started: '', skills: [], content: '', demo: false, ...data });
    saveState(); closeModal(); renderAll();
  };
  const act = $('#mpActivate');
  if (act) act.onclick = () => { if (setProjectStatus(p.id, 'active')) { closeModal(); renderAll(); } };
}

function contentModal(c = null) {
  const isEdit = !!c;
  openModal(`
    <h3>${isEdit ? 'Контент' : 'Идея контента'}</h3>
    <label class="f">Тема *</label><input class="f" id="mcTopic" value="${esc(c ? c.topic : '')}" placeholder="День 1: бариста решил стать AI-разработчиком">
    <div class="frow">
      <div><label class="f">Рубрика</label><select class="f" id="mcRubric">${RUBRICS.map(r => `<option ${c && c.rubric === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      <div><label class="f">Площадка</label><select class="f" id="mcPlatform">${PLATFORMS.map(pl => `<option ${c && c.platform === pl ? 'selected' : ''}>${pl}</option>`).join('')}</select></div>
    </div>
    <label class="f">Хук (первые 2 секунды)</label><input class="f" id="mcHook" value="${esc(c ? c.hook : '')}" placeholder="«Я варю кофе 12 часов в день. Через год уволюсь»">
    <details class="adv" ${isEdit ? 'open' : ''}>
      <summary>Сценарий и метрики</summary>
      <label class="f">Краткий сценарий</label><textarea class="f" id="mcScript">${esc(c ? c.script : '')}</textarea>
      <div class="frow">
        <div><label class="f">Исходный проект</label>
          <select class="f" id="mcProject"><option value="">—</option>${S.projects.map(p => `<option value="${p.id}" ${c && c.project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div><label class="f">Формат</label><input class="f" id="mcFormat" value="${esc(c ? c.format : 'Короткий ролик')}"></div>
      </div>
      ${isEdit ? `
      <div class="frow3">
        <div><label class="f">Просмотры</label><input class="f" type="number" id="mcViews" value="${c.views}"></div>
        <div><label class="f">Лайки</label><input class="f" type="number" id="mcLikes" value="${c.likes}"></div>
        <div><label class="f">Комментарии</label><input class="f" type="number" id="mcComments" value="${c.comments}"></div>
      </div>
      <div class="frow">
        <div><label class="f">Сохранения</label><input class="f" type="number" id="mcSaves" value="${c.saves}"></div>
        <div><label class="f">Новые подписчики</label><input class="f" type="number" id="mcSubs" value="${c.subs}"></div>
      </div>
      <label class="f">Что сработало</label><input class="f" id="mcWorked" value="${esc(c.worked)}">
      <label class="f">Что улучшить</label><input class="f" id="mcImprove" value="${esc(c.improve)}">` : ''}
    </details>
    <div class="btn-row">
      <button class="btn primary" id="mcSave">${isEdit ? 'Сохранить' : 'Создать'}</button>
      <button class="btn" data-mclose="1">Отмена</button>
    </div>`);
  $('#mcSave').onclick = () => {
    const topic = $('#mcTopic').value.trim();
    if (!topic) { toast('Нужна тема', 'warn'); return; }
    if (isEdit) {
      const oldSubs = c.subs;
      Object.assign(c, {
        topic, rubric: $('#mcRubric').value, platform: $('#mcPlatform').value, hook: $('#mcHook').value,
        script: $('#mcScript').value, project: $('#mcProject').value, format: $('#mcFormat').value,
        views: +$('#mcViews').value || 0, likes: +$('#mcLikes').value || 0, comments: +$('#mcComments').value || 0,
        saves: +$('#mcSaves').value || 0, subs: +$('#mcSubs').value || 0,
        worked: $('#mcWorked').value, improve: $('#mcImprove').value,
      });
      S.contentStats.subsGained += Math.max(0, c.subs - oldSubs);
    } else {
      createContent({ topic, rubric: $('#mcRubric').value, platform: $('#mcPlatform').value,
        hook: $('#mcHook').value, script: $('#mcScript').value, project: $('#mcProject').value, format: $('#mcFormat').value });
    }
    checkAchievements(); saveState(); closeModal(); renderAll();
  };
}

function subsModal() {
  openModal(`
    <h3>Подписчики площадок</h3>
    <div class="msub">Обновляй раз в неделю — прирост считается автоматически.</div>
    <div class="frow">
      <div><label class="f">TikTok</label><input class="f" type="number" id="msTt" value="${S.contentStats.tiktokSubs}"></div>
      <div><label class="f">Instagram</label><input class="f" type="number" id="msIg" value="${S.contentStats.instaSubs}"></div>
    </div>
    <div class="btn-row"><button class="btn primary" id="msSave">Сохранить</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#msSave').onclick = () => {
    const tt = +$('#msTt').value || 0, ig = +$('#msIg').value || 0;
    S.contentStats.subsGained += Math.max(0, tt - S.contentStats.tiktokSubs) + Math.max(0, ig - S.contentStats.instaSubs);
    S.contentStats.tiktokSubs = tt; S.contentStats.instaSubs = ig;
    checkAchievements(); saveState(); closeModal(); renderAll();
  };
}

function debtPayModal(debtId) {
  const d = S.finance.debts.find(x => x.id === debtId);
  openModal(`
    <h3>Платёж: ${esc(d.n)}</h3>
    <div class="msub">Остаток: ${fmtMoney(d.balance)} · минимальный платёж ${fmtMoney(d.minPay)}</div>
    <label class="f">Сумма платежа, ₽</label>
    <input class="f" type="number" id="mdpSum" value="${d.minPay}">
    <div class="card-note">Всё, что больше минимального — досрочное погашение (и достижение ⚡).</div>
    <div class="btn-row"><button class="btn primary" id="mdpSave">Записать</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mdpSave').onclick = () => {
    const sum = +$('#mdpSum').value || 0;
    if (sum <= 0) { toast('Сумма должна быть больше нуля', 'warn'); return; }
    recordDebtPayment(debtId, sum, Math.max(0, sum - d.minPay));
    closeModal(); renderAll();
  };
}

function babyItemModal() {
  openModal(`
    <h3>Покупка для ребёнка</h3>
    <label class="f">Название</label><input class="f" id="mbN">
    <div class="frow">
      <div><label class="f">Стоимость, ₽</label><input class="f" type="number" id="mbC" value="0"></div>
      <div><label class="f">Приоритет</label><select class="f" id="mbP"><option value="high">Высокий</option><option value="mid" selected>Средний</option><option value="low">Низкий</option></select></div>
    </div>
    <label class="f">Комментарий</label><input class="f" id="mbNote">
    <div class="btn-row"><button class="btn primary" id="mbSave">Добавить</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mbSave').onclick = () => {
    const n = $('#mbN').value.trim();
    if (!n) { toast('Нужно название', 'warn'); return; }
    S.finance.babyFund.items.push({ id: uid(), n, cost: +$('#mbC').value || 0, bought: false, pr: $('#mbP').value, note: $('#mbNote').value });
    saveState(); closeModal(); renderAll();
  };
}

function newIncomeModal() {
  openModal(`
    <h3>💵 Доход от нового направления</h3>
    <div class="msub">Первые деньги вне найма — самые важные. Они доказывают, что путь работает.</div>
    <label class="f">Источник</label><input class="f" id="mniSrc" placeholder="Лендинг для кофейни / монтаж ролика">
    <div class="frow">
      <div><label class="f">Сумма, ₽</label><input class="f" type="number" id="mniSum" value="0"></div>
      <div><label class="f">Тип</label><select class="f" id="mniType"><option>услуга</option><option>контент</option><option>продукт</option></select></div>
    </div>
    <div class="btn-row"><button class="btn primary" id="mniSave">Записать</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mniSave').onclick = () => {
    const sum = +$('#mniSum').value || 0;
    if (sum <= 0) { toast('Сумма должна быть больше нуля', 'warn'); return; }
    S.finance.newIncome.push({ id: uid(), date: todayStr(), source: $('#mniSrc').value || 'Без названия', sum, type: $('#mniType').value });
    addXP(100, 'finance', 'Новый доход: ' + fmtMoney(sum));
    addGold(50, 'Новый доход');
    markDayActive(); checkAchievements(); saveState(); closeModal(); renderAll();
    toast('💵 Записано! Это реальный шаг к свободе.', 'ok');
  };
}

function familyDateModal() {
  openModal(`
    <h3>Важная дата</h3>
    <label class="f">Название</label><input class="f" id="mfdN">
    <label class="f">Дата</label><input class="f" type="date" id="mfdD">
    <div class="btn-row"><button class="btn primary" id="mfdSave">Добавить</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mfdSave').onclick = () => {
    if (!$('#mfdN').value.trim() || !$('#mfdD').value) { toast('Заполни оба поля', 'warn'); return; }
    S.family.dates.push({ id: uid(), n: $('#mfdN').value.trim(), date: $('#mfdD').value });
    S.family.dates.sort((a, b) => a.date < b.date ? -1 : 1);
    saveState(); closeModal(); renderAll();
  };
}

function familyTaskModal() {
  openModal(`
    <h3>Семейная / бытовая задача</h3>
    <label class="f">Что нужно сделать</label><input class="f" id="mftT" placeholder="Собрать список покупок для малыша">
    <div class="btn-row"><button class="btn primary" id="mftSave">Добавить</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mftSave').onclick = () => {
    const t = $('#mftT').value.trim();
    if (!t) { toast('Опиши задачу', 'warn'); return; }
    S.family.tasks.push({ id: uid(), t, done: false });
    saveState(); closeModal(); renderAll();
  };
}

function rewardModal(r = null) {
  openModal(`
    <h3>${r ? 'Изменить награду' : 'Своя награда'}</h3>
    <div class="msub">Помни: сон, еда, отдых и семья бесплатны. Награды — для дополнительных удовольствий.</div>
    <label class="f">Название</label><input class="f" id="mrN" value="${esc(r ? r.n : '')}">
    <label class="f">Цена в Gold</label><input class="f" type="number" id="mrC" value="${r ? r.cost : 50}">
    <div class="btn-row"><button class="btn primary" id="mrSave">Сохранить</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#mrSave').onclick = () => {
    const n = $('#mrN').value.trim(), cost = Math.max(1, +$('#mrC').value || 50);
    if (!n) { toast('Нужно название', 'warn'); return; }
    if (r) { r.n = n; r.cost = cost; } else S.rewards.push({ id: uid(), n, cost });
    saveState(); closeModal(); renderAll();
  };
}

function ideaModal() {
  openModal(`
    <h3>💡 Идея в хранилище</h3>
    <div class="msub">Идея — не обязательство. Она подождёт здесь, пока ты завершаешь начатое.</div>
    <label class="f">Идея</label><input class="f" id="miT">
    <div class="frow">
      <div><label class="f">Категория</label><select class="f" id="miC"><option>Проект</option><option>Контент</option><option>Доход</option><option>Навык</option><option>Прочее</option></select></div>
      <div><label class="f">Затраты времени</label><input class="f" id="miCost" placeholder="~10 часов"></div>
    </div>
    <label class="f">Потенциальная польза</label><input class="f" id="miB">
    <div class="btn-row"><button class="btn primary" id="miSave">В хранилище</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#miSave').onclick = () => {
    const t = $('#miT').value.trim();
    if (!t) { toast('Опиши идею', 'warn'); return; }
    addIdea({ t, cat: $('#miC').value, benefit: $('#miB').value, cost: $('#miCost').value });
    closeModal(); toast('Идея сохранена. Вернись к ней на недельном обзоре.', 'ok'); renderAll();
  };
}

function reviewModal() {
  openModal(`
    <h3>📋 Недельный обзор</h3>
    <div class="msub">10 минут честности. Это самый ценный ритуал системы (+70 XP, +жетон 🛡).</div>
    ${REVIEW_QUESTIONS.map(([k, q]) => `<label class="f">${q}</label><textarea class="f" id="rv_${k}" style="min-height:44px"></textarea>`).join('')}
    <hr class="divider">
    <div class="card-title">Оценки недели (1–10)</div>
    ${REVIEW_SCORES.map((s, i) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="width:110px;font-size:12.5px;color:var(--text2)">${s}</span>
        <input type="range" min="1" max="10" value="5" id="rvs_${i}" style="flex:1">
        <b id="rvsv_${i}" style="width:24px;text-align:right">5</b>
      </div>`).join('')}
    <div class="btn-row"><button class="btn primary" id="rvSave">Сохранить обзор</button><button class="btn" data-mclose="1">Позже</button></div>`);
  REVIEW_SCORES.forEach((_, i) => {
    $('#rvs_' + i).oninput = e => $('#rvsv_' + i).textContent = e.target.value;
  });
  $('#rvSave').onclick = () => {
    const answers = {};
    for (const [k] of REVIEW_QUESTIONS) answers[k] = $('#rv_' + k).value.trim();
    const scores = REVIEW_SCORES.map((_, i) => +$('#rvs_' + i).value);
    const r = saveReview(answers, scores);
    closeModal();
    modalInfo('Резюме недели', esc(r.summary) + '<br><br>Три цели на следующую неделю: <b>' + esc(answers.top3 || 'не указаны') + '</b>');
    renderAll();
  };
}

function seasonEndModal(season) {
  const doneGoals = season.goals.filter(g => g.done).length;
  openModal(`
    <h3>🏁 Итоги сезона «${esc(season.n)}»</h3>
    <div class="msub">Выполнено целей: ${doneGoals}/${season.goals.length} (${pct(doneGoals, season.goals.length)}%). Сезон — глава истории, а не экзамен.</div>
    <label class="f">Лучшие действия сезона</label><textarea class="f" id="msBest"></textarea>
    <label class="f">Ошибки и выводы</label><textarea class="f" id="msErr"></textarea>
    <label class="f">Что получено (навыки, деньги, проекты, публикации)</label><textarea class="f" id="msGain"></textarea>
    <label class="f">Решение о следующем сезоне</label><input class="f" id="msNext" placeholder="Например: Сезон 2 — основа Vibe Coding">
    <div class="btn-row"><button class="btn primary" id="msFinish">Завершить сезон</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#msFinish').onclick = () => {
    finishSeason(season.id, {
      pct: pct(doneGoals, season.goals.length), best: $('#msBest').value, errors: $('#msErr').value,
      gained: $('#msGain').value, next: $('#msNext').value,
    });
    closeModal(); newSeasonModal($('#msNext').value); 
  };
}

function newSeasonModal(suggestedName = '') {
  openModal(`
    <h3>Новый сезон (30 дней)</h3>
    <div class="msub">Максимум 5 целей: карьера, финансы, здоровье, семья, контент. Меньше — можно, больше — нельзя.</div>
    <label class="f">Название сезона</label>
    <input class="f" id="mnsName" value="${esc(suggestedName || 'Сезон ' + (S.seasons.length + 1))}">
    ${['Карьера', 'Финансы', 'Здоровье', 'Семья', 'Контент'].map((t, i) => `
      <label class="f">${t} — цель</label><input class="f" id="mnsG${i}" placeholder="Одна конкретная цель (можно оставить пустой)">`).join('')}
    <label class="f">Имя босса сезона</label>
    <input class="f" id="mnsBoss" placeholder="Например: Страх первого клиента">
    <div class="btn-row"><button class="btn primary" id="mnsStart">Начать сезон</button><button class="btn" data-mclose="1">Позже</button></div>`);
  $('#mnsStart').onclick = () => {
    const goals = ['Карьера', 'Финансы', 'Здоровье', 'Семья', 'Контент']
      .map((t, i) => ({ type: t, t: $('#mnsG' + i).value.trim(), done: false }))
      .filter(g => g.t);
    if (!goals.length) { toast('Нужна хотя бы одна цель', 'warn'); return; }
    const bossName = $('#mnsBoss').value.trim() || 'Новый вызов';
    startNewSeason({
      n: $('#mnsName').value.trim() || 'Сезон ' + (S.seasons.length + 1),
      goals,
      boss: { n: bossName, hp: 100, maxHp: 100, defeated: false,
        actions: goals.map((g, i) => ({ id: 'a' + i, n: g.t, dmg: Math.floor(100 / (goals.length + 1)), done: false }))
          .concat([{ id: 'aw', n: 'Провести 4 недельных обзора за сезон',
            dmg: 100 - Math.floor(100 / (goals.length + 1)) * goals.length, done: false }]) },
    });
    closeModal(); renderAll();
    toast('🚀 Сезон начат. Ровный темп, минимум в тяжёлые дни.', 'ok');
  };
}

/* ════════ 25. ОНБОРДИНГ (мастер первого запуска) ════════ */

const ONB_STEPS = 8;
let onbData = {};

function renderOnboarding(step = 1) {
  const dots = `<div class="onb-dots">${Array.from({ length: ONB_STEPS }, (_, i) => `<div class="onb-dot ${i < step ? 'on' : ''}"></div>`).join('')}</div>`;
  const wrap = (title, sub, body, canBack = true) => `
    <div class="onb">
      <div class="onb-step">Шаг ${step} из ${ONB_STEPS}</div>
      <h2>${title}</h2>
      <div class="msub">${sub}</div>
      ${body}
      <div class="btn-row" style="margin-top:18px">
        ${canBack && step > 1 ? '<button class="btn" id="onbBack">← Назад</button>' : ''}
        <button class="btn primary" id="onbNext">${step === ONB_STEPS ? '⚡ Начать игру' : 'Далее →'}</button>
      </div>
      ${dots}
    </div>`;

  const screens = {
    1: () => wrap('Добро пожаловать в PROJECT EGO', 'Это твоя система на год: от бариста к AI-создателю. Начнём с главного героя.', `
      <label class="f">Твоё имя</label><input class="f" id="ob_name" value="${esc(onbData.name ?? S.profile.name)}">
      <label class="f">Имя персонажа (никнейм в системе)</label><input class="f" id="ob_char" value="${esc(onbData.charName ?? S.profile.charName)}">`),
    2: () => wrap('Рабочий график', 'Система подстроит нагрузку под реальность, а не наоборот.', `
      <label class="f">График на основной работе</label><input class="f" id="ob_work" value="${esc(onbData.workHours ?? S.profile.workHours)}">
      <label class="f">Сколько часов в неделю реально есть на развитие?</label>
      <input class="f" type="number" id="ob_free" value="${onbData.freeHoursWeek ?? S.profile.freeHoursWeek}">
      <div class="info-box" style="margin-top:10px">5 часов в неделю — это нормально. Постоянные 5 часов сильнее случайных 20.</div>`),
    3: () => wrap('Цели на 12 месяцев', 'Уже заполнено из твоего плана — поправь, если что-то изменилось.', `
      <textarea class="f" id="ob_goal" style="min-height:90px">${esc(onbData.goal12m ?? S.profile.goal12m)}</textarea>
      <div class="info-box" style="margin-top:10px">Ориентиры: 150 000 ₽/мес через 6 месяцев, 250 000 ₽/мес через 12. Без импульсивного увольнения.</div>`),
    4: () => wrap('Долги и накопления', 'Данные из твоего финансового плана. Уточни по реальным выпискам.', `
      ${S.finance.debts.map((d, i) => `
        <div class="card" style="margin-bottom:8px"><b>${esc(d.n)}</b>
          <div class="frow3">
            <div><label class="f">Остаток, ₽</label><input class="f" type="number" id="ob_d${i}b" value="${d.balance}"></div>
            <div><label class="f">Ставка, %</label><input class="f" type="number" step="0.1" id="ob_d${i}r" value="${d.rate}"></div>
            <div><label class="f">Платёж, ₽</label><input class="f" type="number" id="ob_d${i}m" value="${d.minPay}"></div>
          </div></div>`).join('')}
      <div class="frow">
        <div><label class="f">Уже накоплено (подушка), ₽</label><input class="f" type="number" id="ob_cush" value="${S.finance.cushion.current}"></div>
        <div><label class="f">Фонд «Роды и ребёнок», ₽</label><input class="f" type="number" id="ob_baby" value="${S.finance.babyFund.current}"></div>
      </div>
      <div class="info-box" style="margin-top:10px">⚠ Расчёты ориентировочные и не заменяют банковскую выписку.</div>`),
    5: () => wrap('Энергия и время', 'Система различает дисциплину и перегрузку. Ей нужна честная точка старта.', `
      <label class="f">Энергия в обычный рабочий день (1–10)</label>
      <div class="energy-row" id="ob_energyRow">${[1,2,3,4,5,6,7,8,9,10].map(v => `<div class="energy-dot ${(onbData.energy ?? 5) === v ? 'sel' : ''}" data-obe="${v}">${v}</div>`).join('')}</div>
      <div class="info-box" style="margin-top:12px">После смены 09:00–21:00 сил мало — это нормально. Для таких дней есть «Минимальный день» (10–15 минут) и режим восстановления. Один пропуск ничего не обнуляет.</div>`),
    6: () => wrap('Сезон 1: Возвращение в систему', '30 дней. Пять целей. Один босс.', `
      <div class="card">${activeSeason().goals.map(g => `<div style="padding:4px 0;font-size:13.5px">◈ <b>${esc(g.type)}:</b> ${esc(g.t)}</div>`).join('')}</div>
      <div class="boss" style="margin-top:10px">
        <div class="boss-name">👹 ${esc(activeSeason().boss.n)} · 100 HP</div>
        <div class="card-note" style="margin-top:6px">Каждое действие сезона бьёт по боссу. Завершение этой настройки снимет первые 10 HP.</div>
      </div>`),
    7: () => wrap('Основная карьерная ветка', 'Одна последовательность вместо десяти карьер.', `
      <div class="card" style="font-size:13.5px;line-height:2">
        ☕ бариста → 🤖 AI-инструменты → ✍ Prompt Engineering → ⚡ Vibe Coding →
        🌐 сайты и приложения → 🔁 автоматизация → 📁 портфолио → 💰 первые заказы →
        🎬 контент о пути → 📦 свои продукты → 🕊 свобода
      </div>
      <div class="info-box" style="margin-top:10px">Контент — побочный продукт обучения: изучил → сделал → показал. Каждая крупная задача даёт навык + портфолио + ролик + потенциальный доход.</div>`),
    8: () => wrap('Первый квест', 'Начнём с маленького. Он уже ждёт в списке на сегодня.', `
      <label class="f">Название первого квеста</label>
      <input class="f" id="ob_q" value="${esc(onbData.firstQuest ?? 'Открыть PROJECT EGO завтра и выбрать режим дня')}">
      <div class="info-box" style="margin-top:10px">Также я добавил несколько демо-квестов для примера — их можно удалить в настройках одной кнопкой.</div>`),
  };

  $('#app').classList.add('hidden');
  $('#boot').classList.add('hidden');
  let onb = $('#onbRoot');
  if (!onb) {
    onb = document.createElement('div');
    onb.id = 'onbRoot';
    document.body.appendChild(onb);
  }
  onb.innerHTML = screens[step]();

  const collect = () => {
    if (step === 1) { onbData.name = $('#ob_name').value.trim() || 'Герой'; onbData.charName = $('#ob_char').value.trim() || 'HERO'; }
    if (step === 2) { onbData.workHours = $('#ob_work').value; onbData.freeHoursWeek = +$('#ob_free').value || 5; }
    if (step === 3) { onbData.goal12m = $('#ob_goal').value; }
    if (step === 4) {
      S.finance.debts.forEach((d, i) => {
        d.balance = +$('#ob_d' + i + 'b').value || 0;
        d.initialBalance = Math.max(d.balance, d.initialBalance);
        d.rate = +$('#ob_d' + i + 'r').value || 0;
        d.minPay = +$('#ob_d' + i + 'm').value || 0;
      });
      S.finance.cushion.current = +$('#ob_cush').value || 0;
      S.finance.babyFund.current = +$('#ob_baby').value || 0;
    }
    if (step === 8) { onbData.firstQuest = $('#ob_q').value.trim(); }
  };

  if ($('#onbBack')) $('#onbBack').onclick = () => { collect(); renderOnboarding(step - 1); };
  $$('[data-obe]').forEach(el => el.onclick = () => {
    onbData.energy = +el.dataset.obe;
    $$('[data-obe]').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
  });

  $('#onbNext').onclick = () => {
    collect();
    if (step < ONB_STEPS) { renderOnboarding(step + 1); return; }
    // Финализация
    S.profile.name = onbData.name || S.profile.name;
    S.profile.charName = onbData.charName || S.profile.charName;
    S.profile.workHours = onbData.workHours || S.profile.workHours;
    S.profile.freeHoursWeek = onbData.freeHoursWeek || S.profile.freeHoursWeek;
    S.profile.goal12m = onbData.goal12m || S.profile.goal12m;
    if (onbData.energy) { getDay().energy = onbData.energy; saveHealth(todayStr(), { energy: onbData.energy }); }
    if (onbData.firstQuest) createQuest({ name: onbData.firstQuest, cat: 'story', diff: 'E', desc: 'Первый шаг нового пути', mini: 'Просто открыть приложение' });
    S.quests.push(...seedDemoQuests());
    addIdea({ t: 'Сделать серию AI-обложек в стиле Solo Leveling для своих роликов', cat: 'Контент', benefit: 'Единый стиль канала', cost: '~3 часа', demo: true });
    createContent({ topic: 'Бариста решил стать AI-разработчиком. День 1', rubric: RUBRICS[0], platform: 'TikTok',
      hook: '«Я варю кофе по 12 часов. Через год планирую уволиться»', demo: true });
    S.onboarded = true;
    hitBoss('ba1'); // −10 HP за настройку
    checkAchievements();
    saveState();
    onb.remove();
    $('#app').classList.remove('hidden');
    renderAll();
    toast('⚡ Система активирована. Добро пожаловать, ' + S.profile.charName + '.', 'ok');
  };
}

/* ════════ 25b. ФИТНЕС-МОДУЛЬ ════════
   12-месячный план набора формы с постепенной прогрессией.
   Первые 4–6 недель — без отказных подходов (щадящий старт, по самочувствию). */

const WORKOUTS = [
  { id: 'w1', n: 'Д1 · Грудь + трицепс', ex: ['Жим штанги 4×6–8', 'Жим гантелей 3×10', 'Разводка 3×12', 'Отжимания 3 подхода', 'Французский жим 3×10', 'Разгибания на блоке 3×12'] },
  { id: 'w2', n: 'Д2 · Спина + бицепс', ex: ['Тяга верхнего блока 4×10', 'Горизонтальная тяга 3×10', 'Тяга гантели 3×12', 'Гиперэкстензия 3×15', 'Подъём штанги на бицепс 3×10', 'Молотки 3×12'] },
  { id: 'w4', n: 'Д4 · Ноги', ex: ['Присед 4×8', 'Жим ногами 3×12', 'Румынская тяга 3×10', 'Сгибание ног 3×12', 'Разгибание ног 3×12', 'Икры 5×15'] },
  { id: 'w5', n: 'Д5 · Плечи + пресс', ex: ['Жим сидя 4×8', 'Подъёмы в стороны 5×15', 'Передние подъёмы 3×12', 'Задняя дельта 4×15', 'Шраги 4×12', 'Пресс 15 минут'] },
  { id: 'wc', n: 'Кардио / ходьба', ex: ['Быстрая ходьба 20–30 минут', '10–12 тыс. шагов за день'] },
  { id: 'wp', n: 'Пресс (3×/нед)', ex: ['Подъём ног 3×15', 'Скручивания 3×20', 'Планка 3×60 сек'] },
];

/* Гарантирует наличие блока фитнеса в старых сохранениях */
function fitnessState() {
  if (!S.fitness) {
    S.fitness = { startWeight: 80, goalMin: 70, goalMax: 75, weights: [], measures: [], workouts: [], lastPhoto: null };
  }
  return S.fitness;
}

function logWeight(kg) {
  const F = fitnessState();
  const t = todayStr();
  const existing = F.weights.find(w => w.d === t);
  if (existing) existing.kg = kg;
  else F.weights.push({ d: t, kg });
  addXP(15, 'health', 'Вес: ' + kg + ' кг');
  markDayActive();
  checkAchievements();
  saveState();
  toast('⚖ Записано: ' + kg + ' кг. Смотри на тренд недель, не дней.', 'ok');
}

function completeWorkout(dayId, doneEx, note) {
  const F = fitnessState();
  const w = WORKOUTS.find(x => x.id === dayId);
  if (!w || !doneEx.length) return;
  F.workouts.push({ d: todayStr(), day: dayId, name: w.n, ex: doneEx, note: note || '' });
  const xp = clamp(15 + doneEx.length * 8, 15, 70);
  addXP(xp, 'health', 'Тренировка: ' + w.n);
  addGold(Math.round(xp / 3), 'Тренировка');
  applyStats({ endurance: 2, health: 1, discipline: 1 });
  markDayActive();
  checkAchievements();
  saveState();
  toast(`🏋 Тренировка записана: +${xp} XP. Прогрессия: +1 повтор или +2,5 кг на следующей.`, 'ok');
}

function workoutsThisWeek() {
  const from = todayStr(-6);
  return fitnessState().workouts.filter(w => w.d >= from).length;
}

function workoutModal(dayId) {
  const w = WORKOUTS.find(x => x.id === dayId);
  if (!w) return;
  const startDate = S.meta.created.slice(0, 10);
  const earlyPhase = dateDiffDays(startDate, todayStr()) < 42;
  openModal(`
    <h3>🏋 ${esc(w.n)}</h3>
    <div class="msub">Отметь, что сделал. Не всё — тоже нормально: XP идёт за каждое упражнение.</div>
    ${earlyPhase ? '<div class="warn-box">🫁 Щадящий режим: 2–3 повторения в запасе, без отказа. Боль в груди или необычная одышка — стоп и к врачу.</div>' : ''}
    ${w.ex.map((e, i) => `<label style="display:flex;gap:8px;padding:6px 0;cursor:pointer;font-size:13.5px">
      <input type="checkbox" data-wex="${i}"> ${esc(e)}</label>`).join('')}
    <label class="f">Заметка (веса, самочувствие)</label>
    <input class="f" id="wNote" placeholder="жим 40 кг легко, в следующий раз 42,5">
    <div class="btn-row">
      <button class="btn primary" id="wDone">Завершить тренировку</button>
      <button class="btn" data-mclose="1">Отмена</button>
    </div>`);
  $('#wDone').onclick = () => {
    const done = $$('[data-wex]').map((el, i) => el.checked ? w.ex[i] : null).filter(Boolean);
    if (!done.length) { toast('Отметь хотя бы одно упражнение', 'warn'); return; }
    completeWorkout(dayId, done, $('#wNote').value.trim());
    closeModal(); renderAll();
  };
}

function measureModal() {
  const F = fitnessState();
  const last = F.measures.length ? F.measures[F.measures.length - 1] : {};
  openModal(`
    <h3>📏 Замеры (см)</h3>
    <div class="msub">Раз в месяц, утром, до еды. Пустые поля можно пропустить.</div>
    <div class="frow3">
      <div><label class="f">Талия</label><input class="f" type="number" step="0.5" id="msWaist" placeholder="${last.waist || ''}"></div>
      <div><label class="f">Грудь</label><input class="f" type="number" step="0.5" id="msChest" placeholder="${last.chest || ''}"></div>
      <div><label class="f">Руки</label><input class="f" type="number" step="0.5" id="msArms" placeholder="${last.arms || ''}"></div>
    </div>
    <div class="frow">
      <div><label class="f">Бёдра</label><input class="f" type="number" step="0.5" id="msHips" placeholder="${last.hips || ''}"></div>
      <div><label class="f">Шея</label><input class="f" type="number" step="0.5" id="msNeck" placeholder="${last.neck || ''}"></div>
    </div>
    <div class="btn-row"><button class="btn primary" id="msSave">Сохранить · +20 XP</button><button class="btn" data-mclose="1">Отмена</button></div>`);
  $('#msSave').onclick = () => {
    const m = { d: todayStr(), waist: +$('#msWaist').value || null, chest: +$('#msChest').value || null,
      arms: +$('#msArms').value || null, hips: +$('#msHips').value || null, neck: +$('#msNeck').value || null };
    if (!m.waist && !m.chest && !m.arms && !m.hips && !m.neck) { toast('Заполни хотя бы одно поле', 'warn'); return; }
    fitnessState().measures.push(m);
    addXP(20, 'health', 'Замеры тела');
    markDayActive(); saveState(); closeModal(); renderAll();
    toast('📏 Замеры сохранены', 'ok');
  };
}

/* ════════ 26. ИНИЦИАЛИЗАЦИЯ ════════ */

let S = loadState() || defaultState();

/* ── Символический замок на вход ──────────────────────────────────
   Это НЕ настоящая защита данных: сайт статический и лежит на GitHub
   открытым текстом, любой при желании прочитает исходники и увидит
   этот же пароль прямо здесь. Единственная цель — не дать случайному
   человеку по ссылке сходу открыть личные данные. Хочешь сменить
   пароль — просто впиши новое значение сюда и сохрани файл. */
const APP_PASSWORD = 'ego2026';
const LOCK_KEY = 'project_ego_unlocked';

function init() {
  let unlocked;
  try { unlocked = localStorage.getItem(LOCK_KEY) === '1'; } catch (e) { unlocked = true; }
  if (unlocked) {
    $('#boot').classList.remove('hidden');
    initApp();
    return;
  }
  const gate = $('#lockGate');
  gate.classList.remove('hidden');
  const form = $('#lockForm'), input = $('#lockInput'), err = $('#lockError');
  input.focus();
  form.onsubmit = e => {
    e.preventDefault();
    if (input.value === APP_PASSWORD) {
      try { localStorage.setItem(LOCK_KEY, '1'); } catch (e) {}
      gate.classList.add('hidden');
      $('#boot').classList.remove('hidden');
      initApp();
    } else {
      err.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  };
}

function initApp() {
  document.documentElement.dataset.theme = S.settings.theme || 'red';

  // Суточный снимок: раз в день сохраняем вчерашнее состояние отдельным ключом.
  // Если основные данные испортятся — в настройках есть кнопка восстановления.
  try {
    if (localStorage.getItem('project_ego_snap_date') !== todayStr()) {
      const cur = localStorage.getItem(STORE_KEY);
      if (cur) {
        localStorage.setItem('project_ego_snap', cur);
        localStorage.setItem('project_ego_snap_date', todayStr());
      }
    }
  } catch (e) { /* нет места — не критично */ }

  // PWA: офлайн-кэш приложения. Работает только по https (GitHub Pages и т.п.);
  // при локальном запуске через file:// условие не выполнится — и это нормально.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {/* офлайн-режим необязателен */});
  }
  $('#fabQuest').onclick = () => questModal();
  $('#modalBackdrop').onclick = e => { if (e.target === $('#modalBackdrop')) closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  setTimeout(() => {
    $('#boot').classList.add('hidden');
    if (!S.onboarded) {
      renderOnboarding(1);
    } else {
      $('#app').classList.remove('hidden');
      // Новый день: если режим не выбран — мягко спросим
      const day = getDay();
      renderAll();
      if (!day.mode) dayModeModal();
      // Необязательное браузерное уведомление о платеже
      if (S.settings.browserNotify && 'Notification' in window && Notification.permission === 'granted') {
        const pay = nextPayment();
        if (pay && pay.days <= 2) {
          try { new Notification('PROJECT EGO', { body: `Платёж «${pay.debt.n}» через ${pay.days} дн. — ${fmtMoney(pay.debt.minPay)}` }); } catch (e) {}
        }
      }
    }
  }, 400);
}

init();
