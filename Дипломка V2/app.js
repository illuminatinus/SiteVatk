const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
const userStorageKey = 'vatkCurrentUser';
const langStorageKey = 'vatkLang';

function getUser() {
  var raw = localStorage.getItem(userStorageKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function setUser(user) {
  localStorage.setItem(userStorageKey, JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem(userStorageKey);
}

function getLanguage() {
  return localStorage.getItem(langStorageKey) || 'ru';
}

function setLanguage(lang) {
  localStorage.setItem(langStorageKey, lang);
}

function checkEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function translatePage() {
  // функция оставлена для совместимости
}

function setupLangToggle() {
  var btns = document.querySelectorAll('#langToggle');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function() {
      var next = getLanguage() === 'ru' ? 'kz' : 'ru';
      setLanguage(next);
      location.reload();
    });
  }
}

function checkAuth() {
  var allowedPages = ['login'];
  var page = document.body.getAttribute('data-page');
  var user = getUser();
  
  if (!user && allowedPages.indexOf(page) === -1) {
    window.location = 'login.html';
    return false;
  }
  if (user && page === 'login') {
    window.location = 'index.html';
    return false;
  }
  if (page === 'admin' && user && user.role !== 'admin') {
    window.location = 'index.html';
    return false;
  }
  return true;
}

function updateMenu() {
  var user = getUser();
  if (!user) return;
  var links = document.querySelectorAll('.menu a');
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('href') === 'admin.html' && user.role !== 'admin') {
      links[i].style.display = 'none';
    }
  }
}

function setupLogout() {
  var btns = document.querySelectorAll('#logoutBtn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function() {
      removeUser();
      window.location = 'login.html';
    });
  }
}

function parseJsonResponse(res) {
  return res.text().then(function(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Ответ сервера не является JSON: ' + text);
    }
  });
}

var localUsersKey = 'vatkLocalUsers';

function ensureLocalUsers() {
  var raw = localStorage.getItem(localUsersKey);
  if (raw) {
    try {
      var users = JSON.parse(raw);
      if (Array.isArray(users)) return users;
    } catch (e) {
      // ignore invalid data
    }
  }
  var now = new Date().toISOString();
  var users = [
    {id: 'u-admin', name: 'Администратор', email: 'admin@vatk.kz', password: 'admin123', role: 'admin', createdAt: now},
    {id: 'u-teacher', name: 'Aida Bek', email: 'teacher@vatk.kz', password: 'teacher123', role: 'teacher', createdAt: now},
    {id: 'u-student', name: 'Nursultan S.', email: 'student@vatk.kz', password: 'student123', role: 'student', createdAt: now},
    {id: 'u-secretary', name: 'Секретарь', email: 'secretary@vatk.kz', password: 'secretary123', role: 'secretary', createdAt: now}
  ];
  localStorage.setItem(localUsersKey, JSON.stringify(users));
  return users;
}

function saveLocalUsers(users) {
  localStorage.setItem(localUsersKey, JSON.stringify(users));
}

function localAuthLogin(email, password) {
  var users = ensureLocalUsers();
  var user = users.find(function(u) { return u.email === email && u.password === password; });
  if (!user) return Promise.reject(new Error('Неверный email или пароль'));
  return Promise.resolve({user: {id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt}});
}

function localAuthRegister(data) {
  var users = ensureLocalUsers();
  if (users.some(function(u) { return u.email === data.email; })) {
    return Promise.reject(new Error('Пользователь уже существует'));
  }
  var now = new Date().toISOString();
  var user = {
    id: 'u-local-' + Date.now(),
    name: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    createdAt: now
  };
  users.push(user);
  saveLocalUsers(users);
  return Promise.resolve({user: {id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt}});
}

function parseJsonResponse(res) {
  return res.text().then(function(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Ответ сервера не является JSON: ' + text);
    }
  });
}

