import express from 'express';
import Supervision from '../models/supervision.js';
import Doctor from '../models/doctor.js';
import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import authMiddleware from '../middleware/authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('Type of authMiddleware:', typeof authMiddleware); // Should output "function"

router.post('/invite', authMiddleware, async (req, res) => {
  // Extract the QR token from the query parameter.
  const { qrToken } = req.query;
  if (!qrToken) {
    return res.status(400).json({ message: 'QR token is required' });
  }

  let doctorId;
  try {
    // Verify the QR token using a separate secret (QR_SECRET)
    const qrDecoded = jwt.verify(qrToken, process.env.QR_SECRET);
    doctorId = qrDecoded.doctorId;
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired QR token' });
  }

  // User id from the user's token (set by authMiddleware)
  const userId = req.user.id;
  //для теста пока конкретный id
  //const userId = new mongoose.Types.ObjectId('67f3fd710364a0c6850a3703');
  //const userId = new mongoose.Types.ObjectId('67f3fd710364a0c6850a3705');
  //const userId = new mongoose.Types.ObjectId('67f3fd710364a0c6850a3707');

  const { accessDurationDays } = req.body;

  // Use provided duration or default to 30 days.
  const duration = accessDurationDays || 30;

  // Calculate expiration date.
  const accessExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

  // Create a new Supervision invitation using doctorId from QR token and userId from JWT.
  const newInvitation = new Supervision({
    doctor: doctorId,
    user: userId,
    accessDurationDays: duration,
    accessExpiresAt: accessExpiresAt,
  });

  try {
    // Save the new invitation to the database.
    await newInvitation.save();
    res.status(201).json({
      message: 'Supervision invitation created successfully',
      invitation: newInvitation
    });
  } catch (error) {
    console.error('Error creating supervision invitation:', error);
    res.status(500).json({
      message: 'Failed to create supervision invitation',
      error: error.message
    });
  }
});





router.get(
  '/invitations',
  authMiddleware,
  async (req, res) => {
    try {
      const doctorId = req.user.id;

      // Find all supervisions for this doctor, and populate the user info
      const supervisions = await Supervision.find({ doctor: doctorId })
        .populate('user', 'name surname phone email');

      // Map to a cleaner array of { id, name, surname, email, phone, expiresAt }
      const users = supervisions
        .filter(s => s.user) // drop any without a user reference
        .map(s => ({
          id: s.user._id,
          name: s.user.name,
          surname: s.user.surname,
          email: s.user.email,
          phone: s.user.phone,
          expiresAt: s.accessExpiresAt
        }));

      res.status(200).json({
        message: 'Fetched supervised users successfully',
        users
      });
    } catch (error) {
      console.error('Error fetching supervised users:', error);
      res.status(500).json({
        message: 'Failed to fetch supervised users',
        error: error.message
      });
    }
  }
);




router.get('/doctor-name', async (req, res) => {
  const { qrToken } = req.query;
  if (!qrToken) {
    return res.status(400).json({ message: 'qrToken required' });
  }
  try {
    // Декодируем qrToken с помощью секрета QR_SECRET
    const decoded = jwt.verify(qrToken, process.env.QR_SECRET);
    const doctorId = decoded.doctorId;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    res.json({ doctorName: doctor.name });
  } catch (err) {
    console.error('Error verifying qrToken:', err, doctorId);
    res.status(400).json({ message: 'Invalid or expired qrToken' });
  }
});


router.get('/choose-supervision-time', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/chooseSupervisionTime.html'));
});


router.get('/qr-code', authMiddleware, async (req, res) => {
  const  doctorId  = req.user.id;
  const token = jwt.sign({ doctorId }, process.env.QR_SECRET, { expiresIn: '12h' });

  const url = `${process.env.BASE_URL}choose-supervision-time?qrToken=${token}`;

  res.json({ url });
});

router.get('/qr-code/view', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/qrCode.html'));
});

router.get(
  '/supervised-users-page',
  (req, res) => {
    res.sendFile(path.join(__dirname, '../views/supervisedUsers.html'));
  }
);

export default router;