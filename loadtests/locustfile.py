import random
import time
import grpc
from locust import User, task, between, events
from locust.exception import StopUser

# Импортируйте сгенерированные protobuf-модули (они должны лежать рядом)
from glossary_pb2 import Empty, TermName, Term, Definition, Link, Relation
from glossary_pb2_grpc import GlossaryServiceStub

class GrpcClient:
    """
    Обёртка для gRPC-стаба, которая замеряет время выполнения и отправляет события Locust.
    """
    def __init__(self, environment, stub):
        self.environment = environment
        self._stub = stub

    def __getattr__(self, name):
        """
        Перехватываем вызовы методов стаба и оборачиваем их в события.
        """
        method = getattr(self._stub, name)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = method(*args, **kwargs)
                total_time = (time.time() - start_time) * 1000  # мс
                self.environment.events.request.fire(
                    request_type="grpc",
                    name=name,
                    response_time=total_time,
                    response_length=0,
                    exception=None,
                )
                return result
            except Exception as e:
                total_time = (time.time() - start_time) * 1000
                self.environment.events.request.fire(
                    request_type="grpc",
                    name=name,
                    response_time=total_time,
                    response_length=0,
                    exception=e,
                )
                # Пробрасываем исключение дальше (Locust учтёт его как ошибку)
                raise
        return wrapper

class GlossaryUser(User):
    """
    Пользователь, имитирующий работу с глоссарием через gRPC.
    """
    host = "localhost:50051"            # адрес вашего gRPC-сервера
    wait_time = between(1, 5)            # пауза между задачами

    def on_start(self):
        """Инициализация: создаём канал, стаб и загружаем начальные термины."""
        channel = grpc.insecure_channel(self.host)
        stub = GlossaryServiceStub(channel)
        self.grpc_client = GrpcClient(self.environment, stub)

        # Получаем список всех терминов (кешируем для последующих операций)
        try:
            response = self.grpc_client.GetAllTerms(Empty())
            self.all_terms = [term.name for term in response.terms]
        except Exception as e:
            print(f"Failed to get initial terms: {e}")
            raise StopUser()   # останавливаем пользователя, если не можем начать

        # Список терминов, созданных этим пользователем (для операций записи)
        self.my_terms = []

    def get_random_term(self):
        """Возвращает случайное имя термина из общего пула или созданных."""
        combined = self.all_terms + self.my_terms
        if not combined:
            return None
        return random.choice(combined)

    # --- Задачи чтения (80% веса) ---
    @task(30)
    def get_all_terms(self):
        self.grpc_client.GetAllTerms(Empty())

    @task(30)
    def get_term_by_name(self):
        name = self.get_random_term()
        if name:
            self.grpc_client.GetTermByName(TermName(name=name))

    @task(20)
    def get_graph(self):
        self.grpc_client.GetGraph(Empty())

    # --- Задачи записи (20% веса) ---
    @task(5)
    def add_term(self):
        """Добавляет новый термин с уникальным именем."""
        term_name = f"loadtest-{self.environment.runner.user_count}-{int(time.time())}-{random.randint(1000,9999)}"
        term = Term(
            name=term_name,
            definition=Definition(text="Load test term", links=[]),
            relations=[]
        )
        resp = self.grpc_client.AddTerm(term)
        if resp.success:
            self.my_terms.append(term_name)
            self.all_terms.append(term_name)

    @task(4)
    def update_term(self):
        """Обновляет один из созданных этим пользователем терминов."""
        if not self.my_terms:
            return
        name = random.choice(self.my_terms)
        term = Term(
            name=name,
            definition=Definition(text="Updated during load test", links=[]),
            relations=[]
        )
        self.grpc_client.UpdateTerm(term)

    @task(1)
    def delete_term(self):
        """Удаляет один из созданных терминов (редкая операция)."""
        if not self.my_terms:
            return
        name = random.choice(self.my_terms)
        resp = self.grpc_client.DeleteTerm(TermName(name=name))
        if resp.success:
            self.my_terms.remove(name)
            if name in self.all_terms:
                self.all_terms.remove(name)