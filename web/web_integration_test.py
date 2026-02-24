import requests
import time
import pytest

BASE_URL = "http://localhost:5000"

def test_homepage():
    resp = requests.get(f"{BASE_URL}/")
    assert resp.status_code == 200
    assert "<title>ML Glossary with Graph</title>" in resp.text

def test_api_terms():
    resp = requests.get(f"{BASE_URL}/api/terms")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "id" in data[0]
    assert "name" in data[0]

def test_api_graph():
    resp = requests.get(f"{BASE_URL}/api/graph")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0

def test_api_term_found():
    resp = requests.get(f"{BASE_URL}/api/term/Machine%20Learning")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Machine Learning"

def test_api_term_not_found():
    resp = requests.get(f"{BASE_URL}/api/term/Nonexistent")
    assert resp.status_code == 404