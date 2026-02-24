from glossary import GlossaryServicer
from glossary_pb2 import GetTermByNameRequest, Empty
import pytest

def test_get_term_by_name_found():
    servicer = GlossaryServicer()
    request = GetTermByNameRequest(name="Machine Learning")
    response = servicer.GetTermByName(request, None)
    assert response.name == "Machine Learning"
    assert response.definition.text != ""

def test_get_term_by_name_not_found():
    servicer = GlossaryServicer()
    request = GetTermByNameRequest(name="Nonexistent")
    context = type('', (), {})()  # простой mock
    context.code = None
    context.details = None
    def set_code(code): context.code = code
    def set_details(details): context.details = details
    context.set_code = set_code
    context.set_details = set_details

    response = servicer.GetTermByName(request, context)
    assert context.code == grpc.StatusCode.NOT_FOUND

def test_get_graph():
    servicer = GlossaryServicer()
    response = servicer.GetGraph(Empty(), None)
    assert len(response.nodes) > 0
    assert len(response.edges) > 0