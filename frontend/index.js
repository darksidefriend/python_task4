const { grpc } = require('grpc-web');
const { Empty, TermName, Term, Definition, Link, Relation } = require('./static/glossary_pb.js');
const { GlossaryServiceClient } = require('./static/glossary_grpc_web_pb.js');

const host = window.location.protocol + '//' + window.location.host + '/grpc.web';
const client = new GlossaryServiceClient(host);

let termsMap = {};        // кэш терминов
let currentTerm = null;   // текущий выбранный термин
let network = null;       // объект vis-сети

// ---- Загрузка данных ----
function loadTermsList() {
    const request = new Empty();
    client.getAllTerms(request, {}, (err, response) => {
        if (err) {
            console.error('Error loading terms:', err);
            return;
        }
        const terms = response.getTermsList();
        termsMap = {};
        const listEl = document.getElementById('term-list');
        listEl.innerHTML = '';
        terms.forEach(term => {
            termsMap[term.getName()] = term;
            const li = document.createElement('li');
            li.textContent = term.getName();
            li.addEventListener('click', () => showTermDetails(term.getName()));
            listEl.appendChild(li);
        });
        // Обновляем граф после загрузки списка
        loadGraph();
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
        // Если сеть уже существует, уничтожаем перед созданием новой
        if (network) {
            network.destroy();
        }
        network = new vis.Network(container, data, options);
        network.on('click', params => {
            if (params.nodes.length > 0) {
                showTermDetails(params.nodes[0]);
            }
        });
    });
}

// ---- Отображение деталей и кнопок ----
function showTermDetails(termName) {
    const request = new TermName();
    request.setName(termName);
    client.getTermByName(request, {}, (err, term) => {
        if (err) {
            document.getElementById('details').innerHTML = `<h2>Error</h2><p>Term not found.</p>`;
            return;
        }
        currentTerm = term;
        renderTermDetails(term);
    });
}

function renderTermDetails(term) {
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
            html += `<li>${rel.getRelationType()} → ${rel.getToTerm()}</li>`;
        });
        html += `</ul>`;
    }
    // Кнопки редактирования и удаления
    html += `<div class="form-actions">`;
    html += `<button id="edit-term-btn">✏️ Edit</button>`;
    html += `<button id="delete-term-btn" class="danger">🗑️ Delete</button>`;
    html += `</div>`;

    const detailsDiv = document.getElementById('details');
    detailsDiv.innerHTML = html;

    // Добавляем обработчики кнопок
    document.getElementById('edit-term-btn').addEventListener('click', () => showEditForm(term));
    document.getElementById('delete-term-btn').addEventListener('click', () => deleteTerm(term.getName()));
}

// ---- Форма добавления/редактирования ----
function showAddForm() {
    currentTerm = null; // сбрасываем
    const emptyTerm = {
        getName: () => '',
        getDefinition: () => ({ getText: () => '', getLinksList: () => [] }),
        getRelationsList: () => []
    };
    renderEditForm(emptyTerm, true);
}

function showEditForm(term) {
    renderEditForm(term, false);
}

function renderEditForm(term, isNew) {
    const name = isNew ? '' : term.getName();
    const defText = isNew ? '' : term.getDefinition().getText();
    const links = isNew ? [] : term.getDefinition().getLinksList();
    const relations = isNew ? [] : term.getRelationsList();

    let html = `<div class="edit-form">`;
    html += `<h3>${isNew ? 'Add New Term' : 'Edit Term: ' + name}</h3>`;
    html += `<form id="term-form">`;

    if (isNew) {
        html += `<label for="term-name">Term Name</label>`;
        html += `<input type="text" id="term-name" name="name" value="${name}" required>`;
    } else {
        // при редактировании имя не изменяем (скрытое поле)
        html += `<input type="hidden" id="term-name" name="name" value="${name}">`;
    }

    html += `<label for="definition-text">Definition</label>`;
    html += `<textarea id="definition-text" name="text" rows="3" required>${defText}</textarea>`;

    // Ссылки
    html += `<label>Sources (URLs)</label>`;
    html += `<div id="links-container">`;
    links.forEach((link, index) => {
        html += `<div class="relation-row" data-index="${index}">`;
        html += `<input type="url" class="link-url" placeholder="URL" value="${link.getUrl()}" required>`;
        html += `<input type="text" class="link-title" placeholder="Title" value="${link.getTitle()}" required>`;
        html += `<button type="button" class="remove-link">❌</button>`;
        html += `</div>`;
    });
    html += `</div>`;
    html += `<button type="button" id="add-link" class="add-relation">➕ Add Source</button>`;

    // Связи
    html += `<label>Relations</label>`;
    html += `<div id="relations-container">`;
    relations.forEach((rel, index) => {
        html += `<div class="relation-row" data-index="${index}">`;
        html += `<input type="text" class="relation-to" placeholder="Target term" value="${rel.getToTerm()}" required>`;
        html += `<input type="text" class="relation-type" placeholder="Relation type" value="${rel.getRelationType()}" required>`;
        html += `<button type="button" class="remove-relation">❌</button>`;
        html += `</div>`;
    });
    html += `</div>`;
    html += `<button type="button" id="add-relation" class="add-relation">➕ Add Relation</button>`;

    html += `<div class="form-actions">`;
    html += `<button type="submit">💾 Save</button>`;
    html += `<button type="button" id="cancel-form">Cancel</button>`;
    html += `</div>`;
    html += `</form>`;
    html += `</div>`;

    document.getElementById('details').innerHTML = html;

    // Добавляем обработчики для динамического добавления/удаления полей
    document.getElementById('add-link').addEventListener('click', addLinkRow);
    document.getElementById('add-relation').addEventListener('click', addRelationRow);
    document.getElementById('cancel-form').addEventListener('click', () => {
        if (currentTerm) {
            renderTermDetails(currentTerm);
        } else {
            document.getElementById('details').innerHTML = '<h2>Term Details</h2><p>Click on a term to see details.</p>';
        }
    });
    document.getElementById('term-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveTerm(isNew);
    });

    // Обработчики удаления для существующих строк
    document.querySelectorAll('.remove-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.relation-row').remove();
        });
    });
    document.querySelectorAll('.remove-relation').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.relation-row').remove();
        });
    });
}

