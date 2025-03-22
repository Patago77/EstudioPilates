const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
    console.error("❌ ERROR: SECRET_KEY no está definida en .env");
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("❌ Token no enviado o formato incorrecto.");
        return res.status(401).json({ error: 'Token no proporcionado o formato incorrecto' });
    }

    const token = authHeader.split(' ')[1]; // 🔹 Extrae solo el token sin "Bearer"

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error("❌ Token inválido:", err.message);
            return res.status(403).json({ error: 'Token inválido o expirado' });
        }
        console.log("✅ Token válido. Usuario autenticado:", user);
        req.user = user; // 🔹 Guarda los datos del usuario autenticado
        next();
    });
}

module.exports = authenticateToken;
