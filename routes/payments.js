const express = require('express');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const authenticateToken = require('../authMiddleware');

const router = express.Router();
const db = new sqlite3.Database('./payments.db');

// 📥 Registrar un pago con validación
router.post('/payments', authenticateToken, (req, res) => {
    const { fullName, subscriptionType, paymentDate } = req.body;

    if (!fullName || !subscriptionType || !paymentDate) {
        console.log("❌ Faltan datos en la solicitud:", req.body);
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    console.log("📥 Recibiendo nuevo pago:", req.body);

    const sql = `INSERT INTO payments (fullName, subscriptionType, paymentDate) VALUES (?, ?, ?)`;
    const params = [fullName, subscriptionType, paymentDate];

    db.run(sql, params, function (err) {
        if (err) {
            console.error("❌ Error al guardar pago en la base de datos:", err.message);
            return res.status(500).json({ error: "Error al guardar pago." });
        }
        console.log("✅ Pago guardado en la base de datos con ID:", this.lastID);
        res.json({ id: this.lastID, fullName, subscriptionType, paymentDate });
    });
});


// 📊 Obtener todos los pagos
router.get('/payments', authenticateToken, (req, res) => {
    console.log("📌 Llegó una solicitud a /api/payments con el usuario:", req.user);

    const searchQuery = req.query.search || '';
    const searchPattern = `%${searchQuery}%`;

    console.log("🔎 Buscando pagos con el patrón:", searchPattern);

    const sql = `
        SELECT rowid as id, fullName, subscriptionType, paymentDate
        FROM payments
        WHERE fullName LIKE ? OR paymentDate LIKE ? OR CAST(subscriptionType AS TEXT) LIKE ?
    `;

    db.all(sql, [searchPattern, searchPattern, searchPattern], (err, rows) => {
        if (err) {
            console.error("❌ Error en la consulta a la base de datos:", err.message);
            return res.status(500).json({ error: 'Error al obtener los pagos.' });
        }
        console.log("✅ Datos obtenidos correctamente:", rows.length, "registros.");
        res.json(rows);
    });
});


// 📊 Obtener pagos por cliente
router.get('/payments/client/:searchQuery', authenticateToken, (req, res) => {
    const searchQuery = req.params.searchQuery.trim();
    
    if (!searchQuery) {
        return res.status(400).json({ error: 'El parámetro de búsqueda no puede estar vacío.' });
    }

    const sql = `SELECT rowid as id, fullName, subscriptionType, paymentDate FROM payments WHERE fullName LIKE ?`;

    db.all(sql, [`%${searchQuery}%`], (err, rows) => {
        if (err) {
            console.error('🚨 Error al buscar pagos:', err.message);
            return res.status(500).json({ error: 'Error al buscar pagos.' });
        }
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron pagos para este cliente.' });
        }
        res.json(rows);
    });
});

// 📌 Exportar las rutas
module.exports = router;
