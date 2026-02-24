FROM python:3.9-slim as builder

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --user -r requirements.txt grpcio-tools

COPY proto /app/proto
RUN python -m grpc_tools.protoc -I proto --python_out=. --grpc_python_out=. proto/glossary.proto

FROM python:3.9-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY --from=builder /app/glossary_pb2.py /app/glossary_pb2_grpc.py ./
COPY backend/server.py .
COPY backend/data.json .

ENV PATH=/root/.local/bin:$PATH

EXPOSE 50051

CMD ["python", "server.py"]