const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const paymentsRouter = require('./routes/payments');

const app = express();
const port = process.env.PORT || 3000;

// Cargar variables de entorno
require('dotenv').config();
console.log("🔑 Clave secreta cargada:", process.env.SECRET_KEY);

// Definir la clave secreta correctamente
const SECRET_KEY = process.env.SECRET_KEY || 'secreto_super_seguro';

// ✅ Configuración de CORS
const corsOptions = {
    origin: ['http://127.0.0.1:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// ✅ Base de Datos SQLite


const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('🚨 Error al conectar con la base de datos:', err.message);
    } else {
        console.log('🗄️ Conectado a la base de datos SQLite: database.sqlite');
    }
});

// Verificar si la tabla `payments` existe
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
        
        // Verificar si la columna `amount` existe en `payments`
        db.all(`PRAGMA table_info(payments)`, (err, rows) => {
            if (err) {
                console.error("🚨 Error al verificar la estructura de `payments`:", err.message);
                return;
            }

            if (!rows.some(row => row.name === 'amount')) {
                console.log("⚠️ La columna `amount` no existe, agregándola...");
                db.run(`ALTER TABLE payments ADD COLUMN amount INTEGER DEFAULT 0`, (err) => {
                    if (err) {
                        console.error("🚨 Error al agregar la columna `amount`:", err.message);
                    } else {
                        console.log("✅ Columna `amount` agregada correctamente.");
                    }
                });
            } else {
                console.log("✅ La columna `amount` ya existe.");
            }
        });
    }
});

module.exports = db;


// ✅ Middleware para autenticar el token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log("🛠️ Token recibido en el backend:", authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("❌ Token no enviado o formato incorrecto.");
        return res.status(401).json({ error: 'Token no proporcionado o formato incorrecto' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.log("❌ Token inválido:", err.message);
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        console.log("✅ Token válido. Usuario autenticado:", user);
        req.user = user;
        next();
    });
}