function apiCall(path, method, body, isFormData, fullUrl) {
  var opts = {method: method, headers: {}};
  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  var requestUrl = fullUrl ? path : apiUrl + path;
  return fetch(requestUrl, opts).then(function(res) {
    return parseJsonResponse(res).then(function(data) {
      if (!res.ok) {
        var message = 'Ошибка сервера';
        if (data && typeof data === 'object' && data.message) {
          message = data.message;
        } else if (data && typeof data === 'string') {
          message = data;
        } else {
          message += ' ' + res.status;
        }
        throw new Error(message);
      }
      return data || {};
    });
  }).catch(function(err) {
    if (err.message === 'Failed to fetch' || err.message === 'Load failed') {
      throw new Error('Сервер недоступен');
    }
    throw err;
  });
}

function localAuthCall(action, body) {
  if (action === 'login') {
    return localAuthLogin(body.email, body.password);
  }
  if (action === 'register') {
    return localAuthRegister(body);
  }
  return Promise.reject(new Error('Недопустимое действие'));
}

function authPhpCall(action, body) {
  return apiCall('/auth.php?action=' + action, 'POST', body, false, true).catch(function(err) {
    if (err.message === 'Сервер недоступен' || err.message.indexOf('Ответ сервера не является JSON') === 0 || err.message.indexOf('Ошибка сервера') === 0 || err.message.indexOf('404') === 0 || err.message.indexOf('500') === 0 || err.message === 'Failed to fetch') {
      return localAuthCall(action, body);
    }
    throw err;
  });
}

function authCall(action, body) {
  var nodeUrl = apiUrl + '/auth/' + action;
  return fetch(nodeUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body)
  }).then(function(res) {
    if (res.ok) {
      return parseJsonResponse(res).then(function(data) {
        return data || {};
      });
    }
    if (res.status === 404 || res.status === 500) {
      throw new Error('NODE-FALLBACK');
    }
    return parseJsonResponse(res).then(function(data) {
      var message = 'Ошибка';
      if (data && data.message) message = data.message;
      else if (typeof data === 'string') message = data;
      throw new Error(message);
    }).catch(function() {
      throw new Error('NODE-FALLBACK');
    });
  }).catch(function(err) {
    if (err.message === 'Сервер недоступен' || err.message === 'Failed to fetch' || err.message === 'NODE-FALLBACK') {
      return authPhpCall(action, body);
    }
    return authPhpCall(action, body);
  });
}

function loadUsers() {
  return apiCall('/users').then(function(d) { return d.users || []; });
}

function loadDocs() {
  return apiCall('/documents').then(function(d) { return d.documents || []; });
}

function newDoc(form) {
  return apiCall('/documents', 'POST', form, true).then(function(d) { return d.document; });
}

function delUser(id) {
  return apiCall('/users/' + id, 'DELETE');
}

function delDoc(id) {
  return apiCall('/documents/' + id, 'DELETE');
}

function formatDate(str) {
  var lang = getLanguage();
  return new Date(str).toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU');
}

function initLogin() {
  var loginBtn = document.getElementById('loginTab');
  var regBtn = document.getElementById('registerTab');
  var nameFld = document.getElementById('nameField');
  var roleFld = document.getElementById('roleField');
  var submitBtn = document.getElementById('submitBtn');
  var msg = document.getElementById('messageText');
  var form = document.getElementById('authForm');

  function switchMode(m) {
    if (m === 'login') {
      loginBtn.classList.add('active');
      regBtn.classList.remove('active');
      nameFld.classList.add('hidden');
      roleFld.classList.add('hidden');
      submitBtn.textContent = 'Вход';
    } else {
      loginBtn.classList.remove('active');
      regBtn.classList.add('active');
      nameFld.classList.remove('hidden');
      roleFld.classList.remove('hidden');
      submitBtn.textContent = 'Регистрация';
    }
    msg.textContent = '';
  }

  if (loginBtn) loginBtn.onclick = function() { switchMode('login'); };
  if (regBtn) regBtn.onclick = function() { switchMode('register'); };
  switchMode('login');

  if (form) {
    form.onsubmit = function(e) {
      e.preventDefault();
      var email = document.getElementById('emailInput').value.trim().toLowerCase();
      var pass = document.getElementById('passwordInput').value.trim();
      var name = document.getElementById('nameInput').value.trim();
      var role = document.getElementById('roleInput').value;

      if (!email || !checkEmail(email)) {
        msg.textContent = 'Введите настоящий email';
        return;
      }
      if (!pass) {
        msg.textContent = 'Введите пароль';
        return;
      }

      if (loginBtn.classList.contains('active')) {
        authCall('login', {email: email, password: pass})
          .then(function(res) {
            setUser(res.user);
            window.location = 'index.html';
          })
          .catch(function(err) { msg.textContent = err.message; });
        return;
      }

      if (!name) {
        msg.textContent = 'Введите имя';
        return;
      }

      authCall('register', {name: name, email: email, password: pass, role: role})
        .then(function(res) {
          setUser(res.user);
          window.location = 'index.html';
        })
        .catch(function(err) { msg.textContent = err.message; });
    };
  }
}

