const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');  // Импортируем middleware для авторизации

const usersFile = path.join(__dirname, '..', 'data', 'users.json');

const router = express.Router();

// Регистрация пользователя
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const users = await fs.readJson(usersFile);
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            name,
            email,
            password: hashedPassword,
            collections: [],
            registrationDate: new Date().toISOString()
        };
        users.push(newUser);

        await fs.writeJson(usersFile, users);

        const payload = { user: { id: newUser.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});
// Вход пользователя
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const users = await fs.readJson(usersFile);
        const user = users.find(user => user.email === email);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});
router.get('/me', auth, async (req, res) => {
    try {
        console.log(req.user.id)
        const userId = req.user.id; // Получаем ID пользователя из токена
        const users = await fs.readJson(usersFile);
        const user = users.find(user => user.id === userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});
// Новый маршрут для получения всех пользователей
router.get('/', auth, async (req, res) => {
    try {
        const users = await fs.readJson(usersFile);
        const usersWithoutPasswords = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        res.json(usersWithoutPasswords);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
