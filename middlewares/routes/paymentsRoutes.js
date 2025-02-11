const express = require('express');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const authenticateToken = require('../authMiddleware');

const router = express.Router();
const db = new sqlite3.Database('./payments.db');

// 📥 Registrar pagos con validación
router.post('/payments', authenticateToken, [
    body('fullName').notEmpty().withMessage('El nombre es obligatorio.'),
    body('subscriptionType').isInt().withMessage('El tipo de abono debe ser un número válido.'),
    body('paymentDate').isISO8601().withMessage('La fecha de pago no es válida.'),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, subscriptionType, paymentDate } = req.body;

    db.get(
        `SELECT * FROM payments WHERE fullName = ? AND paymentDate = ?`,
        [fullName, paymentDate],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error al verificar pagos existentes.' });
            }
            if (row) {
                return res.status(409).json({ error: 'El pago ya fue registrado previamente.' });
            }

            const sql = `INSERT INTO payments (fullName, subscriptionType, paymentDate) VALUES (?, ?, ?)`;
            db.run(sql, [fullName, subscriptionType, paymentDate], function (err) {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error al registrar el pago.' });
                }
                res.status(201).json({ id: this.lastID, message: 'Pago registrado exitosamente.' });
            });
        }
    );
});

// 📊 Obtener pagos por cliente
router.get('/payments/client/:searchQuery', authenticateToken, (req, res) => {
    const searchQuery = req.params.searchQuery;
    console.log(`🔍 Buscando pagos para: ${searchQuery}`);
    const sql = `SELECT rowid as id, fullName, subscriptionType, paymentDate FROM payments WHERE fullName LIKE ?`;
    
    db.all(sql, [`%${searchQuery}%`], (err, rows) => {
        if (err) {
            console.error('Error al buscar pagos:', err);
            return res.status(500).json({ error: 'Error al buscar pagos' });
        }
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron pagos para este cliente' });
        }
        res.json(rows);
    });
});



// 📊 Obtener todos los pagos con búsqueda opcional
router.get('/payments', authenticateToken, (req, res) => {
    const searchQuery = req.query.search || '';
    const searchPattern = `%${searchQuery}%`;

    const sql = `
        SELECT rowid as id, fullName, subscriptionType, paymentDate
        FROM payments
        WHERE fullName LIKE ? OR paymentDate LIKE ? OR CAST(subscriptionType AS TEXT) LIKE ?
    `;

    db.all(sql, [searchPattern, searchPattern, searchPattern], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al obtener los pagos.' });
        }
        res.json(rows);
    });
});




// 📊 Obtener el total de ingresos
router.get('/payments/total', authenticateToken, (req, res) => {
    db.get('SELECT SUM(subscriptionType) as totalIncome FROM payments', [], (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al calcular ingresos.' });
        }
        res.json({ totalIncome: row.totalIncome || 0 });
    });
});

// 🗑️ Eliminar pago
router.delete('/payments/:paymentId', authenticateToken, (req, res) => {
    const paymentId = req.params.paymentId;

    db.run('DELETE FROM payments WHERE rowid = ?', [paymentId], function (err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error al eliminar el pago.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Pago no encontrado.' });
        }
        res.json({ message: 'Pago eliminado correctamente.' });
    });
});

module.exports = router;
