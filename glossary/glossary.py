import logging
import grpc
from concurrent import futures
import os

import glossary_pb2
import glossary_pb2_grpc
from data_loader import GlossaryData

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'glossary.json')

class GlossaryServicer(glossary_pb2_grpc.GlossaryServiceServicer):
    def __init__(self):
        self.data = GlossaryData(DATA_FILE)

    def GetAllTerms(self, request, context):
        response = glossary_pb2.GetAllTermsResponse()
        for term in self.data.get_all_terms():
            response.terms.append(term)
        return response

    def GetTermByName(self, request, context):
        term = self.data.get_term_by_name(request.name)
        if not term:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f'Term "{request.name}" not found')
            return glossary_pb2.Term()
        return term

    def GetGraph(self, request, context):
        nodes, edges = self.data.get_graph()
        graph = glossary_pb2.Graph()
        for node in nodes:
            n = graph.nodes.add()
            n.id = node['id']
            n.name = node['name']
        for edge in edges:
            e = graph.edges.add()
            e.from_ = edge['from']
            e.to = edge['to']
            e.type = edge['type']
        return graph

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    glossary_pb2_grpc.add_GlossaryServiceServicer_to_server(GlossaryServicer(), server)
    server.add_insecure_port('[::]:50051')
    logger.info("gRPC server starting on port 50051")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()