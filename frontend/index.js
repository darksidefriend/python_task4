const { grpc } = require('grpc-web');
const { Empty, TermName } = require('./static/glossary_pb.js');
const { GlossaryServiceClient } = require('./static/glossary_grpc_web_pb.js');

const host = window.location.protocol + '//' + window.location.host + '/grpc.web';
const client = new GlossaryServiceClient(host);

let termsMap = {};

function loadTermsList() {
    const request = new Empty();
    client.getAllTerms(request, {}, (err, response) => {
        if (err) {
            console.error('Error loading terms:', err);
            return;
        }
        const terms = response.getTermsList();
        const listEl = document.getElementById('term-list');
        listEl.innerHTML = '';
        terms.forEach(term => {
            termsMap[term.getName()] = term;
            const li = document.createElement('li');
            li.textContent = term.getName();
            li.addEventListener('click', () => showTermDetails(term.getName()));
            listEl.appendChild(li);
        });
    });
}

function loadGraph() {
    const request = new Empty();
    client.getGraph(request, {}, (err, response) => {
        if (err) {
            console.error('Error loading graph:', err);
            return;
        }
        const nodesList = response.getNodesList();
        const edgesList = response.getEdgesList();

        const visNodes = nodesList.map(name => ({ id: name, label: name }));
        const visEdges = edgesList.map(edge => ({
            from: edge.getFromTerm(),
            to: edge.getToTerm(),
            label: edge.getRelationType()
        }));

        const container = document.getElementById('graph');
        const data = {
            nodes: new vis.DataSet(visNodes),
            edges: new vis.DataSet(visEdges)
        };
        const options = {
            layout: { improvedLayout: true },
            edges: { arrows: 'to', smooth: true }
        };
        const network = new vis.Network(container, data, options);
        network.on('click', params => {
            if (params.nodes.length > 0) {
                showTermDetails(params.nodes[0]);
            }
        });
    });
}

function showTermDetails(termName) {
    const request = new TermName();
    request.setName(termName);
    client.getTermByName(request, {}, (err, term) => {
        if (err) {
            document.getElementById('details').innerHTML = `<h2>Error</h2><p>Term not found.</p>`;
            return;
        }
        const name = term.getName();
        const def = term.getDefinition();
        const text = def.getText();
        const links = def.getLinksList();
        const relations = term.getRelationsList();

        let html = `<h2>${name}</h2>`;
        html += `<p><strong>Definition:</strong> ${text}</p>`;
        if (links.length > 0) {
            html += `<p><strong>Sources:</strong></p><ul>`;
            links.forEach(link => {
                html += `<li><a href="${link.getUrl()}" target="_blank">${link.getTitle()}</a></li>`;
            });
            html += `</ul>`;
        }
        if (relations.length > 0) {
            html += `<p><strong>Relations:</strong></p><ul>`;
            relations.forEach(rel => {
                html += `<li>${rel.getRelationType()} -> ${rel.getToTerm()}</li>`;
            });
            html += `</ul>`;
        }
        document.getElementById('details').innerHTML = html;
    });
}

window.addEventListener('load', () => {
    loadTermsList();
    loadGraph();
});