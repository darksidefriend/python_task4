const { grpc } = require('grpc-web');
const { Empty, TermName, Term, Definition, Link, Relation } = require('./static/glossary_pb.js');
const { GlossaryServiceClient } = require('./static/glossary_grpc_web_pb.js');

const host = window.location.protocol + '//' + window.location.host + '/grpc.web';
const client = new GlossaryServiceClient(host);

let termsMap = {};        // кэш терминов
let currentTerm = null;   // термин, отображаемый в боковой панели
let network = null;       // объект vis-сети

// ---- Управление модальным окном ----
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeBtn = document.querySelector('.close');

closeBtn.onclick = closeModal;
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
};

function openModal(content) {
    modalBody.innerHTML = content;
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

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
            li.addEventListener('click', () => showTermModal(term.getName()));
            listEl.appendChild(li);
        });
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
        if (network) network.destroy();
        network = new vis.Network(container, data, options);
        network.on('click', params => {
            if (params.nodes.length > 0) {
                showTermModal(params.nodes[0]);
            }
        });
    });
}

// ---- Отображение деталей в боковой панели (без кнопок) ----
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
    document.getElementById('details').innerHTML = html;
}

// ---- Модальное окно с деталями термина (с кнопками Edit/Delete) ----
function showTermModal(termName) {
    const request = new TermName();
    request.setName(termName);
    client.getTermByName(request, {}, (err, term) => {
        if (err) {
            alert('Error loading term: ' + err.message);
            return;
        }
        const name = term.getName();
        const def = term.getDefinition();
        const text = def.getText();
        const links = def.getLinksList();
        const relations = term.getRelationsList();

        let html = `<div class="modal-term-details">`;
        html += `<h2>${name}</h2>`;
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
        html += `<div class="form-actions">`;
        html += `<button data-action="edit" data-term="${name}">✏️ Edit</button>`;
        html += `<button data-action="delete" data-term="${name}" class="danger">🗑️ Delete</button>`;
        html += `</div>`;
        html += `</div>`;

        openModal(html);
    });
}

// ---- Форма добавления/редактирования в модальном окне ----
function showAddForm() {
    const emptyTerm = {
        getName: () => '',
        getDefinition: () => ({ getText: () => '', getLinksList: () => [] }),
        getRelationsList: () => []
    };
    const formHtml = generateFormHtml(emptyTerm, true);
    openModal(formHtml);
    attachFormHandlers(true);
}

function showEditForm(term) {
    const formHtml = generateFormHtml(term, false);
    openModal(formHtml);
    attachFormHandlers(false);
}

function generateFormHtml(term, isNew) {
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

    return html;
}

function attachFormHandlers(isNew) {
    document.getElementById('add-link').addEventListener('click', addLinkRow);
    document.getElementById('add-relation').addEventListener('click', addRelationRow);
    document.getElementById('cancel-form').addEventListener('click', closeModal);
    document.getElementById('term-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveTerm(isNew);
    });

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

// ---- Сохранение термина ----
function saveTerm(isNew) {
    const form = document.getElementById('term-form');
    const nameInput = document.getElementById('term-name');
    const name = nameInput.value.trim();
    const defText = document.getElementById('definition-text').value.trim();

    if (!name || !defText) {
        alert('Name and definition are required.');
        return;
    }

    const links = [];
    document.querySelectorAll('#links-container .relation-row').forEach(row => {
        const url = row.querySelector('.link-url').value.trim();
        const title = row.querySelector('.link-title').value.trim();
        if (url && title) {
            const link = new Link();
            link.setUrl(url);
            link.setTitle(title);
            links.push(link);
        }
    });

    const relations = [];
    document.querySelectorAll('#relations-container .relation-row').forEach(row => {
        const to = row.querySelector('.relation-to').value.trim();
        const type = row.querySelector('.relation-type').value.trim();
        if (to && type) {
            const rel = new Relation();
            rel.setFromTerm(name);
            rel.setToTerm(to);
            rel.setRelationType(type);
            relations.push(rel);
        }
    });

    const term = new Term();
    term.setName(name);

    const def = new Definition();
    def.setText(defText);
    def.setLinksList(links);
    term.setDefinition(def);

    term.setRelationsList(relations);

    if (isNew) {
        client.addTerm(term, {}, (err, response) => {
            if (err) {
                alert('Error adding term: ' + err.message);
                return;
            }
            if (response.getSuccess()) {
                alert(response.getMessage());
                closeModal();
                loadTermsList();
                showTermDetails(name);   // обновляем боковую панель
            } else {
                alert('Failed: ' + response.getMessage());
            }
        });
    } else {
        client.updateTerm(term, {}, (err, response) => {
            if (err) {
                alert('Error updating term: ' + err.message);
                return;
            }
            if (response.getSuccess()) {
                alert(response.getMessage());
                closeModal();
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
            closeModal();
            loadTermsList();
            document.getElementById('details').innerHTML = '<h2>Term Details</h2><p>Click on a term to see details.</p>';
            currentTerm = null;
        } else {
            alert('Failed: ' + response.getMessage());
        }
    });
}

// ---- Делегирование событий для кнопок внутри модального окна ----
modalBody.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const termName = button.dataset.term;

    if (action === 'edit') {
        // Загружаем свежие данные термина и открываем форму редактирования
        const request = new TermName();
        request.setName(termName);
        client.getTermByName(request, {}, (err, term) => {
            if (err) {
                alert('Error loading term for edit: ' + err.message);
                return;
            }
            showEditForm(term);
        });
    } else if (action === 'delete') {
        deleteTerm(termName);
    }
});

// ---- Инициализация ----
window.addEventListener('load', () => {
    loadTermsList();
    document.getElementById('add-term-btn').addEventListener('click', showAddForm);
});