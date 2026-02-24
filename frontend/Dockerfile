FROM node:16 as builder

WORKDIR /app
COPY proto /app/proto
COPY frontend/index.js /app/index.js
COPY frontend/package.json /app/package.json

RUN npm install -g grpc-tools protoc-gen-grpc-web browserify
RUN mkdir -p /app/static && \
    protoc -I proto proto/glossary.proto \
    --js_out=import_style=commonjs,binary:/app/static \
    --grpc-web_out=import_style=commonjs,mode=grpcwebtext:/app/static

RUN npm install
RUN browserify index.js -o bundle.js

FROM nginx:alpine
COPY --from=builder /app/bundle.js /usr/share/nginx/html/bundle.js
COPY frontend/index.html frontend/style.css /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf