import json
import logging
import grpc
from concurrent import futures
import threading
import glossary_pb2
import glossary_pb2_grpc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GlossaryServicer(glossary_pb2_grpc.GlossaryServiceServicer):
    def __init__(self, data_file):
        self.terms = {}
        self.lock = threading.Lock()
        self.load_data(data_file)

    def load_data(self, data_file):
        with open(data_file, 'r') as f:
            data = json.load(f)
        for term_data in data['terms']:
            term = self._dict_to_term(term_data)
            self.terms[term.name] = term
        logger.info(f"Loaded {len(self.terms)} terms")

    def _dict_to_term(self, term_data):
        def_data = term_data['definition']
        links = [glossary_pb2.Link(url=link['url'], title=link['title']) for link in def_data.get('links', [])]
        definition = glossary_pb2.Definition(text=def_data['text'], links=links)
        relations = []
        for rel in term_data.get('relations', []):
            relations.append(glossary_pb2.Relation(
                from_term=term_data['name'],
                to_term=rel['to'],
                relation_type=rel['type']
            ))
        return glossary_pb2.Term(
            name=term_data['name'],
            definition=definition,
            relations=relations
        )

    def GetAllTerms(self, request, context):
        with self.lock:
            return glossary_pb2.TermsList(terms=list(self.terms.values()))

    def GetTermByName(self, request, context):
        name = request.name
        with self.lock:
            if name not in self.terms:
                context.set_code(grpc.StatusCode.NOT_FOUND)
                context.set_details(f"Term '{name}' not found")
                return glossary_pb2.Term()
            return self.terms[name]

    def GetGraph(self, request, context):
        with self.lock:
            nodes = list(self.terms.keys())
            edges = []
            for term in self.terms.values():
                edges.extend(term.relations)
            return glossary_pb2.Graph(nodes=nodes, edges=edges)

    def AddTerm(self, request, context):
        with self.lock:
            if request.name in self.terms:
                return glossary_pb2.OperationStatus(
                    success=False,
                    message=f"Term '{request.name}' already exists"
                )
            self.terms[request.name] = request
            logger.info(f"Added term: {request.name}")
            return glossary_pb2.OperationStatus(
                success=True,
                message=f"Term '{request.name}' added successfully"
            )

    def UpdateTerm(self, request, context):
        with self.lock:
            old_name = request.name
            if old_name not in self.terms:
                return glossary_pb2.OperationStatus(
                    success=False,
                    message=f"Term '{old_name}' not found"
                )
            self.terms[old_name] = request
            logger.info(f"Updated term: {old_name}")
            return glossary_pb2.OperationStatus(
                success=True,
                message=f"Term '{old_name}' updated successfully"
            )

    def DeleteTerm(self, request, context):
        name = request.name
        with self.lock:
            if name not in self.terms:
                return glossary_pb2.OperationStatus(
                    success=False,
                    message=f"Term '{name}' not found"
                )
            # Удаляем сам термин
            del self.terms[name]
            # Удаляем все рёбра, связанные с удалённым термином
            for term in self.terms.values():
                # Оставляем только те связи, которые не ссылаются на удалённый термин
                new_relations = [
                    rel for rel in term.relations
                    if rel.to_term != name and rel.from_term != name
                ]
                # Очищаем старые связи через pop() (надёжно для UPB)
                while term.relations:
                    term.relations.pop()
                # Добавляем новые связи
                term.relations.extend(new_relations)
            logger.info(f"Deleted term: {name}")
            return glossary_pb2.OperationStatus(
                success=True,
                message=f"Term '{name}' deleted successfully"
            )

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    glossary_pb2_grpc.add_GlossaryServiceServicer_to_server(
        GlossaryServicer('data.json'), server)
    server.add_insecure_port('[::]:50051')
    server.start()
    logger.info("Server started on port 50051")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()