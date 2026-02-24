import os
import logging
import grpc
from flask import Flask, render_template, jsonify, abort

# сгенерированные модули (появятся после сборки)
import glossary_pb2
import glossary_pb2_grpc

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

GLOSSARY_HOST = os.getenv('GLOSSARY_HOST', 'localhost')
GLOSSARY_PORT = '50051'
channel = grpc.insecure_channel(f'{GLOSSARY_HOST}:{GLOSSARY_PORT}')
stub = glossary_pb2_grpc.GlossaryServiceStub(channel)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/terms')
def get_all_terms():
    try:
        response = stub.GetAllTerms(glossary_pb2.Empty())
        terms = [{'id': t.id, 'name': t.name} for t in response.terms]
        return jsonify(terms)
    except grpc.RpcError as e:
        app.logger.error(f"gRPC error: {e}")
        abort(500, description="Error communicating with glossary service")

@app.route('/api/term/<name>')
def get_term_by_name(name):
    try:
        req = glossary_pb2.GetTermByNameRequest(name=name)
        term = stub.GetTermByName(req)
        # сериализуем в dict для JSON
        data = {
            'id': term.id,
            'name': term.name,
            'definition': {
                'text': term.definition.text,
                'source': term.definition.source
            },
            'links': [{'url': l.url, 'title': l.title} for l in term.links]
        }
        return jsonify(data)
    except grpc.RpcError as e:
        if e.code() == grpc.StatusCode.NOT_FOUND:
            abort(404, description="Term not found")
        else:
            abort(500, description="Internal error")

@app.route('/api/graph')
def get_graph():
    try:
        graph = stub.GetGraph(glossary_pb2.Empty())
        nodes = [{'id': n.id, 'name': n.name} for n in graph.nodes]
        edges = [{'from': e.from_, 'to': e.to, 'type': e.type} for e in graph.edges]
        return jsonify({'nodes': nodes, 'edges': edges})
    except grpc.RpcError as e:
        app.logger.error(f"gRPC error: {e}")
        abort(500, description="Error fetching graph")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)