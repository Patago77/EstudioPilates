// routes/students.js
const express = require('express');
const authenticateToken = require('../authMiddleware');
const db = require('../db');
const router = express.Router();

// 👉 Registrar un nuevo alumno
router.post('/students', authenticateToken, async (req, res) => {
  const { nombre, documento, email, telefono } = req.body;
  if (!nombre || !documento) {
    return res.status(400).json({ error: "Nombre y documento son obligatorios." });
  }
  // Control duplicados
  const [existe] = await db.query('SELECT id FROM students WHERE documento = ?', [documento]);
  if (existe.length > 0) {
    return res.status(400).json({ error: "Ya existe un alumno con ese documento." });
  }
  const [result] = await db.query(
    'INSERT INTO students (nombre, documento, email, telefono) VALUES (?, ?, ?, ?)',
    [nombre, documento, email, telefono]
  );
  res.json({ id: result.insertId, nombre, documento, email, telefono });
});

// 👉 Traer todos los alumnos
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM students ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener alumnos" });
  }
});

module.exports = router;
