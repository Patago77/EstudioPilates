const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY || 'clave_por_defecto';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    console.log("Authorization Header recibido:", authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn("Encabezado de autorización no válido o ausente.");
        return res.status(403).json({ error: 'Encabezado de autorización no válido o ausente.' });
    }

    const token = authHeader.split(' ')[1];
    console.log("Token extraído:", token);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error("Error al verificar el token:", err.message);
            const message = err.name === 'TokenExpiredError'
                ? 'El token ha expirado.'
                : 'Token inválido o no autorizado.';
            return res.status(403).json({ error: message });
        }

        req.user = user;
        console.log("Usuario autenticado:", user);
        next();
    });
}

module.exports = authenticateToken;
