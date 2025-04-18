import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
  // Extract the Authorization header (expected format: "Bearer <token>")
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Токен отсутствует или имеет неверный формат' });
  }
  const token = authHeader.split(' ')[1];
  try {
    // Verify and decode the token using the secret from environment variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Assuming the payload contains id and type, e.g., { id: '...', type: 'doctor' }
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Неверный токен' });
  }
}
