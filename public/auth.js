async function submitAuthForm(form, endpoint) {
  const errorBox = document.getElementById('auth-error');
  errorBox.classList.add('d-none');
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(form).entries());
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status}).`);
    window.location.assign('/');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
  } finally {
    submitButton.disabled = false;
  }
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuthForm(loginForm, '/api/auth/login');
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  const createMode = document.getElementById('mode-create');
  const teamName = document.getElementById('teamName');
  const inviteCode = document.getElementById('inviteCode');
  const createField = document.getElementById('team-name-field');
  const inviteField = document.getElementById('invite-code-field');
  const updateMode = () => {
    const creating = createMode.checked;
    createField.classList.toggle('d-none', !creating);
    inviteField.classList.toggle('d-none', creating);
    teamName.required = creating;
    inviteCode.required = !creating;
  };
  registerForm.querySelectorAll('input[name="mode"]').forEach((input) => input.addEventListener('change', updateMode));
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuthForm(registerForm, '/api/auth/register');
  });
  updateMode();
}