// ✅ Ruta de inicio de sesión
app.post('/api/login', async (req, res) => {
    console.log("📥 Solicitud de login recibida en backend:", req.body);

    const { username, password } = req.body;

    if (!username || !password) {
        console.log("❌ Usuario o contraseña no proporcionados");
        return res.status(400).json({ error: "Usuario y contraseña requeridos" });
    }

    try {
        console.log("🔍 Buscando usuario en la base de datos...");
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, username, password FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    console.error("❌ Error al consultar la base de datos:", err.message);
                    reject(err);
                } else {
                    console.log("✅ Usuario encontrado en BD:", row); // Verificar qué devuelve
                    resolve(row);
                }
            });
        });

        if (!user) {
            console.log("❌ Usuario no encontrado:", username);
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        console.log("🔑 Datos recuperados del usuario:", user);
        console.log("🔑 Contraseña almacenada en BD:", `"${user.password}"`);

        if (!user.password) {
            console.log("❌ ERROR: La contraseña del usuario es undefined.");
            return res.status(500).json({ error: "Error en la autenticación. Contacta al administrador." });
        }

        // 🔍 Depuración detallada de los valores antes de comparar
        console.log("🛠️ Tipo de dato de password ingresada:", typeof password);
        console.log("🛠️ Tipo de dato de password almacenada:", typeof user.password);
        console.log("🔎 Comparando:", `"${password}"`, "vs", `"${user.password}"`);

        // 🔥 Asegurar que ambas contraseñas son string y eliminar espacios extra
        const passwordMatch = await bcrypt.compare(password.toString().trim(), user.password.toString().trim());
        console.log("🔄 Resultado de bcrypt.compare():", passwordMatch);

        if (!passwordMatch) {
            console.log("❌ Contraseña incorrecta para:", username);
            return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }

        // 🔐 Generar el token de autenticación
        const token = jwt.sign(
            { id: user.id, username: user.username },
            SECRET_KEY, 
            { expiresIn: '7d' } // Expiración de 7 días
        );

        console.log("✅ Login exitoso, token generado:", token);
        res.json({ token });

    } catch (error) {
        console.error("⚠️ Error interno en login:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
    try {
        const { fullName, subscriptionType, paymentDate, amount } = req.body;

        if (!fullName || !subscriptionType || !paymentDate || isNaN(amount)) {
            return res.status(400).json({ error: "Todos los campos son obligatorios y el monto debe ser un número." });
        }

        await db.run(
            `INSERT INTO payments (fullName, subscriptionType, paymentDate) VALUES (?, ?, ?)`,
            [fullName, amount, paymentDate],
            function (err) {
                if (err) {
                    console.error("🚨 Error al registrar el pago:", err.message);
                    return res.status(500).json({ error: "Error al registrar el pago." });
                }
                console.log("✅ Pago registrado con éxito. ID:", this.lastID);
                res.status(201).json({ id: this.lastID, fullName, amount, paymentDate });
            }
        );

    } catch (error) {
        console.error("🚨 Error en el servidor:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});


// 📌 Correcciones en server.js
app.get('/api/payments', authenticateToken, (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    console.log("🔍 Consultando datos de pagos...");

    const queryTotalIncome = `SELECT SUM(amount) AS totalIncome FROM payments`;
    const queryTotalPayments = `SELECT COUNT(*) AS totalPayments FROM payments`;
    const queryOverduePayments = `SELECT COUNT(*) AS overduePayments FROM payments WHERE DATE(paymentDate) < DATE(?)`;
    const queryUpcomingPayments = `SELECT COUNT(*) AS upcomingPayments FROM payments WHERE DATE(paymentDate) BETWEEN DATE(?) AND DATE('now', '+7 days')`;

    db.all(queryTotalIncome, [], (err, incomeResult) => {
        if (err) {
            console.error("🚨 Error al calcular totalIncome:", err.message);
            return res.status(500).json({ error: "Error al obtener total de ingresos." });
        }
        console.log("✅ Total de ingresos:", incomeResult);

        db.all(queryTotalPayments, [], (err, paymentsResult) => {
            if (err) {
                console.error("🚨 Error al contar totalPayments:", err.message);
                return res.status(500).json({ error: "Error al obtener total de pagos." });
            }
            console.log("✅ Total de pagos:", paymentsResult);

            db.all(queryOverduePayments, [today], (err, overdueResult) => {
                if (err) {
                    console.error("🚨 Error al contar pagos vencidos:", err.message);
                    return res.status(500).json({ error: "Error al obtener pagos vencidos." });
                }
                console.log("✅ Pagos vencidos:", overdueResult);

                db.all(queryUpcomingPayments, [today], (err, upcomingResult) => {
                    if (err) {
                        console.error("🚨 Error al contar pagos por vencer:", err.message);
                        return res.status(500).json({ error: "Error al obtener pagos por vencer." });
                    }
                    console.log("✅ Pagos próximos a vencer:", upcomingResult);

                    console.log("📡 Datos enviados al frontend:", {
                        totalIncome: incomeResult[0]?.totalIncome || 0,
                        totalPayments: paymentsResult[0]?.totalPayments || 0,
                        overduePayments: overdueResult[0]?.overduePayments || 0,
                        upcomingPayments: upcomingResult[0]?.upcomingPayments || 0
                    });

                    res.json({
                        totalIncome: incomeResult[0]?.totalIncome || 0,
                        totalPayments: paymentsResult[0]?.totalPayments || 0,
                        overduePayments: overdueResult[0]?.overduePayments || 0,
                        upcomingPayments: upcomingResult[0]?.upcomingPayments || 0
                    });
                });
            });
        });
    });
});





// ✅ Ruta de prueba
app.get('/api/test', (req, res) => {
    console.log("✅ Solicitud a /api/test recibida.");
    res.json({ message: "✅ El servidor responde correctamente." });
});

// ✅ Usar las rutas de pagos solo si paymentsRouter está definido
if (paymentsRouter) {
    app.use('/api', paymentsRouter);
} else {
    console.error('❌ Error: `paymentsRouter` no está definido correctamente. Verifica la importación en server.js.');
}

// ✅ Ruta para el Dashboard Informativo
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({
        totalIncome: 50000,
        overduePayments: 2,
        upcomingPayments: 3,
        overdueList: [
            { id: 1, fullName: "Juan Pérez", paymentDate: "2024-01-20" },
            { id: 2, fullName: "María López", paymentDate: "2024-01-21" }
        ],
        upcomingList: [
            { id: 3, fullName: "Carlos Díaz", paymentDate: "2024-02-01" },
            { id: 4, fullName: "Ana Fernández", paymentDate: "2024-02-03" }
        ]
    });
});

// ✅ Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
