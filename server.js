const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator'); // ✅ Importación correcta
const paymentsRouter = require('./routes/payments');

dotenv.config(); // Cargar variables de entorno

const app = express();
const port = process.env.PORT || 3000;

// ✅ Verificación de SECRET_KEY
if (!process.env.SECRET_KEY) {
    console.error("❌ ERROR: SECRET_KEY no está definida en .env");
    process.exit(1);
}
const SECRET_KEY = process.env.SECRET_KEY;
console.log("🔑 Clave secreta cargada:", SECRET_KEY);

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Base de Datos SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('🚨 Error al conectar con la base de datos:', err.message);
    } else {
        console.log('🗄️ Conectado a la base de datos SQLite: database.sqlite');
    }
});

// ✅ Verificar si la tabla `payments` existe
db.run(`
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        subscriptionType INTEGER NOT NULL,
        paymentDate TEXT NOT NULL,
        amount INTEGER DEFAULT 0,
        extraNotes TEXT
    )
`, (err) => {
    if (err) {
        console.error("🚨 Error al crear/verificar la tabla `payments`:", err.message);
    } else {
        console.log("✅ Tabla `payments` verificada correctamente.");
    }
});

// ✅ Middleware para autenticar el token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado o formato incorrecto' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
}

// ✅ Ruta para iniciar sesión
app.post('/api/login',
    [
        body('username').trim().notEmpty().withMessage('El usuario es obligatorio.'),
        body('password').notEmpty().withMessage('La contraseña es obligatoria.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Usuario y contraseña requeridos" });
        }

        try {
            const user = await new Promise((resolve, reject) => {
                db.get('SELECT id, username, password FROM users WHERE username = ?', [username], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
            res.json({ token });
        } catch (error) {
            res.status(500).json({ error: "Error interno del servidor" });
        }
    }
);

app.post('/api/payments',
    authenticateToken,
    [
        body('fullName').trim().notEmpty().withMessage('El nombre es obligatorio.'),
        body('subscriptionType').isInt().withMessage('El tipo de suscripción debe ser un número.'),
        body('paymentDate').isISO8601().withMessage('Fecha inválida.'),
        body('amount').isFloat({ gt: 0 }).withMessage('El monto debe ser mayor a 0.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error("❌ Error de validación:", errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { fullName, subscriptionType, paymentDate, amount } = req.body;

        // ✅ Asegurar que el monto no sea null ni undefined
        if (!fullName || !subscriptionType || !paymentDate || amount === undefined || isNaN(amount) || amount <= 0) {
            console.error("🚨 Error: Falta información en la solicitud:", req.body);
            return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser un número válido." });
        }

        console.log("📤 Guardando pago en la base de datos:", { fullName, subscriptionType, paymentDate, amount });

        db.run(
            `INSERT INTO payments (fullName, subscriptionType, paymentDate, amount) VALUES (?, ?, ?, ?)`,
            [fullName, subscriptionType, paymentDate, amount],
            function (err) {
                if (err) {
                    console.error("❌ Error al guardar pago en la base de datos:", err.message);
                    return res.status(500).json({ error: "Error al registrar el pago." });
                }
                console.log("✅ Pago registrado correctamente.");
                res.status(201).json({ id: this.lastID, fullName, amount, paymentDate });
            }
        );
    }
);


// ✅ Ruta para obtener información del Dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 7);
    const upcomingDateString = upcomingDate.toISOString().split('T')[0];

    console.log("🔍 Consultando datos del Dashboard...");

    // 🔹 Consultas SQL
    const queryTotalIncome = `SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM payments`;
    const queryTotalPayments = `SELECT COUNT(*) AS totalPayments FROM payments`;
    const queryPaymentsPerMonth = `
    SELECT strftime('%Y-%m', paymentDate) AS month, SUM(amount) AS totalIncome
    FROM payments
    GROUP BY month
    ORDER BY month DESC
`;

        
    const queryOverduePayments = `SELECT DISTINCT fullName FROM payments WHERE paymentDate < ? ORDER BY paymentDate DESC LIMIT 100`;
    const queryUpcomingPayments = `SELECT DISTINCT fullName FROM payments WHERE paymentDate BETWEEN ? AND ? ORDER BY paymentDate ASC LIMIT 100`;

    // 🔹 Obtener total de ingresos
    db.get(queryTotalIncome, [], (err, totalIncomeRow) => {
        if (err) {
            console.error("🚨 Error al obtener ingresos totales:", err.message);
            return res.status(500).json({ error: "Error al obtener ingresos totales." });
        }
        const totalIncome = Number(totalIncomeRow?.totalIncome) || 0;

        // 🔹 Obtener total de pagos
        db.get(queryTotalPayments, [], (err, totalPaymentsRow) => {
            if (err) {
                console.error("🚨 Error al obtener total de pagos:", err.message);
                return res.status(500).json({ error: "Error al obtener total de pagos." });
            }
            const totalPayments = totalPaymentsRow?.totalPayments || 0;

            // 🔹 Obtener pagos por mes
            db.all(queryPaymentsPerMonth, [], (err, paymentsPerMonth) => {
                if (err) {
                    console.error("🚨 Error al obtener pagos por mes:", err.message);
                    return res.status(500).json({ error: "Error al obtener pagos por mes." });
                }

                // 🔹 Obtener pagos vencidos
                db.all(queryOverduePayments, [today], (err, overduePaymentsRows) => {
                    if (err) {
                        console.error("🚨 Error al obtener pagos vencidos:", err.message);
                        return res.status(500).json({ error: "Error al obtener pagos vencidos." });
                    }
                    const overduePayments = overduePaymentsRows.map(row => row.fullName) ?? [];

                    // 🔹 Obtener pagos próximos
                    db.all(queryUpcomingPayments, [today, upcomingDateString], (err, upcomingPaymentsRows) => {
                        if (err) {
                            console.error("🚨 Error al obtener pagos próximos a vencer:", err.message);
                            return res.status(500).json({ error: "Error al obtener pagos próximos a vencer." });
                        }
                        const upcomingPayments = upcomingPaymentsRows.map(row => row.fullName) ?? [];

                        // ✅ Enviar respuesta al frontend
                        res.json({ 
                            totalIncome, 
                            totalPayments, 
                            paymentsPerMonth, 
                            overduePayments, 
                            upcomingPayments 
                        });
                    });
                });
            });
        });
    });
});


// ✅ Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ message: "✅ El servidor responde correctamente." });
});

// ✅ Usar `paymentsRouter`
app.use('/api', paymentsRouter);

// ✅ Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
