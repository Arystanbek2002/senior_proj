import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  surname: { type: String, required: false },
  phone: { type: String, unique: true, required: false },
  password: { type: String, required: true },
});

export async function createMockUsers() {
  // Массив с данными для тестовых пользователей
  const mockUsers = [
    { email: "user1@example.com", name: "John", surname: "Doe", phone: "1234567890", password: "password123" },
    { email: "user2@example.com", name: "Jane", surname: "Smith", phone: "0987654321", password: "password456" },
    { email: "user3@example.com", name: "Alice", surname: "Johnson", phone: "1112223333", password: "password789" }
  ];

  const createdUsers = [];

  for (const userData of mockUsers) {
    try {
      // Хэшируем пароль пользователя
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      userData.password = hashedPassword;

      // Создаём нового пользователя и сохраняем его в базе
      const newUser = new User(userData);
      await newUser.save();
      createdUsers.push(newUser);
      console.log(`User ${newUser.email} created successfully`);
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error.message);
    }
  }

  return createdUsers;
}

const User = mongoose.model('User', userSchema);
export default User;