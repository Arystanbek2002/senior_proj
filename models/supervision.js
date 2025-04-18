import mongoose from 'mongoose';

const supervisionSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
  accessDurationDays: { type: Number, default: 30 },
  accessExpiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

supervisionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

supervisionSchema.on('index', error => {
  if (error) {
    console.error('Ошибка при построении индексов:', error);
  } else {
    // Если необходимо удалить индекс программно:
    Supervision.collection.dropIndex('inviteToken')
      .then(() => console.log('Индекс inviteToken успешно удален'))
      .catch(err => console.error('Ошибка при удалении индекса:', err));
  }
});

const Supervision = mongoose.model('Supervision', supervisionSchema);
export default Supervision;