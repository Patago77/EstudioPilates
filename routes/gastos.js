const express = require('express');
const router = express.Router();
const authenticateToken = require('../authMiddleware');
const db = require('../db');

router.get('/gastos/detalle/:mes', authenticateToken, async (req, res) => {

  const { mes } = req.params; // formato '2025-05'
  try {
    const [rows] = await db.query(`
      SELECT fecha, categoria, descripcion, monto
      FROM gastos
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      ORDER BY fecha DESC
    `, [mes]);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al obtener detalle de gastos:", err.message);
    res.status(500).json({ error: "Error al obtener detalle de gastos" });
  }
});


// ✅ Total de gastos del mes actual
router.get('/gastos/mensuales/total', authenticateToken, async (req, res) => {
  try {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS totalGastos FROM gastos WHERE fecha BETWEEN ? AND ?`,
      [primerDiaMes, ultimoDiaMes]
    );

    res.json({ totalGastos: row.totalGastos });
  } catch (err) {
    console.error("❌ Error al obtener total mensual:", err.message);
    res.status(500).json({ error: "Error al calcular gastos del mes." });
  }
});

// ✅ Gastos agrupados por categoría del mes actual
router.get('/gastos/mensuales', authenticateToken, async (req, res) => {
  try {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [rows] = await db.query(
      `SELECT categoria, SUM(monto) AS total FROM gastos WHERE fecha BETWEEN ? AND ? GROUP BY categoria`,
      [primerDiaMes, ultimoDiaMes]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error al obtener gastos mensuales:", err.message);
    res.status(500).json({ error: "Error al obtener estadísticas de gastos." });
  }
});

// ✅ Total de ingresos y egresos y saldo del mes actual (consolidado)
router.get('/resumen/mensual', authenticateToken, async (req, res) => {
  try {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

    const [[{ totalIngresos }]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS totalIngresos FROM payments WHERE paymentDate BETWEEN ? AND ?`,
      [primerDiaMes, ultimoDiaMes]
    );

    const [[{ totalGastos }]] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS totalGastos FROM gastos WHERE fecha BETWEEN ? AND ?`,
      [primerDiaMes, ultimoDiaMes]
    );

    const saldo = totalIngresos - totalGastos;

    res.json({
      totalIngresos,
      totalGastos,
      saldo
    });
  } catch (err) {
    console.error("❌ Error al obtener resumen mensual:", err.message);
    res.status(500).json({ error: "Error al calcular resumen mensual." });
  }
});

// Obtener todos los gastos
router.get('/gastos', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, categoria, descripcion, monto, fecha FROM gastos ORDER BY fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al obtener los gastos:", err.message);
    res.status(500).json({ error: "Error al obtener los gastos." });
  }
});

// Registrar un nuevo gasto
router.post('/gastos', authenticateToken, async (req, res) => {
  const { categoria, descripcion, monto, fecha } = req.body;

  if (!categoria || !descripcion || !fecha || isNaN(monto)) {
    return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser válido." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO gastos (categoria, descripcion, monto, fecha) VALUES (?, ?, ?, ?)`,
      [categoria, descripcion, monto, fecha]
    );
    res.json({ id: result.insertId, categoria, descripcion, monto, fecha });
  } catch (err) {
    console.error("❌ Error al guardar gasto:", err.message);
    res.status(500).json({ error: "Error al guardar el gasto." });
  }
});

// Editar un gasto
router.put('/gastos/:id', authenticateToken, async (req, res) => {
  const gastoId = req.params.id;
  const { categoria, descripcion, monto, fecha } = req.body;

  if (!categoria || !descripcion || !fecha || isNaN(monto)) {
    return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser válido." });
  }

  try {
    const [result] = await db.query(
      `UPDATE gastos SET categoria = ?, descripcion = ?, monto = ?, fecha = ? WHERE id = ?`,
      [categoria, descripcion, monto, fecha, gastoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Gasto no encontrado." });
    }

    res.json({ message: "Gasto actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al actualizar gasto:", err.message);
    res.status(500).json({ error: "Error al actualizar el gasto." });
  }
});

// Eliminar un gasto
router.delete('/gastos/:id', authenticateToken, async (req, res) => {
  const gastoId = req.params.id;

  try {
    const [result] = await db.query(
      `DELETE FROM gastos WHERE id = ?`, [gastoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Gasto no encontrado." });
    }

    res.json({ message: "Gasto eliminado correctamente" });
  } catch (err) {
    console.error("❌ Error al eliminar gasto:", err.message);
    res.status(500).json({ error: "Error al eliminar el gasto." });
  }
});

module.exports = router;
