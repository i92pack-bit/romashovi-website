# Ромашовы-диджитал — сайт

Статический одностраничный сайт. Никаких бэкендов, билдов, зависимостей.

## Структура

```
site/
├── index.html          # сам сайт (всё внутри: HTML + CSS + JS)
├── yulia.jpg           # фото Юли в hero
├── ilia.jpg            # фото Ильи в hero
├── avatar.png          # совместное фото для шапки (также встроено в HTML как data-URI)
├── robots.txt          # для поисковиков — открыто всё
└── screenshots/        # сюда складывать скрины кабинетов
    ├── vk-1.jpg        # 4 скрина для VK Реклама (vk-1..vk-4)
    ├── ya-1.jpg        # 4 скрина для Яндекс Директ (ya-1..ya-4)
    ├── tg-1.jpg        # 2 скрина для Telegram Ads (tg-1..tg-2)
    └── g-1.jpg         # 2 скрина для Google Ads (g-1..g-2)
```

Если файла скриншота нет — на его месте автоматически показывается placeholder с пунктирной рамкой и подписью «скриншот сюда» + имя файла.

## Деплой

### Netlify Drop (быстрее всего)
1. Открыть https://app.netlify.com/drop
2. Перетащить папку `site/` в окно
3. Получить URL `name.netlify.app`
4. В Domain settings подключить свой домен

### Cloudflare Pages
1. Создать аккаунт https://pages.cloudflare.com
2. Connect to Git → выбрать репо
3. Build command: оставить пустым (статика)
4. Build output: `site` (если деплоим из корня репо) или `/` (если деплоим только содержимое site)

### GitHub Pages
1. Залить файлы в репо
2. Settings → Pages → Source: main branch / `/site` folder
3. Сайт будет на `username.github.io/repo`

## Контент

- Текст — прямо в `index.html`, секциях. Найти через поиск по фразе и поправить
- Фото в hero — `yulia.jpg` и `ilia.jpg` (квадратные 1:1, минимум 600×600)
- Аватар в шапке — `avatar.png` (440×440, в HTML встроен как base64; для замены: положить новый avatar.png и заменить data-URI в CSS на `url('avatar.png')`)
- Скрины — просто положить файлы в `screenshots/` с правильными именами

## Контакты

Telegram CTA указывает на `https://t.me/romashovi` — поправить при необходимости в самом конце `index.html`.