function initDashboard() {
  var welcome = document.getElementById('welcomeText');
  var latestList = document.getElementById('latestDocsList');
  var allTable = document.getElementById('allDocsTable');
  var user = getUser();
  
  if (!user) return;
  
loadDocs().then(function(docs) {
    if (welcome) {
      welcome.textContent = user.name + ', добро пожаловать!';
    }
    
    var latest = docs.slice(0, 3);
    var html = latest.map(function(doc) {
      return '<li><strong>' + doc.title + '</strong><br/><span class="muted">' + doc.authorName + ' · ' + formatDate(doc.createdAt) + '</span></li>';
    }).join('');
    if (!html) html = '<li>Нет документов</li>';
    if (latestList) latestList.innerHTML = html;

    if (!docs.length) {
      if (allTable) allTable.innerHTML = '<p class="note">Нет документов</p>';
      return;
    }

    var rows = docs.map(function(doc) {
      return '<tr><td>' + doc.title + '</td><td>' + doc.authorName + '</td><td>' + formatDate(doc.createdAt) + '</td><td><span class="status ' + doc.type + '">' + (doc.type === 'study' ? 'Учебный' : doc.type === 'admin' ? 'Админ' : 'Другое') + '</span></td></tr>';
    }).join('');
    if (allTable) allTable.innerHTML = '<table><thead><tr><th>Документ</th><th>Автор</th><th>Дата</th><th>Тип</th></tr></thead><tbody>' + rows + '</tbody></table>';
  });
}

