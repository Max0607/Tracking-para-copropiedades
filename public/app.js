const API = '/api/tasks';

const state = {
  tasks: [],
  tab: 'pending',
  filter: 'all',
  loading: true,
  error: null,
};

const TAG_COLORS = ['#2F5D50', '#C98A2E', '#4A6FA5', '#8B5E83', '#3F7D5C', '#A4562B', '#5C6BC0', '#7A6C53'];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const els = {
  form: document.getElementById('task-form'),
  description: document.getElementById('description'),
  copropiedad: document.getElementById('copropiedad'),
  copropiedadesList: document.getElementById('copropiedades-list'),
  submitBtn: document.getElementById('submit-btn'),
  formError: document.getElementById('form-error'),
  tabs: document.querySelectorAll('.tab'),
  countPending: document.getElementById('count-pending'),
  countCompleted: document.getElementById('count-completed'),
  filterSelect: document.getElementById('filter-copropiedad'),
  statusBanner: document.getElementById('status-banner'),
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),
};

async function loadTasks() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('request-failed');
    state.tasks = await res.json();
  } catch (err) {
    state.error = 'No se pudo conectar con el servidor. Si acabas de abrir la página, espera unos segundos y recarga (el servidor puede tardar en despertar).';
  } finally {
    state.loading = false;
    render();
  }
}

async function addTask(description, copropiedad) {
  els.submitBtn.disabled = true;
  els.formError.hidden = true;
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, copropiedad }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo guardar la tarea.');
    }
    const task = await res.json();
    state.tasks.unshift(task);
    els.form.reset();
    state.tab = 'pending';
    render();
  } catch (err) {
    els.formError.textContent = err.message;
    els.formError.hidden = false;
  } finally {
    els.submitBtn.disabled = false;
  }
}

async function toggleTask(id, completed) {
  const task = state.tasks.find((t) => t.id === id);
  const previous = task.completed;
  task.completed = completed;
  render();
  try {
    const res = await fetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error('request-failed');
    const updated = await res.json();
    Object.assign(task, updated);
    render();
  } catch (err) {
    task.completed = previous;
    state.error = 'No se pudo actualizar la tarea. Intenta de nuevo.';
    render();
  }
}

async function deleteTask(id) {
  if (!confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.')) return;
  const index = state.tasks.findIndex((t) => t.id === id);
  const [removed] = state.tasks.splice(index, 1);
  render();
  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('request-failed');
  } catch (err) {
    state.tasks.splice(index, 0, removed);
    state.error = 'No se pudo eliminar la tarea. Intenta de nuevo.';
    render();
  }
}

function getCopropiedades() {
  return [...new Set(state.tasks.map((t) => t.copropiedad))].sort((a, b) => a.localeCompare(b, 'es'));
}

function updateFilterOptions() {
  const names = getCopropiedades();
  const current = els.filterSelect.value;
  els.filterSelect.innerHTML = '<option value="all">Todas</option>' +
    names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  if (names.includes(current)) els.filterSelect.value = current;

  els.copropiedadesList.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
}

function checkIconSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"></polyline></svg>';
}

function trashIconSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>';
}

function renderTaskCard(task) {
  const li = document.createElement('li');
  li.className = 'task-card' + (task.completed ? ' task-card--done' : '');
  li.style.setProperty('--task-color', colorForName(task.copropiedad));

  const check = document.createElement('button');
  check.className = 'check-btn';
  check.type = 'button';
  check.setAttribute('aria-label', task.completed ? 'Marcar como pendiente' : 'Marcar como completada');
  check.innerHTML = checkIconSvg();
  check.addEventListener('click', () => toggleTask(task.id, !task.completed));

  const body = document.createElement('div');
  body.className = 'task-card__body';

  const desc = document.createElement('p');
  desc.className = 'task-card__description';
  desc.textContent = task.description;

  const meta = document.createElement('div');
  meta.className = 'task-card__meta';
  const tag = document.createElement('span');
  tag.className = 'task-card__tag';
  tag.textContent = task.copropiedad;
  meta.appendChild(tag);

  const dateSpan = document.createElement('span');
  dateSpan.textContent = task.completed
    ? `Completada: ${formatDate(task.completed_at)}`
    : `Agregada: ${formatDate(task.created_at)}`;
  meta.appendChild(dateSpan);

  body.appendChild(desc);
  body.appendChild(meta);

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.type = 'button';
  del.setAttribute('aria-label', 'Eliminar tarea');
  del.innerHTML = trashIconSvg();
  del.addEventListener('click', () => deleteTask(task.id));

  li.appendChild(check);
  li.appendChild(body);
  li.appendChild(del);
  return li;
}

function render() {
  if (state.error) {
    els.statusBanner.hidden = false;
    els.statusBanner.textContent = state.error;
  } else {
    els.statusBanner.hidden = true;
  }

  els.tabs.forEach((btn) => {
    btn.classList.toggle('tab--active', btn.dataset.tab === state.tab);
  });

  const pending = state.tasks.filter((t) => !t.completed);
  const completed = state.tasks.filter((t) => t.completed);
  els.countPending.textContent = pending.length;
  els.countCompleted.textContent = completed.length;

  updateFilterOptions();

  let list = state.tab === 'pending' ? pending : completed;
  if (state.filter !== 'all') {
    list = list.filter((t) => t.copropiedad === state.filter);
  }

  els.taskList.innerHTML = '';
  if (state.loading) {
    els.emptyState.hidden = true;
    return;
  }
  if (!list.length) {
    els.emptyState.hidden = false;
    els.emptyState.textContent = state.tab === 'pending'
      ? 'No hay tareas pendientes. ¡Buen trabajo!'
      : 'Aún no hay tareas completadas.';
  } else {
    els.emptyState.hidden = true;
    list.forEach((task) => els.taskList.appendChild(renderTaskCard(task)));
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const description = els.description.value.trim();
  const copropiedad = els.copropiedad.value.trim();
  if (!description || !copropiedad) {
    els.formError.textContent = 'La tarea y la copropiedad son obligatorias.';
    els.formError.hidden = false;
    return;
  }
  addTask(description, copropiedad);
});

els.tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    render();
  });
});

els.filterSelect.addEventListener('change', () => {
  state.filter = els.filterSelect.value;
  render();
});

loadTasks();
