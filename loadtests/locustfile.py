import random
import time
from locust import task, between
from locust_plugins.users import GrpcUser
import grpc

# Импортируем локальные protobuf-модули
from glossary_pb2 import Empty, TermName, Term, Definition, Link, Relation, OperationStatus
from glossary_pb2_grpc import GlossaryServiceStub

class GlossaryUser(GrpcUser):
    host = "localhost:50051"                     # адрес gRPC-сервера
    stub_class = GlossaryServiceStub              # сгенерированный stub
    wait_time = between(1, 5)                     # пауза между задачами

    def on_start(self):
        """Получаем начальный список терминов."""
        try:
            response = self.stub.GetAllTerms(Empty())
            self.all_terms = [term.name for term in response.terms]
        except grpc.RpcError as e:
            self.environment.runner.quit()
            raise Exception(f"Не удалось получить начальные термины: {e}")
        self.my_terms = []

    def get_random_term(self):
        combined = self.all_terms + self.my_terms
        if not combined:
            return None
        return random.choice(combined)

    # Чтение (80%)
    @task(30)
    def get_all_terms(self):
        self.stub.GetAllTerms(Empty())

    @task(30)
    def get_term_by_name(self):
        name = self.get_random_term()
        if name:
            self.stub.GetTermByName(TermName(name=name))

    @task(20)
    def get_graph(self):
        self.stub.GetGraph(Empty())

    # Запись (20%)
    @task(5)
    def add_term(self):
        term_name = f"loadtest-{self.environment.runner.user_count}-{int(time.time())}-{random.randint(1000,9999)}"
        term = Term(
            name=term_name,
            definition=Definition(text="Load test term", links=[]),
            relations=[]
        )
        resp = self.stub.AddTerm(term)
        if resp.success:
            self.my_terms.append(term_name)
            self.all_terms.append(term_name)

    @task(4)
    def update_term(self):
        if not self.my_terms:
            return
        name = random.choice(self.my_terms)
        term = Term(
            name=name,
            definition=Definition(text="Updated during load test", links=[]),
            relations=[]
        )
        self.stub.UpdateTerm(term)

    @task(1)
    def delete_term(self):
        if not self.my_terms:
            return
        name = random.choice(self.my_terms)
        resp = self.stub.DeleteTerm(TermName(name=name))
        if resp.success:
            self.my_terms.remove(name)
            self.all_terms.remove(name)