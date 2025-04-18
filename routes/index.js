import express from 'express';
import userRoutes from './userRoutes.js';
import doctorRoutes from './doctorRoutes.js';
import analysisRoutes from './analysisRoutes.js';
import supervisionRoutes from './supervisionRoutes.js';

const router = express.Router();
router.use('/users', userRoutes);
router.use('/doctors', doctorRoutes);
router.use('/analyses', analysisRoutes);
router.use('/supervisions', supervisionRoutes);

export default router;