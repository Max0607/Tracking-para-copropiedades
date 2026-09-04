const API_TASKS = '/api/tasks';
const API_COPROPIEDADES = '/api/copropiedades';

const state = {
  tasks: [],
  copropiedades: [],
  notes: [],
  activeTaskId: null,
  pendingPhoto: null,
  tab: 'pending',
  filter: 'all',
  loading: true,
  error: null,
};

const TAG_COLORS = ['#1F6B55', '#D9932F', '#3E6FA6', '#8B5E83', '#4F8F6C', '#A4562B', '#5C6BC0', '#7A6C53'];

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
  submitBtn: document.getElementById('submit-btn'),
  formError: document.getElementById('form-error'),
  tabs: document.querySelectorAll('.tab'),
  countPending: document.getElementById('count-pending'),
  countCompleted: document.getElementById('count-completed'),
  chipBar: document.getElementById('chip-bar'),
  statusBanner: document.getElementById('status-banner'),
  taskList: document.getElementById('task-list'),
  emptyState: document.getElementById('empty-state'),
  emptyStateText: document.getElementById('empty-state__text'),
  fab: document.getElementById('fab'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalClose: document.getElementById('modal-close'),
  quickAddToggle: document.getElementById('quick-add-toggle'),
  quickAddRow: document.getElementById('quick-add-row'),
  quickAddInput: document.getElementById('quick-add-input'),
  quickAddConfirm: document.getElementById('quick-add-confirm'),
  manageBtn: document.getElementById('manage-btn'),
  manageBackdrop: document.getElementById('manage-backdrop'),
  manageClose: document.getElementById('manage-close'),
  manageForm: document.getElementById('manage-form'),
  manageInput: document.getElementById('manage-input'),
  manageError: document.getElementById('manage-error'),
  manageList: document.getElementById('manage-list'),
  manageEmpty: document.getElementById('manage-empty'),
  detailBackdrop: document.getElementById('detail-backdrop'),
  detailClose: document.getElementById('detail-close'),
  detailTag: document.getElementById('detail-tag'),
  detailDescription: document.getElementById('detail-description'),
  detailDates: document.getElementById('detail-dates'),
  notesList: document.getElementById('notes-list'),
  notesEmpty: document.getElementById('notes-empty'),
  noteForm: document.getElementById('note-form'),
  noteText: document.getElementById('note-text'),
  noteError: document.getElementById('note-error'),
  noteSubmit: document.getElementById('note-submit'),
  notePhotoInput: document.getElementById('note-photo-input'),
  notePhotoPreview: document.getElementById('note-photo-preview'),
  notePhotoPreviewImg: document.getElementById('note-photo-preview-img'),
  notePhotoRemove: document.getElementById('note-photo-remove'),
  lightbox: document.getElementById('lightbox'),
  lightboxImg: document.getElementById('lightbox-img'),
  lightboxClose: document.getElementById('lightbox-close'),
};

