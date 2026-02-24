FROM node:18-slim AS builder

WORKDIR /app

# Копируем package.json и устанавливаем только browserify
COPY frontend/package*.json ./
RUN npm install

# Копируем сгенерированные proto-файлы
COPY frontend/static ./static

# Копируем исходный код фронтенда
COPY frontend/index.js ./
COPY frontend/index.html frontend/style.css ./

# Собираем bundle.js
RUN npm run build

# Финальный образ с nginx
FROM nginx:alpine
COPY --from=builder /app/bundle.js /usr/share/nginx/html/bundle.js
COPY --from=builder /app/index.html /app/style.css /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf