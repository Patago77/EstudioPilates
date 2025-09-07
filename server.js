const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

const { body, validationResult } = require('express-validator');

// Importación de rutas
const paymentsRouter = require('./routes/payments'); // Mantenido
const gastosRouter = require('./routes/gastos');     // Mantenido
const studentsRouter = require('./routes/students');


const db = require('./db'); // Conexión a la base de datos

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.SECRET_KEY) {
  console.error("❌ ERROR: SECRET_KEY no está definida en .env");
  process.exit(1);
}
const SECRET_KEY = process.env.SECRET_KEY;
console.log("🔑 Clave secreta cargada:", SECRET_KEY);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/api', paymentsRouter);
app.use('/api', gastosRouter);
app.use('/api', studentsRouter);   // <--- ¡AHORA SÍ!



// Middleware de autenticación JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
}

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: "✅ El servidor responde correctamente." });
});

// Ruta de login
app.post('/api/login',
  [
    body('email').trim().notEmpty().withMessage('El email es obligatorio.'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const [rows] = await db.query('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
      const user = rows[0];

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
      res.json({ token });
    } catch (error) {
      console.error("❌ Error en el login:", error.message);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

// Ruta del Dashboard (ingresos y pagos vencidos)
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const upcomingDate = new Date();
  upcomingDate.setDate(upcomingDate.getDate() + 7);
  const upcomingDateStr = upcomingDate.toISOString().split('T')[0];

  try {
    const [[totalIncomeRow]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM payments');
    const [[totalPaymentsRow]] = await db.query('SELECT COUNT(*) AS totalPayments FROM payments');
    const [paymentsPerMonth] = await db.query(`
      SELECT DATE_FORMAT(paymentDate, '%Y-%m') AS month, SUM(amount) AS totalIncome
      FROM payments
      GROUP BY month
      ORDER BY month DESC
    `);

    const [overduePaymentsRows] = await db.query(
      'SELECT DISTINCT fullName FROM payments WHERE paymentDate < ? ORDER BY paymentDate DESC LIMIT 100',
      [today]
    );

    const [upcomingPaymentsRows] = await db.query(
      'SELECT DISTINCT fullName FROM payments WHERE paymentDate BETWEEN ? AND ? ORDER BY paymentDate ASC LIMIT 100',
      [today, upcomingDateStr]
    );

    res.json({
      totalIncome: Number(totalIncomeRow.totalIncome) || 0,
      totalPayments: totalPaymentsRow.totalPayments || 0,
      paymentsPerMonth,
      overduePayments: overduePaymentsRows.map(r => r.fullName),
      upcomingPayments: upcomingPaymentsRows.map(r => r.fullName)
    });
  } catch (err) {
    console.error("❌ Error en el dashboard:", err.message);
    res.status(500).json({ error: "Error en el dashboard" });
  }
});

// 👩‍🎓 Obtener todos los alumnos (students)
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM students ORDER BY nombre ASC');
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al obtener alumnos:", err.message);
    res.status(500).json({ error: "Error al obtener alumnos" });
  }
});



// Inicio del servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});

app.get('/api/gastos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM gastos WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Gasto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener el gasto" });
  }
});



app.put('/api/gastos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { fecha, categoria, descripcion, monto } = req.body;

  if (!fecha || !categoria || !descripcion || isNaN(monto)) {
    return res.status(400).json({ error: "Datos inválidos" });
  }

  try {
    await db.query(
      'UPDATE gastos SET fecha = ?, categoria = ?, descripcion = ?, monto = ? WHERE id = ?',
      [fecha, categoria, descripcion, monto, id]
    );
    res.json({ message: "Gasto actualizado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el gasto" });
  }
});



app.delete('/api/gastos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM gastos WHERE id = ?', [id]);
    res.json({ message: "Gasto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar el gasto" });
  }
});
