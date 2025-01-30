const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// ✅ Configuración General
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'secreto_seguro';

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

// ✅ Ruta de inicio de sesión
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username !== 'admin' || password !== '1234') {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Generar un token válido por 12 horas
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '12h' });
    res.json({ token });
});

// ✅ Ruta para verificar el token
app.get('/api/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado o formato incorrecto' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        res.json({ valid: true, user });
    });
});

// ✅ Ruta para el Dashboard Informativo
app.get('/api/dashboard', (req, res) => {
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

// ✅ Ruta para buscar pagos por cliente
app.get('/api/payments/client/:searchQuery', (req, res) => {
    const searchQuery = req.params.searchQuery;
    const sql = `SELECT rowid as id, fullName, paymentDate, subscriptionType FROM payments WHERE fullName LIKE ?`;
    
    db.all(sql, [`%${searchQuery}%`], (err, rows) => {
        if (err) {
            console.error('Error al buscar pagos:', err);
            return res.status(500).json({ error: 'Error al buscar pagos' });
        }
        res.json(rows);
    });
});

// ✅ Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});