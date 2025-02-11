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
const db = new sqlite3.Database('./payments.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err);
    } else {
        console.log('🗄️ Conectado a la base de datos SQLite');
    }
});

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
    console.log("📥 Recibida solicitud para agregar pago:", req.body);

    const { fullName, subscriptionType, paymentDate, extraNotes } = req.body;

    if (!fullName || !subscriptionType || !paymentDate) {
        console.log("❌ Falta información en la solicitud:", req.body);
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    try {
        console.log("🗄️ Insertando en la base de datos...");

        db.run(
            "INSERT INTO payments (fullName, subscriptionType, paymentDate, extraNotes) VALUES (?, ?, ?, ?)",
            [fullName, subscriptionType, paymentDate, extraNotes],
            function (err) {
                if (err) {
                    console.error("❌ Error al insertar en la BD:", err.message);
                    return res.status(500).json({ error: "Error al registrar el pago." });
                }

                console.log(`✅ Pago guardado en la BD: ID=${this.lastID}, Nombre=${fullName}, Fecha de Pago=${paymentDate}`);
                res.json({ success: true, id: this.lastID });
            }
        );

    } catch (error) {
        console.error("🚨 Error en la inserción de pagos:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});


app.get('/api/payments', authenticateToken, (req, res) => {
    db.all("SELECT amount FROM payments", [], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener pagos:", err.message);
            return res.status(500).json({ error: "Error al obtener pagos" });
        }

        const totalIncome = rows.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        console.log("✅ totalIncome calculado en backend:", totalIncome);

        res.json({
            totalIncome,
            overduePayments: 0,  // Si no los calculas, usa 0 para evitar errores
            upcomingPayments: 0
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
