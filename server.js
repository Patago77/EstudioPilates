require('dotenv').config(); // Cargar las variables de entorno
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Declarado una vez
const paymentsRoutes = require('./middlewares/routes/paymentsRoutes'); // Importa las rutas

// Inicializa la aplicación
const app = express();
const port = 3000;

// Clave secreta
const SECRET_KEY = 'secreto_seguro'; // Declarado una vez

// Ruta para generar un token (opcional, para pruebas)
app.post('/generate-token', (req, res) => {
    const user = { username: 'testuser' }; // Usa los datos del usuario que necesitas incluir
    const token = jwt.sign(user, SECRET_KEY, { expiresIn: '1h' }); // Token válido por 1 hora
    res.json({ token });
});

// Configurar CORS
const corsOptions = {
    origin: ['http://127.0.0.1:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// Ruta de inicio de sesión
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (username !== 'admin') {
        return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    const passwordHash = bcrypt.hashSync('1234', 8);
    const passwordMatch = bcrypt.compareSync(password, passwordHash);
    if (!passwordMatch) {
        return res.status(403).json({ error: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '12h' });
    res.json({ token });
});

// ✅ Endpoint para verificar el token
app.get('/api/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido o expirado.' });
        }

        res.json({ valid: true, user: decoded });
    });
});

// Usar las rutas de pagos
app.use('/api', paymentsRoutes);

// Servidor en escucha
app.listen(port, () => console.log(`🚀 Servidor corriendo en http://localhost:${port}`));
