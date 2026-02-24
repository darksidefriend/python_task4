FROM python:3.9-slim AS builder

WORKDIR /build
COPY protobufs /build/protobufs
COPY glossary /build/glossary

RUN apt-get update && apt-get install -y protobuf-compiler && \
    pip install grpcio-tools==1.60.0 && \
    python -m grpc_tools.protoc -I./protobufs --python_out=./glossary --grpc_python_out=./glossary ./protobufs/glossary.proto

FROM python:3.9-slim

WORKDIR /app
COPY --from=builder /build/glossary /app
COPY --from=builder /build/protobufs /app/protobufs

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 50051
CMD ["python", "glossary.py"]