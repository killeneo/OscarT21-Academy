# Инструкция: папка → GitHub → Vercel (CI/CD)

Предполагается: фронтенд на Next.js, деплой на Vercel, бэкенд отдельно (не на Vercel). Если стек другой, шаги 1–3 и 8 те же, меняются команды в CI.
Персональные данные (особенно о детях) на Vercel не храните до юридической проверки (152-ФЗ и законы страны запуска).

## Шаг 1. Установить инструменты (один раз)

```bash
winget install GitHub.cli
npm i -g vercel
```
Перезапустите терминал, затем проверьте: `gh --version` и `vercel --version`.

## Шаг 2. Первый коммит

Перед коммитом создайте `.gitignore` (минимум): `node_modules/`, `.next/`, `.env*` (кроме `.env.example`), `.vercel/`, `*.log`.

```bash
git branch -M main
git add .
git status
git commit -m "Initial commit: docs"
```
Проверьте по `git status`, что в коммит не попали секреты и `.env`.

## Шаг 3. Создать репозиторий на GitHub

1. Войдите: `gh auth login` (GitHub.com → HTTPS → браузер). Включите 2FA в аккаунте.
2. Создайте приватный репозиторий и отправьте код:
```bash
gh repo create OscarT21-Academy --private --source=. --remote=origin --push
```
Если репозиторий уже создан на сайте: `git remote add origin https://github.com/<логин>/OscarT21-Academy.git`, затем `git push -u origin main`.

## Шаг 4. Создать приложение Next.js

В корне репозитория (после решения по стеку, см. CLAUDE.md):
```bash
npx create-next-app@latest web --typescript --eslint
```
В `web/package.json` должны быть скрипты `lint`, `typecheck` (`tsc --noEmit`), `test`, `build`. Закоммитьте `package-lock.json`.

## Шаг 5. Добавить файлы CI (создаются в репозитории)

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  checks:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test --if-present
      - run: npm run build
      - run: npm audit --audit-level=high
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /web
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```
Также добавьте `.github/CODEOWNERS` (`* @<ваш-логин>`) и `.github/pull_request_template.md` с чек-листом: тесты, доступность, приватность данных, миграции.
Включите CodeQL: GitHub → Settings → Code security → Code scanning → Set up → Default.

## Шаг 6. Защитить ветку main

GitHub → Settings → Branches → Add branch ruleset (для `main`):
- Require a pull request before merging (1 approval, если работаете не один);
- Require status checks: `checks`, `secrets-scan`;
- Require branches to be up to date; Block force pushes; Restrict deletions.

Также Settings → Code security: включите Dependabot alerts, Secret scanning и Push protection.

## Шаг 7. Подключить Vercel

1. Зарегистрируйтесь на vercel.com через GitHub.
2. Add New → Project → выберите репозиторий → **Root Directory: `web`** → Framework: Next.js.
3. Production Branch: `main`. Preview-деплои на каждый PR включены по умолчанию.
4. Settings → Environment Variables: добавляйте секреты здесь (раздельно для Production/Preview), не в код.
5. Settings → Git: включите «Require verified commits» по желанию.
6. Чтобы деплой шёл только после зелёного CI, в GitHub rulesets достаточно обязательных проверок; прямой пуш в `main` запрещён.

В `web/next.config.js` добавьте заголовки безопасности (HSTS, X-Content-Type-Options, Referrer-Policy, CSP) и проверьте их на preview.

## Шаг 8. Проверка, что всё работает

1. Создайте ветку: `git switch -c test/ci`, внесите мелкую правку, `git push -u origin test/ci`.
2. Откройте PR: `gh pr create --fill`.
3. Убедитесь: Actions зелёные, Vercel оставил preview-ссылку, merge без проверок невозможен.
4. Слейте PR и проверьте production-деплой.

## Эксплуатация

- Миграции БД выполняйте вручную и отдельным шагом, не из CI на production.
- Секреты, найденные в истории Git, считайте скомпрометированными: смените их, а не только удалите.
- Раз в неделю смотрите PR от Dependabot.
