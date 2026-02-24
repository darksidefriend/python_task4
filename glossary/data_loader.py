import json
from glossary_pb2 import Term, Definition, Link, Relation

class GlossaryData:
    def __init__(self, json_path):
        self.terms_by_id = {}
        self.terms_by_name = {}
        self._load_from_json(json_path)

    def _load_from_json(self, json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for item in data['terms']:
            term = Term()
            term.id = item['id']
            term.name = item['name']
            term.definition.text = item['definition']['text']
            term.definition.source = item['definition']['source']
            for link in item.get('links', []):
                l = term.links.add()
                l.url = link['url']
                l.title = link['title']
            for rel in item.get('relations', []):
                r = term.relations.add()
                r.to_term_id = rel['to']
                r.type = rel['type']

            self.terms_by_id[term.id] = term
            self.terms_by_name[term.name] = term

    def get_all_terms(self):
        return list(self.terms_by_id.values())

    def get_term_by_name(self, name):
        return self.terms_by_name.get(name)

    def get_graph(self):
        nodes = []
        edges = []
        for tid, term in self.terms_by_id.items():
            nodes.append({'id': tid, 'name': term.name})
            for rel in term.relations:
                edges.append({
                    'from': tid,
                    'to': rel.to_term_id,
                    'type': rel.type
                })
        return nodes, edges