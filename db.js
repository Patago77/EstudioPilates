const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // ← poné tu contraseña si tenés una
  database: 'estudio_pilates',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;


