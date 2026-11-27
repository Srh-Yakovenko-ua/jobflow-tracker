const FILLED_STAYS = 'Усе введене лишилось у формі.';

const LIMIT_WAIT = {
  wait: (wait: string) => `Спробуй через ${wait}.`,
  later: 'Спробуй трохи пізніше.',
} as const;

const LIMIT_RETRY = {
  wait: (wait: string) => `${LIMIT_WAIT.wait(wait)} ${FILLED_STAYS}`,
  later: `${LIMIT_WAIT.later} ${FILLED_STAYS}`,
} as const;

const PARSE_LIMIT_TITLE = 'Забагато розборів за годину';

export const add = {
  title: 'Додавання вакансії',
  eyebrow: 'Нова вакансія',
  headline: ['Три способи', 'додати вакансію'],
  lead: 'Букмарклет на щодень, вставка тексту з месенджера, ручний ввід, коли вакансії ніде немає.',
  bookmarklet: {
    eyebrow: '01 · букмарклет',
    badge: 'швидко',
    title: 'Один клік зі сторінки вакансії',
    description: 'Працює на Djinni, DOU, robota.ua, LinkedIn і сайтах компаній. Розбір іде у фоні.',
    footnote: 'не читає нічого, крім відкритої вкладки',
  },
  importLink: 'Є таблиця? Імпортуй CSV',
  paste: {
    eyebrow: '02 · вставка тексту',
    title: 'Вставити опис вакансії',
    description: 'Текст із телеграму чи листа. AI знайде компанію, посаду, вилку і стек.',
    fields: { text: 'Текст вакансії', url: 'Посилання на вакансію' },
    placeholders: {
      text: 'Встав сюди весь текст вакансії разом із зайвим, розберемось…',
      url: 'https://…',
    },
    urlHint: "необов'язково",
    errors: {
      text: (limit: string) => `Встав текст вакансії, не довший за ${limit} символів`,
      url: 'Посилання має починатися з http:// або https://',
    },
    submit: 'Розібрати текст',
    shortcut: { mac: '⌘ Enter', other: 'Ctrl Enter', or: 'або' },
    added: 'Картку додано. Перевір поля нижче.',
  },
  manual: {
    eyebrow: '03 · вручну',
    title: 'Заповнити вручну',
    description: "Обов'язкові лише компанія і посада. Без тексту вакансії Match Score не буде.",
    fields: { company: 'Компанія', position: 'Посада', source: 'Джерело' },
    placeholders: { company: 'Назва компанії', position: 'Наприклад, Middle QA Engineer' },
    errors: {
      company: 'Вкажи назву компанії одним коротким рядком',
      position: 'Вкажи посаду одним коротким рядком',
      source: 'Обери джерело зі списку',
    },
    submit: 'Створити картку',
    added: 'Картку створено без Match Score: для нього потрібен текст вакансії.',
  },
  added: {
    toast: 'Картка вже на дошці',
    title: 'Картку додано',
    another: 'Додати ще одну',
    toBoard: 'До дошки',
  },
  duplicates: {
    title: 'Схожа вакансія вже є на дошці',
    hint: 'Нову картку все одно створено. Якщо це дубль, видали зайву.',
    applied: (date: string) => `відгук ${date}`,
  },
  errors: {
    noActiveSearch: {
      title: 'Немає активного пошуку',
      description: `Картки живуть у пошуку, а зараз жоден не активний. ${FILLED_STAYS}`,
    },
    stillRunning: {
      title: 'Запит ще обробляється',
      description: `Спробуй ще раз за хвилину. ${FILLED_STAYS}`,
    },
    parseLimit: { title: PARSE_LIMIT_TITLE, ...LIMIT_RETRY },
    requestLimit: { title: 'Забагато запитів', ...LIMIT_RETRY },
    retryLimit: { title: PARSE_LIMIT_TITLE, ...LIMIT_WAIT },
  },
  explainer: {
    eyebrow: 'Що відбувається після кліку',
    title: 'Обробка йде у фоні',
    panel: {
      title: 'Картка вже на дошці',
      body: (stage: string) =>
        `Картка вже на етапі «${stage}», AI дочитує опис. Сторінку можна закрити.`,
    },
  },
  review: {
    title: 'Перевір поля і готово',
    eyebrow: (step: number, total: number) => `Крок ${String(step)}/${String(total)} · розпізнано`,
    confidence: { exact: 'точно', check: 'перевір' },
    chip: (label: string, mark: string) => `${label}: ${mark}`,
    salary: (currency: string | null) => (currency === null ? 'Вилка' : `Вилка, ${currency}`),
    stack: (count: number) => `Стек · розпізнано ${String(count)} із тексту`,
    addStack: '+ додати',
    lead: 'У підсвічених жовтим полях AI не впевнений.',
    note: (label: string, quote: string | null) =>
      quote === null
        ? `${label}: цитати в тексті вакансії не знайшлося.`
        : `${label}: у тексті написано «${quote}».`,
    evidenceMissing: 'Цитати в тексті вакансії не знайшлося',
    confirm: 'Зберегти',
    open: 'Відкрити повну картку',
    back: 'Назад',
  },
  ready: {
    title: 'Картка готова',
    toCard: 'Відкрити картку',
  },
  failed: {
    title: 'Картка створена, але порожня',
    reasons: {
      noFields: 'У тексті немає компанії й посади, схоже, скопіювалися лише вимоги.',
      timeout: 'AI не встиг відповісти. Це збій на нашому боці, з текстом усе гаразд.',
      budget: 'Ліміт AI-розборів вичерпано. Повторити розбір вийде, коли ліміт оновиться.',
      providerDown: 'Сервіс AI зараз недоступний. Це збій на нашому боці, з текстом усе гаразд.',
      generic: 'AI не зміг розібрати цей текст.',
    },
    kept: 'Текст цілим лежить у нотатці картки.',
    next: 'Заповни компанію й посаду, тоді порахується Match Score.',
    manualTitle: 'Заповни компанію і посаду',
  },
} as const;
