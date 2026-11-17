const state = { projects: [], members: [], tasks: [], editing: null };
const modal = new bootstrap.Modal(document.getElementById('edit-modal'));
let noticeTimeout = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status}).`);
  return result.data;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function showNotice(message, type = 'danger') {
  window.clearTimeout(noticeTimeout);
  noticeTimeout = null;
  const notice = document.getElementById('notice');
  notice.className = `alert alert-${type}${type === 'success' ? '' : ' alert-dismissible fade show'}`;
  notice.textContent = message;
  if (type !== 'success') {
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('aria-label', 'Dismiss message');
    closeButton.addEventListener('click', clearNotice, { once: true });
    notice.append(closeButton);
  } else {
    noticeTimeout = window.setTimeout(clearNotice, 4000);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearNotice() {
  window.clearTimeout(noticeTimeout);
  noticeTimeout = null;
  const notice = document.getElementById('notice');
  notice.className = 'alert d-none';
  notice.textContent = '';
}

async function refresh() {
  try {
    [state.projects, state.members, state.tasks] = await Promise.all([
      api('/api/projects'), api('/api/members'), api('/api/tasks')
    ]);
    await renderOverview();
    renderProjects();
    renderMembers();
    updateFilterOptions();
    await renderTasks();
  } catch (error) {
    showNotice(error.message);
  }
}

function renderOverview() {
  return api('/api/overview').then((counts) => {
    const cards = [
      ['Projects', counts.projects], ['Tasks', counts.tasks], ['Team members', counts.members],
      ['To Do', counts.to_do], ['In Progress', counts.in_progress], ['Done', counts.done]
    ];
    document.getElementById('overview-cards').innerHTML = cards.map(([label, count]) => `
      <div class="col-6 col-lg-2"><div class="card stat-card shadow-sm"><div class="card-body">
        <div class="text-secondary small">${label}</div><div class="stat-number">${count}</div>
      </div></div></div>`).join('');
    const recent = [...state.tasks].slice(0, 5);
    document.getElementById('recent-tasks').innerHTML = recent.length
      ? taskTable(recent, false) : '<div class="empty-state">No tasks yet. Create a task to get started.</div>';
  });
}

function updateFilterOptions() {
  const projectFilter = document.getElementById('filter-project');
  const memberFilter = document.getElementById('filter-member');
  const selectedProject = projectFilter.value;
  const selectedMember = memberFilter.value;
  projectFilter.innerHTML = '<option value="">All projects</option>' +
    state.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('');
  memberFilter.innerHTML = '<option value="">All assignees</option><option value="unassigned">Unassigned</option>' +
    state.members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join('');
  projectFilter.value = selectedProject;
  memberFilter.value = selectedMember;
}

function renderProjects() {
  const container = document.getElementById('projects-table');
  if (!state.projects.length) return container.innerHTML = '<div class="empty-state">No projects yet. Add your first project.</div>';
  container.innerHTML = `<div class="table-responsive"><table class="table align-middle">
    <thead><tr><th>Project</th><th>Description</th><th>Dates</th><th></th></tr></thead><tbody>
      ${state.projects.map((project) => `<tr>
        <td class="fw-semibold">${escapeHtml(project.name)}</td>
        <td class="description-cell">${escapeHtml(project.description || '—')}</td>
        <td>${escapeHtml(project.start_date || '—')} – ${escapeHtml(project.end_date || '—')}</td>
        <td class="text-end text-nowrap">${actionButtons('project', project.id)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function renderMembers() {
  const container = document.getElementById('members-table');
  if (!state.members.length) return container.innerHTML = '<div class="empty-state">No team members yet. Add someone to assign tasks.</div>';
  container.innerHTML = `<div class="table-responsive"><table class="table align-middle">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>
      ${state.members.map((member) => `<tr>
        <td class="fw-semibold">${escapeHtml(member.name)}</td><td>${escapeHtml(member.email || '—')}</td>
        <td>${escapeHtml(member.role || '—')}</td><td class="text-end text-nowrap">${actionButtons('member', member.id)}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function taskTable(tasks, showActions = true) {
  if (!tasks.length) return '<div class="empty-state">No tasks match these filters.</div>';
  const today = localDateString();
  return `<div class="table-responsive"><table class="table align-middle">
    <thead><tr><th>Task</th><th>Project</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due</th>${showActions ? '<th></th>' : ''}</tr></thead>
    <tbody>${tasks.map((task) => `<tr>
      <td class="fw-semibold">${escapeHtml(task.title)}${task.description ? `<div class="small text-secondary fw-normal">${escapeHtml(task.description)}</div>` : ''}</td>
      <td>${escapeHtml(task.project_name || '—')}</td><td>${escapeHtml(task.member_name || 'Unassigned')}</td>
      <td><span class="badge rounded-pill ${task.status === 'Done' ? 'text-bg-success' : task.status === 'In Progress' ? 'text-bg-primary' : 'text-bg-secondary'} badge-status">${escapeHtml(task.status)}</span></td>
      <td>${escapeHtml(task.priority)}</td><td>${escapeHtml(task.due_date || '—')}${isOverdue(task, today) ? '<span class="badge text-bg-danger ms-2">Overdue</span>' : ''}</td>
      ${showActions ? `<td class="text-end text-nowrap">${actionButtons('task', task.id)}</td>` : ''}
    </tr>`).join('')}</tbody></table></div>`;
}

function localDateString() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.status !== 'Done' && typeof task.due_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.due_date) && task.due_date < today;
}

async function renderTasks() {
  const params = new URLSearchParams();
  const project = document.getElementById('filter-project').value;
  const member = document.getElementById('filter-member').value;
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  if (project) params.set('project_id', project);
  if (member) params.set('member_id', member);
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  const taskList = await api(`/api/tasks?${params}`);
  document.getElementById('tasks-table').innerHTML = taskTable(taskList);
}

async function initialize() {
  try {
    const user = await api('/api/auth/me');
    const context = document.getElementById('team-context');
    context.textContent = `${user.team_name} · Invite code: ${user.invite_code}`;
    await refresh();
  } catch (error) {
    if (error.message === 'Please log in to continue.' || error.message.includes('session has expired')) {
      window.location.replace('/login.html');
      return;
    }
    showNotice(error.message);
  }
}

function actionButtons(type, id) {
  return `<button class="btn btn-sm btn-outline-primary me-1" data-edit="${type}" data-id="${id}">Edit</button>
    <button class="btn btn-sm btn-outline-danger" data-delete="${type}" data-id="${id}">Delete</button>`;
}

function field(label, name, value = '', type = 'text', required = false, extra = '') {
  return `<div class="mb-3"><label class="form-label" for="field-${name}">${label}</label>
    <input class="form-control" id="field-${name}" name="${name}" type="${type}" value="${escapeHtml(value ?? '')}" ${required ? 'required' : ''} ${extra}></div>`;
}

function selectField(label, name, options, value, required = false) {
  return `<div class="mb-3"><label class="form-label" for="field-${name}">${label}</label>
    <select class="form-select" id="field-${name}" name="${name}" ${required ? 'required' : ''}>
      ${options.map(([optionValue, text]) => `<option value="${escapeHtml(optionValue)}" ${String(optionValue) === String(value) ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}
    </select></div>`;
}

function openEditor(type, record = null) {
  state.editing = { type, id: record?.id };
  document.getElementById('modal-title').textContent = `${record ? 'Edit' : 'Add'} ${type === 'member' ? 'team member' : type}`;
  let html = '';
  if (type === 'project') {
    html = field('Project name', 'name', record?.name, 'text', true) +
      `<div class="mb-3"><label class="form-label" for="field-description">Description</label><textarea class="form-control" id="field-description" name="description" rows="3">${escapeHtml(record?.description || '')}</textarea></div>` +
      field('Start date', 'start_date', record?.start_date, 'date') + field('End date', 'end_date', record?.end_date, 'date');
  } else if (type === 'member') {
    html = field('Name', 'name', record?.name, 'text', true) + field('Email', 'email', record?.email, 'email') + field('Role', 'role', record?.role);
  } else {
    html = field('Task title', 'title', record?.title, 'text', true) +
      `<div class="mb-3"><label class="form-label" for="field-description">Description</label><textarea class="form-control" id="field-description" name="description" rows="2">${escapeHtml(record?.description || '')}</textarea></div>` +
      selectField('Project', 'project_id', state.projects.map((p) => [p.id, p.name]), record?.project_id || state.projects[0]?.id, true) +
      selectField('Assignee', 'member_id', [['', 'Unassigned'], ...state.members.map((m) => [m.id, m.name])], record?.member_id || '') +
      selectField('Status', 'status', ['To Do', 'In Progress', 'Done'].map((v) => [v, v]), record?.status || 'To Do') +
      selectField('Priority', 'priority', ['Low', 'Medium', 'High'].map((v) => [v, v]), record?.priority || 'Medium') +
      field('Due date', 'due_date', record?.due_date, 'date');
  }
  document.getElementById('modal-fields').innerHTML = html;
  modal.show();
}

document.addEventListener('click', async (event) => {
  const nav = event.target.closest('[data-view]');
  if (nav) {
    event.preventDefault();
    document.querySelectorAll('.app-view').forEach((view) => view.classList.add('d-none'));
    document.getElementById(`${nav.dataset.view}-view`).classList.remove('d-none');
    document.querySelectorAll('.nav-link[data-view]').forEach((link) => link.classList.toggle('active', link.dataset.view === nav.dataset.view));
    document.getElementById('mainNav').classList.remove('show');
  }
  const create = event.target.closest('[data-create]');
  if (create) {
    if (create.dataset.create === 'task' && !state.projects.length) return showNotice('Add a project before creating a task.');
    openEditor(create.dataset.create);
  }
  const edit = event.target.closest('[data-edit]');
  if (edit) {
    const type = edit.dataset.edit;
    const records = type === 'project' ? state.projects : type === 'member' ? state.members : state.tasks;
    openEditor(type, records.find((item) => item.id === Number(edit.dataset.id)));
  }
  const remove = event.target.closest('[data-delete]');
  if (remove) {
    const type = remove.dataset.delete;
    const label = type === 'member' ? 'team member' : type;
    if (!window.confirm(`Delete this ${label}?${type === 'project' ? ' Its tasks will also be deleted.' : ''}`)) return;
    try {
      clearNotice();
      await api(`/api/${type === 'member' ? 'members' : `${type}s`}/${remove.dataset.id}`, { method: 'DELETE' });
      await refresh();
      showNotice(`${label[0].toUpperCase()}${label.slice(1)} deleted.`, 'success');
    } catch (error) { showNotice(error.message); }
  }
});

document.getElementById('edit-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { type, id } = state.editing;
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (type === 'task') {
    data.project_id = Number(data.project_id);
    data.member_id = data.member_id ? Number(data.member_id) : null;
  }
  try {
    clearNotice();
    await api(`/api/${type === 'member' ? 'members' : `${type}s`}${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(data)
    });
    modal.hide();
    await refresh();
    showNotice(`${type[0].toUpperCase()}${type.slice(1)} saved.`, 'success');
  } catch (error) { showNotice(error.message); }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login.html');
  } catch (error) {
    showNotice(error.message);
  }
});

['filter-project', 'filter-member', 'filter-status', 'filter-priority'].forEach((id) => {
  document.getElementById(id).addEventListener('change', () => renderTasks().catch((error) => showNotice(error.message)));
});

initialize();
