FROM python:3.9-slim AS builder

WORKDIR /build
COPY protobufs /build/protobufs
COPY web /build/web

RUN apt-get update && apt-get install -y protobuf-compiler && \
    pip install grpcio-tools==1.60.0 && \
    python -m grpc_tools.protoc -I./protobufs --python_out=./web --grpc_python_out=./web ./protobufs/glossary.proto

FROM python:3.9-slim

WORKDIR /app
COPY --from=builder /build/web /app
COPY --from=builder /build/protobufs /app/protobufs

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000
ENV FLASK_APP=app.py
CMD ["flask", "run", "--host=0.0.0.0"]