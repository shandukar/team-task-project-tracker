const TASK_STATUSES = ['To Do', 'In Progress', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High'];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function requireText(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${label} is required.`);
  }
  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, label, maxLength);
}

function requiredId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ValidationError(`${label} must be a positive integer.`);
  }
  return id;
}

function optionalId(value, label) {
  if (value === undefined || value === null || value === '') return null;
  return requiredId(value, label);
}

function validEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  const email = requireText(value, 'Email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Email must be a valid email address.');
  }
  return email;
}

function validDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError('Due date must use YYYY-MM-DD format.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError('Due date must be a real calendar date.');
  }
  return value;
}

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  return body;
}

function validateProject(body) {
  body = requireObject(body);
  const startDate = validDate(body.start_date);
  const endDate = validDate(body.end_date);
  if (startDate && endDate && endDate < startDate) {
    throw new ValidationError('End date cannot be earlier than start date.');
  }
  return {
    name: requireText(body.name, 'Project name', 150),
    description: optionalText(body.description, 'Description', 2000),
    start_date: startDate,
    end_date: endDate
  };
}

function validateMember(body) {
  body = requireObject(body);
  return {
    name: requireText(body.name, 'Member name', 120),
    email: validEmail(body.email),
    role: optionalText(body.role, 'Role', 100)
  };
}

function validateRegistration(body) {
  body = requireObject(body);
  const name = requireText(body.name, 'Name', 120);
  const email = validEmail(body.email);
  if (!email) throw new ValidationError('Email is required.');
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ValidationError('Password must be between 8 and 128 characters.');
  }
  const mode = body.mode;
  if (mode !== 'create' && mode !== 'join') {
    throw new ValidationError('Choose whether to create a team or join one.');
  }
  if (mode === 'create') {
    return {
      name, email: email.toLowerCase(), password, mode,
      teamName: requireText(body.teamName, 'Team name', 150)
    };
  }
  const inviteCode = requireText(body.inviteCode, 'Invite code', 24).toUpperCase();
  return { name, email: email.toLowerCase(), password, mode, inviteCode };
}

function validateLogin(body) {
  body = requireObject(body);
  const email = validEmail(body.email);
  if (!email) throw new ValidationError('Email is required.');
  if (typeof body.password !== 'string' || body.password.length === 0 || body.password.length > 128) {
    throw new ValidationError('Password is required.');
  }
  return { email: email.toLowerCase(), password: body.password };
}

function validateTask(body) {
  body = requireObject(body);
  const status = body.status === undefined ? 'To Do' : body.status;
  const priority = body.priority === undefined ? 'Medium' : body.priority;
  if (!TASK_STATUSES.includes(status)) {
    throw new ValidationError(`Status must be one of: ${TASK_STATUSES.join(', ')}.`);
  }
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new ValidationError(`Priority must be one of: ${TASK_PRIORITIES.join(', ')}.`);
  }
  return {
    title: requireText(body.title, 'Task title', 200),
    description: optionalText(body.description, 'Description', 2000),
    project_id: requiredId(body.project_id, 'Project'),
    member_id: optionalId(body.member_id, 'Assignee'),
    status,
    priority,
    due_date: validDate(body.due_date)
  };
}

module.exports = {
  TASK_STATUSES,
  TASK_PRIORITIES,
  ValidationError,
  requiredId,
  validateProject,
  validateMember,
  validateTask,
  validateRegistration,
  validateLogin
};
