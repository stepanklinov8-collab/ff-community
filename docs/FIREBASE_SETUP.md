# Настройка Firebase для OMCITE ARENA

Firebase используется только для фоновых push-уведомлений. Регистрация и вход пользователей остаются в Supabase.

## 1. Создать проект и Web app

1. Откройте [Firebase Console](https://console.firebase.google.com/).
2. Создайте проект `OMCITE ARENA`. Google Analytics можно пока не подключать.
3. В обзоре проекта нажмите значок Web (`</>`), задайте имя приложения `OMCITE ARENA Web` и зарегистрируйте приложение.
4. Скопируйте значения из показанного объекта `firebaseConfig` в `.env.local`:

| Поле Firebase | Переменная сайта |
| --- | --- |
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

Поля с префиксом `NEXT_PUBLIC_` входят в публичную конфигурацию Web app. Защита доступа обеспечивается правилами сервисов и серверными учётными данными, а не скрытием этих значений.

## 2. Включить Web Push

1. Откройте `Project settings → Cloud Messaging`.
2. В разделе `Web Push certificates` нажмите `Generate key pair`.
3. Скопируйте публичный ключ в `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Если консоль предложит включить `FCM Registration API`, включите её для этого проекта.

## 3. Создать серверную учётную запись

1. Откройте `Project settings → Service accounts`.
2. Нажмите `Generate new private key` и скачайте JSON-файл.
3. Из JSON перенесите в `.env.local`:

| Поле JSON | Переменная сайта |
| --- | --- |
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |

`FIREBASE_PRIVATE_KEY` должна быть одной строкой в кавычках, а переносы строк должны быть записаны как `\n`, например:

```dotenv
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Не отправляйте JSON и приватный ключ в чат, не добавляйте их в Git. После переноса удалите скачанный JSON с компьютера или храните его в защищённом хранилище.

## 4. Остальные переменные

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=длинная_случайная_строка_не_короче_32_символов
```

Для production замените `NEXT_PUBLIC_SITE_URL` на адрес Vercel вида `https://имя-проекта.vercel.app`. Один и тот же `CRON_SECRET` внесите в Vercel и в секрет GitHub Actions `CRON_SECRET`.

## 5. Настроить Vercel и GitHub Actions

В Vercel откройте `Project → Settings → Environment Variables` и добавьте все переменные из `.env.local` для Production, Preview и Development. Приватные значения `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` и `CRON_SECRET` не должны иметь префикс `NEXT_PUBLIC_`.

В GitHub откройте `Repository → Settings → Secrets and variables → Actions` и создайте:

- `SITE_URL` — production-адрес Vercel без завершающего `/`;
- `CRON_SECRET` — то же секретное значение, что в Vercel.

Workflow вызывает endpoint уведомлений каждые пять минут и может быть запущен вручную из вкладки Actions.

## 6. Проверка

1. Запустите сайт и войдите в аккаунт.
2. На странице профиля нажмите `Включить` в блоке push-уведомлений и разрешите уведомления в браузере.
3. В GitHub Actions вручную запустите `Event notifications`.
4. Проверьте, что workflow завершился успешно, а в Supabase появилась запись в `push_delivery_logs`.

Push работает только на HTTPS в production; `localhost` разрешён браузерами для разработки.
