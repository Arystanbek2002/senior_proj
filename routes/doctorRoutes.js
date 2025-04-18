import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Doctor from '../models/doctor.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, specialization, language } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newDoctor = new Doctor({ name, email, phone, password: hashedPassword, specialization, language });
    await newDoctor.save();
    res.status(201).send('Doctor registered successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const doctor = await Doctor.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });
    if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }
    const token = jwt.sign(
      { id: doctor._id, email: doctor.email, role: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({
      token,
      user: { id: doctor._id, name: doctor.name, specialization: doctor.specialization },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создание __dirname в ES-модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Маршрут для отправки HTML-страницы регистрации врача
router.get('/register-page', (req, res) => {
  // Предполагается, что HTML-файл находится в папке views на уровень выше (например, ../views/doctorRegister.html)
  res.sendFile(path.join(__dirname, '../views/doctorRegister.html'));
});

// Маршрут для отправки HTML-страницы логина врача
router.get('/login-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/doctorLogin.html'));
});

router.get('/main-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/main.html'));
});

export default router;
