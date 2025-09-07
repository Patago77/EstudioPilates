const express = require('express');
const authenticateToken = require('../authMiddleware');
const db = require('../db');

const router = express.Router();

// 📥 Registrar un pago con validación y monto incluido
router.post('/payments', authenticateToken, async (req, res) => {
  const { fullName, subscriptionType, paymentDate, amount } = req.body;

  if (!fullName || !subscriptionType || !paymentDate || isNaN(amount)) {
    return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser válido." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO payments (fullName, subscriptionType, paymentDate, amount) VALUES (?, ?, ?, ?)`,
      [fullName, subscriptionType, paymentDate, amount]
    );
    res.json({ id: result.insertId, fullName, subscriptionType, paymentDate, amount });
  } catch (err) {
    console.error("❌ Error al guardar pago:", err.message);
    res.status(500).json({ error: "Error al guardar el pago." });
  }
});

// ✏️ Editar un pago existente por ID
router.put('/payments/:id', authenticateToken, async (req, res) => {
  const paymentId = req.params.id;
  const { fullName, subscriptionType, paymentDate, amount } = req.body;

  if (!fullName || !subscriptionType || !paymentDate || isNaN(amount)) {
    return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser válido." });
  }

  try {
    const [result] = await db.query(
      `UPDATE payments SET fullName = ?, subscriptionType = ?, paymentDate = ?, amount = ? WHERE id = ?`,
      [fullName, subscriptionType, paymentDate, amount, paymentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pago no encontrado." });
    }

    res.json({ message: "Pago actualizado correctamente" });
  } catch (err) {
    console.error("❌ Error al editar pago:", err.message);
    res.status(500).json({ error: "Error al editar el pago." });
  }
});


// Obtener todos los pagos
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM payments ORDER BY paymentDate DESC");
    res.json({ payments: rows });
  } catch (err) {
    console.error("❌ Error al obtener pagos:", err.message);
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});



// 📊 Obtener pagos por cliente
router.get('/payments/client/:searchQuery', authenticateToken, async (req, res) => {
  const searchQuery = req.params.searchQuery.trim();

  if (!searchQuery) {
    return res.status(400).json({ error: "El parámetro de búsqueda no puede estar vacío." });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, fullName, subscriptionType, paymentDate, amount FROM payments WHERE fullName LIKE ?`,
      [`%${searchQuery}%`]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error al buscar pagos:", err.message);
    res.status(500).json({ error: "Error al buscar pagos." });
  }
});

// 🗑️ Eliminar un pago por ID
router.delete('/payments/:id', authenticateToken, async (req, res) => {
  const paymentId = req.params.id;

  try {
    const [result] = await db.query('DELETE FROM payments WHERE id = ?', [paymentId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.json({ message: 'Pago eliminado correctamente' });
  } catch (err) {
    console.error("❌ Error al eliminar pago:", err.message);
    res.status(500).json({ error: 'Error al eliminar el pago.' });
  }
});
// 📄 Obtener un pago por ID
router.get('/payments/:id', authenticateToken, async (req, res) => {
  const paymentId = req.params.id;

  try {
    const [rows] = await db.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Pago no encontrado." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error al obtener pago por ID:", err.message);
    res.status(500).json({ error: "Error al obtener el pago." });
  }
});
// 🔄 Busca por documento **O** por nombre
router.get('/payments/buscar/:query', authenticateToken, async (req, res) => {
  const query = req.params.query.trim();
  try {
    const [rows] = await db.query(
      `SELECT * FROM payments
       WHERE documento = ? OR fullName LIKE ?
       ORDER BY paymentDate DESC`,
      [query, `%${query}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al buscar pagos:", err.message);
    res.status(500).json({ error: "Error al buscar pagos" });
  }
});





// 📈 Alumnos activos por mes
router.get('/alumnos/mensuales', authenticateToken, async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT DATE_FORMAT(paymentDate, '%Y-%m') AS mes, COUNT(DISTINCT fullName) AS cantidad
      FROM payments
      GROUP BY mes
      ORDER BY mes
    `);
    res.json(results);
  } catch (err) {
    console.error("❌ Error al obtener alumnos por mes:", err.message);
    res.status(500).json({ error: "Error al obtener alumnos por mes." });
  }
});
router.get('/gastos/mensuales', authenticateToken, async (req, res) => {
  try {
    const [result] = await db.query(`
      SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
      FROM gastos
      GROUP BY mes
      ORDER BY mes DESC
    `);
    res.json(result);
  } catch (error) {
    console.error("❌ Error obteniendo los gastos mensuales:", error.message);
    res.status(500).json({ error: "Error al obtener los datos" });
  }
});
// Ruta que devuelve los detalles de gastos del mes
router.get('/gastos/detalle/:mes', authenticateToken, async (req, res) => {

  const { mes } = req.params;
  try {
    const [result] = await db.query(`
      SELECT id, fecha, categoria, descripcion, monto
      FROM gastos
      WHERE DATE_FORMAT(fecha, '%Y-%m') = ?
      ORDER BY fecha ASC
    `, [mes]);

    res.json(result);
  } catch (error) {
    console.error("Error al obtener detalles de gastos:", error);
    res.status(500).json({ error: "Error al obtener los detalles del gasto" });
  }
});




// 💳 Ingresos por tipo de abono
router.get('/estadisticas/abonos', authenticateToken, async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT subscriptionType AS tipo_abono, SUM(amount) AS total
      FROM payments
      GROUP BY subscriptionType
    `);
    res.json(results);
  } catch (err) {
    console.error("❌ Error al obtener ingresos por abono:", err.message);
    res.status(500).json({ error: "Error al obtener ingresos por abono." });
  }
});

module.exports = router;
