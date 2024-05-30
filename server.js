const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure data directory and files exist
fs.ensureDirSync(path.join(__dirname, 'data'));
fs.ensureFileSync(path.join(__dirname, 'data', 'users.json'));
fs.ensureFileSync(path.join(__dirname, 'data', 'collections.json'));

// Initialize data files if empty
const usersFile = path.join(__dirname, 'data', 'users.json');
const collectionsFile = path.join(__dirname, 'data', 'collections.json');
if (fs.readFileSync(usersFile, 'utf-8').trim() === '') fs.writeFileSync(usersFile, '[]');
if (fs.readFileSync(collectionsFile, 'utf-8').trim() === '') fs.writeFileSync(collectionsFile, '[]');

// Routes
const userRoutes = require('./routes/user');
app.use('/api/users', userRoutes);

const collectionRoutes = require('./routes/collection');
app.use('/api/collections', collectionRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const users = await fs.readJson(usersFile);
        return users.find(user => user.id === decoded.user.id);
    } catch (err) {
        console.error('Token verification failed:', err.message);
        return null;
    }
};

// WebSocket connection
wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const { collectionId, itemId, comment, token } = JSON.parse(message);

            // Проверка авторизации
            const user = await verifyToken(token);
            if (!user) {
                ws.send(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }

            const collections = await fs.readJson(collectionsFile);
            const collection = collections.find(coll => coll.id === collectionId);
            if (!collection) {
                ws.send(JSON.stringify({ error: 'Collection not found' }));
                return;
            }
            const item = collection.items.find(item => item.id === itemId);
            if (!item) {
                ws.send(JSON.stringify({ error: 'Item not found' }));
                return;
            }

            const newComment = {
                ...comment,
                user: user.name,
                createdAt: new Date().toISOString()
            };
            item.comments.push(newComment);
            await fs.writeJson(collectionsFile, collections);
            ws.send(JSON.stringify({ success: true, item }));
        } catch (error) {
            ws.send(JSON.stringify({ error: 'Server error' }));
        }
    });
});

// Route for searching items and collections
// New search endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q.toLowerCase();
    try {
        const collections = await fs.readJson(collectionsFile);
        const results = [];

        collections.forEach(collection => {
            collection.items.forEach(item => {
                // Check if item title exists and contains the query
                const itemTitle = item.title ? item.title.toLowerCase() : '';
                const itemComments = item.comments || [];

                if (itemTitle.includes(query) || itemComments.some(comment => comment.text && comment.text.toLowerCase().includes(query))) {
                    results.push({
                        ...item,
                        collectionId: collection.id
                    });
                }
            });

            // If the collection title contains the query, return a random item from the collection
            const collectionTitle = collection.title ? collection.title.toLowerCase() : '';
            if (collectionTitle.includes(query) && collection.items.length > 0) {
                const randomItem = collection.items[Math.floor(Math.random() * collection.items.length)];
                results.push({
                    ...randomItem,
                    collectionId: collection.id
                });
            }
        });

        res.json(results);
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
