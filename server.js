const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    file_name TEXT,
    original_name TEXT,
    author_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(author_id) REFERENCES users(id)
  )`);

  db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const now = new Date().toISOString();
      const seed = [
        ['u-admin', 'Администратор', 'admin@vatk.kz', 'admin123', 'admin', now],
        ['u-teacher', 'Aida Bek', 'teacher@vatk.kz', 'teacher123', 'teacher', now],
        ['u-student', 'Nursultan S.', 'student@vatk.kz', 'student123', 'student', now],
        ['u-secretary', 'Секретарь', 'secretary@vatk.kz', 'secretary123', 'secretary', now]
      ];
      const stmt = db.prepare('INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      seed.forEach((item) => stmt.run(item));
      stmt.finalize();
    }
  });

  db.get('SELECT COUNT(*) AS count FROM documents', (err, row) => {
    if (err) return console.error(err);
    if (row.count === 0) {
      const now = new Date().toISOString().slice(0, 10);
      const docs = [
        ['d-1', 'Техникалық хат', 'Құрылыс оқуы бойынша есеп', 'admin', null, null, 'u-admin', now],
        ['d-2', 'Практика отчеты', 'Учебный отчет по практике', 'study', null, null, 'u-teacher', now]
      ];
      const stmt = db.prepare('INSERT INTO documents (id, title, description, type, file_name, original_name, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      docs.forEach((item) => stmt.run(item));
      stmt.finalize();
    }
  });
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname)));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  }
});

// валидация email
function validateEmail(email) {
  var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  return re.test(email)
}
const upload = multer({ storage });

function serializeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email и пароль обязательны' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Введите корректный email' });
  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email.toLowerCase(), password], (err, row) => {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!row) return res.status(401).json({ message: 'Неверный email или пароль' });
    res.json({ user: serializeUser(row) });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: 'Все поля обязательны' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Введите корректный email' });
  if (!['student', 'teacher', 'secretary'].includes(role)) return res.status(400).json({ message: 'Недопустимая роль' });

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, exists) => {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    if (exists) return res.status(409).json({ message: 'Пользователь уже существует' });

    const id = `u-${Date.now()}`;
    const createdAt = new Date().toISOString();
    db.run('INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email.toLowerCase(), password, role, createdAt], (error) => {
      if (error) return res.status(500).json({ message: 'Ошибка при создании пользователя' });
      res.status(201).json({ user: { id, name, email: email.toLowerCase(), role, createdAt } });
    });
  });
});

app.get('/api/users', (req, res) => {
  db.all('SELECT id, name, email, role, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    res.json({ users: rows.map(serializeUser) });
  });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ? AND role != ?', [id, 'admin'], function(err) {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    if (this.changes === 0) return res.status(404).json({ message: 'Пользователь не найден или админ защищен' });
    res.json({ success: true });
  });
});

app.get('/api/documents', (req, res) => {
  db.all(`SELECT d.id, d.title, d.description, d.type, d.file_name AS fileName, d.original_name AS originalName, d.author_id AS authorId, u.name AS authorName, d.created_at AS createdAt
    FROM documents d
    LEFT JOIN users u ON u.id = d.author_id
    ORDER BY d.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    const docs = rows.map((doc) => ({
      ...doc,
      fileUrl: doc.fileName ? `/uploads/${doc.fileName}` : null
    }));
    res.json({ documents: docs });
  });
});

app.post('/api/documents', upload.single('file'), (req, res) => {
  const { title, description, type, authorId } = req.body;
  if (!title || !description || !type || !authorId) return res.status(400).json({ message: 'Все поля обязательны' });

  const id = `d-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const fileName = req.file ? req.file.filename : null;
  const originalName = req.file ? req.file.originalname : null;

  db.run('INSERT INTO documents (id, title, description, type, file_name, original_name, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title, description, type, fileName, originalName, authorId, createdAt], function(err) {
      if (err) return res.status(500).json({ message: 'Ошибка при сохранении документа' });
      res.status(201).json({ document: { id, title, description, type, fileName, originalName, authorId, createdAt, fileUrl: fileName ? `/uploads/${fileName}` : null } });
    });
});

app.delete('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT file_name FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ message: 'Ошибка сервера' });
    if (!row) return res.status(404).json({ message: 'Документ не найден' });
    if (row.file_name) {
      const filePath = path.join(UPLOAD_DIR, row.file_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run('DELETE FROM documents WHERE id = ?', [id], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ message: 'Ошибка при удалении документа' });
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