function addLinkRow() {
    const container = document.getElementById('links-container');
    const row = document.createElement('div');
    row.className = 'relation-row';
    row.innerHTML = `
        <input type="url" class="link-url" placeholder="URL" required>
        <input type="text" class="link-title" placeholder="Title" required>
        <button type="button" class="remove-link">❌</button>
    `;
    container.appendChild(row);
    row.querySelector('.remove-link').addEventListener('click', (e) => {
        e.target.closest('.relation-row').remove();
    });
}

function addRelationRow() {
    const container = document.getElementById('relations-container');
    const row = document.createElement('div');
    row.className = 'relation-row';
    row.innerHTML = `
        <input type="text" class="relation-to" placeholder="Target term" required>
        <input type="text" class="relation-type" placeholder="Relation type" required>
        <button type="button" class="remove-relation">❌</button>
    `;
    container.appendChild(row);
    row.querySelector('.remove-relation').addEventListener('click', (e) => {
        e.target.closest('.relation-row').remove();
    });
}

// ---- Сохранение термина (Add или Update) ----
function saveTerm(isNew) {
    const form = document.getElementById('term-form');
    const nameInput = document.getElementById('term-name');
    const name = nameInput.value.trim();
    const defText = document.getElementById('definition-text').value.trim();

    if (!name || !defText) {
        alert('Name and definition are required.');
        return;
    }

    // Собираем ссылки
    const linkRows = document.querySelectorAll('#links-container .relation-row');
    const links = [];
    linkRows.forEach(row => {
        const url = row.querySelector('.link-url').value.trim();
        const title = row.querySelector('.link-title').value.trim();
        if (url && title) {
            const link = new Link();
            link.setUrl(url);
            link.setTitle(title);
            links.push(link);
        }
    });

    // Собираем связи
    const relationRows = document.querySelectorAll('#relations-container .relation-row');
    const relations = [];
    relationRows.forEach(row => {
        const to = row.querySelector('.relation-to').value.trim();
        const type = row.querySelector('.relation-type').value.trim();
        if (to && type) {
            const rel = new Relation();
            rel.setFromTerm(name);  // from всегда текущий термин
            rel.setToTerm(to);
            rel.setRelationType(type);
            relations.push(rel);
        }
    });

    // Создаём объект Term
    const term = new Term();
    term.setName(name);

    const def = new Definition();
    def.setText(defText);
    def.setLinksList(links);
    term.setDefinition(def);

    term.setRelationsList(relations);

    if (isNew) {
        // Добавление
        client.addTerm(term, {}, (err, response) => {
            if (err) {
                alert('Error adding term: ' + err.message);
                return;
            }
            if (response.getSuccess()) {
                alert(response.getMessage());
                loadTermsList();  // обновляем список и граф
                // Показываем детали нового термина
                showTermDetails(name);
            } else {
                alert('Failed: ' + response.getMessage());
            }
        });
    } else {
        // Обновление
        client.updateTerm(term, {}, (err, response) => {
            if (err) {
                alert('Error updating term: ' + err.message);
                return;
            }
            if (response.getSuccess()) {
                alert(response.getMessage());
                loadTermsList();
                showTermDetails(name);
            } else {
                alert('Failed: ' + response.getMessage());
            }
        });
    }
}

// ---- Удаление термина ----
function deleteTerm(name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const request = new TermName();
    request.setName(name);
    client.deleteTerm(request, {}, (err, response) => {
        if (err) {
            alert('Error deleting term: ' + err.message);
            return;
        }
        if (response.getSuccess()) {
            alert(response.getMessage());
            loadTermsList();
            // Очищаем панель деталей
            document.getElementById('details').innerHTML = '<h2>Term Details</h2><p>Click on a term to see details.</p>';
        } else {
            alert('Failed: ' + response.getMessage());
        }
    });
}

// ---- Инициализация при загрузке страницы ----
window.addEventListener('load', () => {
    loadTermsList();
    document.getElementById('add-term-btn').addEventListener('click', showAddForm);
});