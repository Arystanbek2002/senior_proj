import express from 'express';
import { Analysis, Instrumental }  from '../models/analysis.js';
import Supervision  from '../models/supervision.js';
import authMiddleware from '../middleware/authMiddleware.js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Specify the upload directory
  },
  filename: function (req, file, cb) {
    // Create a unique file name using the original name and a UUID
    const uniqueSuffix = `${uuidv4()}-${Date.now()}`;
    const extension = file.originalname.split('.').pop(); // Extract file extension
    cb(null, `${uniqueSuffix}.${extension}`);
  },
});

const upload = multer({ storage: storage });

router.post('/save-analysis', authMiddleware, async (req, res) => {
    try {
        let { name_of_analysis, components, category, date_of_analysis } = req.body;
    
        const missingFields = [];
        if (!name_of_analysis) missingFields.push('name_of_analysis');
        if (!components || !Array.isArray(components) || components.length === 0) missingFields.push('components');
        if (!date_of_analysis) missingFields.push('date_of_analysis');
        if (!category) missingFields.push('category');
    
        console.log('Received data:', req.body);
    
        if (missingFields.length > 0) {
            return res.status(400).json({ message: 'Missing required fields', missingFields });
        }
    
        // Parse date_of_analysis if it's a string in format "DD.MM.YYYY"
        if (typeof date_of_analysis === 'string') {
            const [day, month, year] = date_of_analysis.split('.');
            if (day && month && year) {
              date_of_analysis = new Date(`${year}-${month}-${day}`);
            } else {
              return res.status(400).json({ message: 'Invalid date format' });
            }
        }
    
        // Create and save the analysis data
        const analysis = new Analysis({
            user_id: req.user.id,
            name_of_analysis,
            category,
            components,
            date_of_analysis,
        });
    
        await analysis.save();
    
        res.status(201).json({ message: 'Analysis data saved successfully', analysis });
    } catch (error) {
        console.error('Error saving analysis:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
    
});

router.get('/analyses', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    // Find all analyses where user_id matches the logged‑in user
    const analyses = await Analysis.find({ user_id: userId })
      .sort({ date_of_analysis: -1 }); // опционально: сортируем по дате, от новых к старым

    res.status(200).json({
      message: 'Fetched all analyses successfully',
      analyses: analyses
    });
  } catch (error) {
    console.error('Error fetching analyses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Protected endpoint to process an image
router.post('/process', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('File not uploaded');
    }

    const imagePath = req.file.path;
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });

    const response = await OpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract data from analysis and return JSON with fields: name_of_analysis, date_of_analysis, components (name, result, reference_range). A result of "+" indicates presence, and "++" indicates a high amount, especially in the bacteria component.',
            },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,' + imageData,
              },
            },
          ],
        },
      ],
    });

    // Delete the image file after processing
    fs.unlinkSync(imagePath);

    res.json(response.choices[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

router.post('/process-pdf', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('File not uploaded');
    }

    const pdfPath = req.file.path;
    const pdfData = fs.readFileSync(pdfPath);

    // Parse PDF to extract text
    const parsedData = await pdfParse(pdfData);
    const extractedText = parsedData.text;

    // Send the extracted text to OpenAI
    const response = await OpenAI.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Extract data from the following analysis and return JSON with fields: name_of_analysis, date_of_analysis, category (assign one of these based on name:Биохимия, Гематология, Гистопатология, Иммунология, Клинические исследования, Коагулология, Микробиология, Цитология), components (name, result, reference_range). Text:\n\n${extractedText}`,
        },
      ],
    });

    // Delete the PDF file after processing
    fs.unlinkSync(pdfPath);

    res.json(response.choices[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


router.post('/instrumental', authMiddleware, upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
]), async (req, res) => {
  try {
    if (!req.files || !req.files['image1'] || !req.files['image2']) {
      return res.status(400).send('Both images are required');
    }

    const userId = req.user.id;
    const image1Path = req.files['image1'][0].path;
    const image2Path = req.files['image2'][0].path;
    const analysisName = req.body.analysis_name;

    if (!analysisName || !analysisName.trim()) {
      return res.status(400).send('Analysis name is required');
    }

    // Save file details to the database
    const instrumental = new Instrumental({
      user_id: userId,
      analysis_name: analysisName.trim(),
      filepaths: [image1Path, image2Path],
      upload_date: new Date(),
    });

    await instrumental.save();

    res.status(201).json({
      message: 'Instrumental analysis images uploaded and saved successfully',
      instrumental,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Endpoint to get instrumental analyse for a user
router.get('/instrumental/:id/image/:index', authMiddleware, async (req, res) => {
  try {
    const { id, index } = req.params;

    // Find the instrumental analysis record by ID and user_id
    const instrumental = await Instrumental.findOne({ _id: id, user_id: req.user.id });

    if (!instrumental) {
      return res.status(404).json({ message: 'Instrumental analysis not found or access denied' });
    }

    if (!instrumental.filepaths[0] || !instrumental.filepaths[1]) {
      return res.status(400).json({ message: 'Missing file path' });
    }

    // Check if the file exists
    const filePath = path.resolve(instrumental.filepaths[index]);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Set the content type based on the file extension
    const fileExtension = path.extname(filePath).toLowerCase();
    const mimeTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    const mimeType = mimeTypeMap[fileExtension] || 'application/octet-stream';

    // Send the file as a response
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


router.get('/get-instrumentals', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all instrumental analyses for the authenticated user
    const instrumentals = await Instrumental.find({ user_id: userId }).sort({ upload_date: -1 });

    if (!instrumentals.length) {
      return res.status(404).json({ message: 'No instrumental analyses found for this user' });
    }

    // Map results to include necessary data
    const results = instrumentals.map((instrumental) => {
      return {
        id: instrumental._id,
        analysis_name: instrumental.analysis_name,
        upload_date: instrumental.upload_date,
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

router.get(
  '/doctor-user',
  authMiddleware,
  async (req, res) => {
    try {
      // 1) Ensure caller is a doctor
      if (req.user.role !== 'doctor') {
        console.log(req.user)
        return res.status(403).json({ message: 'Access denied: doctors only' });
      }

      // 2) Pull patient ID from query
      const patientId = req.query.userId;
      if (!patientId) {
        return res.status(400).json({ message: 'userId query param is required' });
      }

      // 3) Verify supervision exists & is active
      const supervision = await Supervision.findOne({
        doctor: req.user.id,
        user: patientId,
        status: 'active'
      });
      if (!supervision) {
        return res.status(403).json({ message: 'No active supervision for this user' });
      }

      // 4) Fetch and return the analyses
      const analyses = await Analysis.find({ user_id: patientId })
        .sort({ date_of_analysis: -1 });

      return res.status(200).json({
        message: 'Fetched patient analyses successfully',
        analyses
      });
    } catch (error) {
      console.error('Error fetching patient analyses:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);




router.get(
  '/doctor-inst',
  authMiddleware,
  async (req, res) => {
    try {
      // 1) Only doctors allowed
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: doctors only' });
      }

      // 2) Extract patient ID
      const patientId = req.query.userId;
      if (!patientId) {
        return res.status(400).json({ message: 'userId query param is required' });
      }

      // 3) Verify active supervision
      const supervision = await Supervision.findOne({
        doctor: req.user.id,
        user: patientId,
        status: 'active'
      });
      if (!supervision) {
        return res.status(403).json({ message: 'No active supervision for this user' });
      }

      // 4) Fetch instrumentals for that patient
      const instrumentals = await Instrumental.find({ user_id: patientId })
        .sort({ upload_date: -1 });

      const results = instrumentals.map(i => ({
        id: i._id,
        analysis_name: i.analysis_name,
        upload_date: i.upload_date
      }));

      return res.status(200).json({ instrumentals: results });
    } catch (error) {
      console.error('Error fetching instrumentals for doctor:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

/**
 * GET /instrumentals/doctor-user/:id/image/:index
 * Return one of the two images for a given instrumental analysis,
 * but only if the authenticated doctor supervises the patient.
 */
router.get(
  '/doctor-inst/:id/image/:index',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Access denied: doctors only' });
      }

      const { id, index } = req.params;
      const idx = parseInt(index, 10);
      if (isNaN(idx)) {
        return res.status(400).json({ message: 'Invalid image index' });
      }

      // 1) Find the instrumental record
      const inst = await Instrumental.findById(id);
      if (!inst) {
        return res.status(404).json({ message: 'Instrumental analysis not found' });
      }

      // 2) Check supervision
      const supervision = await Supervision.findOne({
        doctor: req.user.id,
        user: inst.user_id,
        status: 'active'
      });
      if (!supervision) {
        return res.status(403).json({ message: 'No active supervision for this user' });
      }

      // 3) Validate index & filepath
      if (idx < 0 || idx >= inst.filepaths.length) {
        return res.status(400).json({ message: 'Invalid image index' });
      }
      const relPath = inst.filepaths[idx];
      const absPath = path.resolve(__dirname, '..', relPath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }

      // 4) Serve the file with correct MIME
      const ext = path.extname(absPath).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
      };
      res.type(mimeMap[ext] || 'application/octet-stream');
      res.sendFile(absPath);
    } catch (error) {
      console.error('Error fetching instrumental image for doctor:', error);
      res.status(500).send('Server error');
    }
  }
);



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/save-analysis-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/saveAnalysis.html'));
});

router.get('/analyses-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/analysisList.html'));
});

router.get('/instrumental-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/instrumental.html'));
});

router.get('/instrumentals-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/instrumentals.html'));
});

router.get('/instrumental-detail-page', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/instrumentalDetail.html'));
});

router.get('/user-overview', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/userOverview.html'));
});

export default router;