import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
    name: { type: String },
    email: { type: String, unique: true },
    phone: { type: String, unique: true },
    password: { type: String, required: true },
    specialization: { type: String },
    language: { type: String },
  });
  
  const Doctor = mongoose.model('Doctor', doctorSchema);
  export default Doctor;