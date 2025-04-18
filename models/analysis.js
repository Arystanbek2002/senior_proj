import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name_of_analysis: { type: String, required: true },
  category: { type: String, required: true },
  components: [
    {
      name: { type: String, required: true },
      result: { type: String, required: true },
      reference_range: { type: String },
    },
  ],
  date_of_analysis: { type: Date, required: true },
});
const Analysis = mongoose.model('Analysis', analysisSchema);

const instrumentalSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  analysis_name: { type: String, required: true },
  filepaths: { type: [String], required: true },
  upload_date: { type: Date, default: Date.now },
});
const Instrumental = mongoose.model('Instrumental', instrumentalSchema);

// Экспортируем модели через именованные экспорты
export { Analysis, Instrumental };