function initDocsPage() {
  var search = document.getElementById('searchInput');
  var typeF = document.getElementById('typeFilter');
  var authorF = document.getElementById('authorFilter');
  var table = document.getElementById('documentsTable');

  loadDocs().then(function(docs) {
    if (authorF) {
      var authors = [];
      docs.forEach(function(d) { if (authors.indexOf(d.authorName) === -1) authors.push(d.authorName); });
      authorF.innerHTML = '<option value="all">Все авторы</option>' + authors.map(function(a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
    }

    function render() {
      if (!search || !table) return;
      var q = search.value.trim().toLowerCase();
      var type = typeF ? typeF.value : 'all';
      var author = authorF ? authorF.value : 'all';
      
      var filtered = docs.filter(function(d) {
        var txt = (d.title + ' ' + d.description + ' ' + d.authorName).toLowerCase();
        return txt.includes(q) && (type === 'all' || d.type === type) && (author === 'all' || d.authorName === author);
      });

      if (!filtered.length) {
        table.innerHTML = '<p class="note">Нет документов</p>';
        return;
      }

      table.innerHTML = '<table><thead><tr><th>Документ</th><th>Автор</th><th>Дата</th><th>Тип</th><th>Файл</th></tr></thead><tbody>' + 
        filtered.map(function(d) {
          return '<tr><td>' + d.title + '</td><td>' + d.authorName + '</td><td>' + formatDate(d.createdAt) + '</td><td><span class="status ' + d.type + '">' + (d.type === 'study' ? 'Учебный' : d.type === 'admin' ? 'Админ' : 'Другое') + '</span></td><td>' + (d.fileUrl ? '<a href="' + d.fileUrl + '" target="_blank">' + (d.originalName || d.fileName) + '</a>' : '-') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    if (search) search.oninput = render;
    if (typeF) typeF.onchange = render;
    if (authorF) authorF.onchange = render;
    render();
  });
}

function initCreate() {
  var form = document.getElementById('createForm');
  var msg = document.getElementById('createMessage');
  var user = getUser();

  if (!form || !user) return;

  form.onsubmit = function(e) {
    e.preventDefault();
    var title = document.getElementById('docTitle').value.trim();
    var desc = document.getElementById('docDescription').value.trim();
    var type = document.getElementById('docType').value;
    var file = document.getElementById('docFile');

    if (!title || !desc) {
      msg.textContent = 'Заполните все поля';
      return;
    }

    var fd = new FormData();
    fd.append('title', title);
    fd.append('description', desc);
    fd.append('type', type);
    fd.append('authorId', user.id);
    if (file && file.files.length > 0) {
      fd.append('file', file.files[0]);
    }

    newDoc(fd).then(function() {
      msg.textContent = 'Документ сохранён';
      form.reset();
    }).catch(function(err) {
      msg.textContent = err.message;
    });
  };
}

function initAdmin() {
  var usersTbl = document.getElementById('usersTable');
  var docsTbl = document.getElementById('adminDocsTable');

  loadUsers().then(function(users) {
    loadDocs().then(function(docs) {
      function renderUsers() {
        usersTbl.innerHTML = '<table><thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Действие</th></tr></thead><tbody>' +
          users.map(function(u) { return '<tr><td>' + u.name + '</td><td>' + u.email + '</td><td>' + u.role + '</td><td><button class="button danger" data-id="' + u.id + '">Удалить</button></td></tr>'; }).join('') + '</tbody></table>';
        usersTbl.querySelectorAll('button[data-id]').forEach(function(btn) {
          btn.onclick = function() {
            var id = this.getAttribute('data-id');
            delUser(id).then(function() {
              users = users.filter(function(u) { return u.id !== id; });
              renderUsers();
            }).catch(function(e) { alert(e.message); });
          };
        });
      }

      function renderDocs() {
        docsTbl.innerHTML = '<table><thead><tr><th>Название</th><th>Автор</th><th>Дата</th><th>Действие</th></tr></thead><tbody>' +
          docs.map(function(d) { return '<tr><td>' + d.title + '</td><td>' + d.authorName + '</td><td>' + formatDate(d.createdAt) + '</td><td><button class="button danger" data-id="' + d.id + '">Удалить</button></td></tr>'; }).join('') + '</tbody></table>';
        docsTbl.querySelectorAll('button[data-id]').forEach(function(btn) {
          btn.onclick = function() {
            var id = this.getAttribute('data-id');
            delDoc(id).then(function() {
              docs = docs.filter(function(d) { return d.id !== id; });
              renderDocs();
            }).catch(function(e) { alert(e.message); });
          };
        });
      }

      renderUsers();
      renderDocs();
    });
  });
}

function initProfile() {
  var nameDiv = document.getElementById('profileName');
  var emailDiv = document.getElementById('profileEmail');
  var roleDiv = document.getElementById('profileRole');
  var docsDiv = document.getElementById('myDocsTable');
  var user = getUser();

  if (!user) return;

  if (nameDiv) nameDiv.textContent = user.name;
  if (emailDiv) emailDiv.textContent = user.email;
  if (roleDiv) roleDiv.textContent = user.role;

  loadDocs().then(function(docs) {
    var myDocs = docs.filter(function(d) { return d.authorId === user.id; });
    
    if (!myDocs.length) {
      if (docsDiv) docsDiv.innerHTML = '<p class="note">Нет документов</p>';
      return;
    }

    docsDiv.innerHTML = '<table><thead><tr><th>Документ</th><th>Дата</th><th>Тип</th></tr></thead><tbody>' +
      myDocs.map(function(d) { return '<tr><td>' + d.title + '</td><td>' + formatDate(d.createdAt) + '</td><td>' + d.type + '</td></tr>'; }).join('') + '</tbody></table>';
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (!checkAuth()) return;
  setupLangToggle();
  setupLogout();
  updateMenu();

  var page = document.body.getAttribute('data-page');
  if (page === 'login') initLogin();
  else if (page === 'dashboard') initDashboard();
  else if (page === 'documents') initDocsPage();
  else if (page === 'create') initCreate();
  else if (page === 'admin') initAdmin();
  else if (page === 'profile') initProfile();
});