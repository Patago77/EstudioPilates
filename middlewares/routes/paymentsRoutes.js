const express = require('express');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const authenticateToken = require('../authMiddleware'); // Middleware de autenticación

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

// 📊 Datos del Dashboard Informativo
router.get('/dashboard', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // Fecha de hoy en formato ISO
    const nextWeek = new Date();
    nextWeek.setDate(new Date().getDate() + 7); // Fecha dentro de 7 días

    const sql = `
        SELECT
            (SELECT SUM(subscriptionType) FROM payments) AS totalIncome,
            (SELECT COUNT(*) FROM payments WHERE paymentDate < ?) AS overduePayments,
            (SELECT COUNT(*) FROM payments WHERE paymentDate BETWEEN ? AND ?) AS upcomingPayments,
            (SELECT json_group_array(json_object('id', rowid, 'fullName', fullName, 'paymentDate', paymentDate))
             FROM payments WHERE paymentDate < ?) AS overdueList,
            (SELECT json_group_array(json_object('id', rowid, 'fullName', fullName, 'paymentDate', paymentDate))
             FROM payments WHERE paymentDate BETWEEN ? AND ?) AS upcomingList
    `;

    db.get(sql, [today, today, nextWeek.toISOString().split('T')[0], today, today, nextWeek.toISOString().split('T')[0]], (err, row) => {
        if (err) {
            console.error('Error al obtener datos del dashboard:', err);
            return res.status(500).json({ error: 'Error al obtener datos del dashboard.' });
        }

        res.json({
            totalIncome: row.totalIncome || 0,
            overduePayments: row.overduePayments || 0,
            upcomingPayments: row.upcomingPayments || 0,
            overdueList: JSON.parse(row.overdueList || '[]'),
            upcomingList: JSON.parse(row.upcomingList || '[]'),
        });
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