/* ---------- Modal: nueva tarea ---------- */
function openModal() {
  if (!state.copropiedades.length) {
    openManageModal();
    return;
  }
  els.modalBackdrop.hidden = false;
  els.formError.hidden = true;
  requestAnimationFrame(() => els.description.focus());
  document.addEventListener('keydown', onModalKeydown);
}
function closeModal() {
  els.modalBackdrop.hidden = true;
  els.form.reset();
  els.formError.hidden = true;
  els.quickAddRow.hidden = true;
  document.removeEventListener('keydown', onModalKeydown);
}
function onModalKeydown(e) {
  if (e.key === 'Escape') closeModal();
}
els.fab.addEventListener('click', openModal);
els.modalClose.addEventListener('click', closeModal);
els.modalBackdrop.addEventListener('click', (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

/* ---------- Modal: gestionar copropiedades ---------- */
function openManageModal() {
  els.manageBackdrop.hidden = false;
  els.manageError.hidden = true;
  requestAnimationFrame(() => els.manageInput.focus());
  document.addEventListener('keydown', onManageKeydown);
}
function closeManageModal() {
  els.manageBackdrop.hidden = true;
  els.manageForm.reset();
  els.manageError.hidden = true;
  document.removeEventListener('keydown', onManageKeydown);
}
function onManageKeydown(e) {
  if (e.key === 'Escape') closeManageModal();
}
els.manageBtn.addEventListener('click', openManageModal);
els.manageClose.addEventListener('click', closeManageModal);
els.manageBackdrop.addEventListener('click', (e) => {
  if (e.target === els.manageBackdrop) closeManageModal();
});

/* ---------- Agregar rápido dentro del formulario de tarea ---------- */
els.quickAddToggle.addEventListener('click', () => {
  els.quickAddRow.hidden = !els.quickAddRow.hidden;
  if (!els.quickAddRow.hidden) requestAnimationFrame(() => els.quickAddInput.focus());
});
els.quickAddConfirm.addEventListener('click', async () => {
  const name = els.quickAddInput.value.trim();
  if (!name) return;
  const created = await addCopropiedad(name, els.formError);
  if (created) {
    els.quickAddInput.value = '';
    els.quickAddRow.hidden = true;
    els.copropiedad.value = created.name;
  }
});

/* ---------- Datos: copropiedades ---------- */
async function loadCopropiedades() {
  try {
    const res = await fetch(API_COPROPIEDADES);
    if (!res.ok) throw new Error('request-failed');
    state.copropiedades = await res.json();
  } catch (err) {
    state.copropiedades = [];
  }
  renderCopropiedadSelect();
  renderManageList();
}

async function addCopropiedad(name, errorEl) {
  try {
    const res = await fetch(API_COPROPIEDADES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo agregar la copropiedad.');
    }
    const copropiedad = await res.json();
    if (!state.copropiedades.some((c) => c.id === copropiedad.id)) {
      state.copropiedades.push(copropiedad);
      state.copropiedades.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    renderCopropiedadSelect();
    renderManageList();
    if (errorEl) errorEl.hidden = true;
    return copropiedad;
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
    return null;
  }
}

async function deleteCopropiedad(id) {
  if (!confirm('¿Eliminar esta copropiedad de la lista?')) return;
  try {
    const res = await fetch(`${API_COPROPIEDADES}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo eliminar la copropiedad.');
    }
    state.copropiedades = state.copropiedades.filter((c) => c.id !== id);
    renderCopropiedadSelect();
    renderManageList();
  } catch (err) {
    els.manageError.textContent = err.message;
    els.manageError.hidden = false;
  }
}

els.manageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = els.manageInput.value.trim();
  if (!name) return;
  const created = await addCopropiedad(name, els.manageError);
  if (created) els.manageForm.reset();
});

function renderCopropiedadSelect() {
  const current = els.copropiedad.value;
  els.copropiedad.innerHTML = '<option value="" disabled' + (current ? '' : ' selected') + '>Selecciona una copropiedad</option>' +
    state.copropiedades.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  if (state.copropiedades.some((c) => c.name === current)) {
    els.copropiedad.value = current;
  }
}

function renderManageList() {
  els.manageList.innerHTML = '';
  if (!state.copropiedades.length) {
    els.manageEmpty.hidden = false;
    return;
  }
  els.manageEmpty.hidden = true;
  state.copropiedades.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'manage-list__item';
    li.style.setProperty('--item-color', colorForName(c.name));

    const dot = document.createElement('span');
    dot.className = 'manage-list__dot';

    const name = document.createElement('span');
    name.className = 'manage-list__name';
    name.textContent = c.name;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.setAttribute('aria-label', `Eliminar ${c.name}`);
    del.innerHTML = trashIconSvg();
    del.addEventListener('click', () => deleteCopropiedad(c.id));

    li.appendChild(dot);
    li.appendChild(name);
    li.appendChild(del);
    els.manageList.appendChild(li);
  });
}

/* ---------- Modal: detalle de tarea (notas y fotos) ---------- */
function openDetail(task) {
  state.activeTaskId = task.id;
  state.notes = [];
  els.detailTag.textContent = task.copropiedad;
  els.detailTag.style.setProperty('--task-color', colorForName(task.copropiedad));
  els.detailDescription.textContent = task.description;
  els.detailDates.textContent = task.completed
    ? `Agregada: ${formatDate(task.created_at)} · Completada: ${formatDate(task.completed_at)}`
    : `Agregada: ${formatDate(task.created_at)}`;
  renderNotes();
  els.detailBackdrop.hidden = false;
  document.addEventListener('keydown', onDetailKeydown);
  fetchNotes(task.id);
}
function closeDetail() {
  els.detailBackdrop.hidden = true;
  state.activeTaskId = null;
  els.noteForm.reset();
  els.noteError.hidden = true;
  clearPendingPhoto();
  document.removeEventListener('keydown', onDetailKeydown);
}
function onDetailKeydown(e) {
  if (e.key === 'Escape') closeDetail();
}
els.detailClose.addEventListener('click', closeDetail);
els.detailBackdrop.addEventListener('click', (e) => {
  if (e.target === els.detailBackdrop) closeDetail();
});

async function fetchNotes(taskId) {
  try {
    const res = await fetch(`${API_TASKS}/${taskId}/notes`);
    if (!res.ok) throw new Error('request-failed');
    state.notes = await res.json();
  } catch (err) {
    state.notes = [];
  }
  renderNotes();
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

function noteIconSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v13H8l-4 4z"></path></svg>';
}

function renderNotes() {
  els.notesList.innerHTML = '';
  if (!state.notes.length) {
    els.notesEmpty.hidden = false;
    return;
  }
  els.notesEmpty.hidden = true;
  state.notes.forEach((note) => {
    const li = document.createElement('li');
    li.className = 'note-item';

    if (note.image_data) {
      const img = document.createElement('img');
      img.className = 'note-item__image';
      img.src = note.image_data;
      img.alt = 'Foto adjunta a la nota';
      img.addEventListener('click', () => openLightbox(note.image_data));
      li.appendChild(img);
    }
    if (note.text) {
      const p = document.createElement('p');
      p.className = 'note-item__text';
      p.textContent = note.text;
      li.appendChild(p);
    }
    const date = document.createElement('p');
    date.className = 'note-item__date';
    date.textContent = formatDateTime(note.created_at);
    li.appendChild(date);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'note-item__delete';
    del.setAttribute('aria-label', 'Eliminar nota');
    del.innerHTML = trashIconSvg();
    del.addEventListener('click', () => deleteNote(note.id));
    li.appendChild(del);

    els.notesList.appendChild(li);
  });
}

function updateTaskNotesCount(delta) {
  const task = state.tasks.find((t) => t.id === state.activeTaskId);
  if (task) task.notes_count = Math.max(0, (task.notes_count || 0) + delta);
  render();
}

async function deleteNote(id) {
  if (!confirm('¿Eliminar esta nota?')) return;
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('request-failed');
    state.notes = state.notes.filter((n) => n.id !== id);
    renderNotes();
    updateTaskNotesCount(-1);
  } catch (err) {
    els.noteError.textContent = 'No se pudo eliminar la nota. Intenta de nuevo.';
    els.noteError.hidden = false;
  }
}

/* ---------- Comprimir foto en el navegador antes de subirla ---------- */
function compressImage(file) {
  const MAX_DIM = 1280;
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          } else {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function clearPendingPhoto() {
  state.pendingPhoto = null;
  els.notePhotoPreview.hidden = true;
  els.notePhotoPreviewImg.src = '';
  els.notePhotoInput.value = '';
}

els.notePhotoInput.addEventListener('change', async () => {
  const file = els.notePhotoInput.files[0];
  if (!file) return;
  els.noteError.hidden = true;
  try {
    const dataUrl = await compressImage(file);
    state.pendingPhoto = dataUrl;
    els.notePhotoPreviewImg.src = dataUrl;
    els.notePhotoPreview.hidden = false;
  } catch (err) {
    els.noteError.textContent = err.message;
    els.noteError.hidden = false;
  } finally {
    els.notePhotoInput.value = '';
  }
});
els.notePhotoRemove.addEventListener('click', clearPendingPhoto);

els.noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = els.noteText.value.trim();
  const image = state.pendingPhoto;
  if (!text && !image) {
    els.noteError.textContent = 'Escribe algo o adjunta una foto para guardar la nota.';
    els.noteError.hidden = false;
    return;
  }
  els.noteSubmit.disabled = true;
  els.noteError.hidden = true;
  try {
    const res = await fetch(`${API_TASKS}/${state.activeTaskId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image_data: image }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo guardar la nota.');
    }
    const note = await res.json();
    state.notes.push(note);
    renderNotes();
    updateTaskNotesCount(1);
    els.noteText.value = '';
    clearPendingPhoto();
  } catch (err) {
    els.noteError.textContent = err.message;
    els.noteError.hidden = false;
  } finally {
    els.noteSubmit.disabled = false;
  }
});

/* ---------- Visor de imágenes a pantalla completa ---------- */
function openLightbox(src) {
  els.lightboxImg.src = src;
  els.lightbox.hidden = false;
}
function closeLightbox() {
  els.lightbox.hidden = true;
  els.lightboxImg.src = '';
}
els.lightboxClose.addEventListener('click', closeLightbox);
els.lightbox.addEventListener('click', (e) => {
  if (e.target === els.lightbox) closeLightbox();
});

/* ---------- Datos: tareas ---------- */
async function loadTasks() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const res = await fetch(API_TASKS);
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
    const res = await fetch(API_TASKS, {
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
    state.tab = 'pending';
    closeModal();
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
    const res = await fetch(`${API_TASKS}/${id}`, {
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
    const res = await fetch(`${API_TASKS}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('request-failed');
  } catch (err) {
    state.tasks.splice(index, 0, removed);
    state.error = 'No se pudo eliminar la tarea. Intenta de nuevo.';
    render();
  }
}

function getCopropiedadesConTareas() {
  return [...new Set(state.tasks.map((t) => t.copropiedad))].sort((a, b) => a.localeCompare(b, 'es'));
}

/* ---------- Render ---------- */
function renderChipBar() {
  const names = getCopropiedadesConTareas();
  if (state.filter !== 'all' && !names.includes(state.filter)) state.filter = 'all';

  const chips = ['all', ...names];
  els.chipBar.innerHTML = '';
  chips.forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (state.filter === name ? ' chip--active' : '');
    if (name !== 'all') {
      chip.style.setProperty('--chip-color', colorForName(name));
      chip.innerHTML = `<span class="chip__dot"></span>${escapeHtml(name)}`;
    } else {
      chip.textContent = 'Todas';
    }
    chip.addEventListener('click', () => {
      state.filter = name;
      render();
    });
    els.chipBar.appendChild(chip);
  });
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
  body.addEventListener('click', () => openDetail(task));

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

  if (task.notes_count > 0) {
    const badge = document.createElement('span');
    badge.className = 'task-card__notes-badge';
    badge.innerHTML = noteIconSvg() + task.notes_count;
    meta.appendChild(badge);
  }

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
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle('tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const pending = state.tasks.filter((t) => !t.completed);
  const completed = state.tasks.filter((t) => t.completed);
  els.countPending.textContent = pending.length;
  els.countCompleted.textContent = completed.length;

  renderChipBar();

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
    els.emptyStateText.textContent = state.tab === 'pending'
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
  const copropiedad = els.copropiedad.value;
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

loadCopropiedades();
loadTasks();
