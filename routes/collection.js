const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const collectionsFile = path.join(__dirname, '..', 'data', 'collections.json');
const usersFile = path.join(__dirname, '..', 'data', 'users.json');

const router = express.Router();

// Создание коллекции
router.post('/', auth, async (req, res) => {
    const { name, description, category, customFields } = req.body;
    try {
        const collections = await fs.readJson(collectionsFile);
        const newCollection = {
            id: uuidv4(),
            userId: req.user.id,
            name,
            description,
            category,
            customFields,
            items: []
        };
        collections.push(newCollection);
        await fs.writeJson(collectionsFile, collections);
        res.json(newCollection);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Добавление айтема в коллекцию (только для владельца)
router.post('/:collectionId/items', auth, async (req, res) => {
    const { title, tags, customFieldValues } = req.body;
    const { collectionId } = req.params;

    try {
        const collections = await fs.readJson(collectionsFile);
        const collection = collections.find(coll => coll.id === collectionId && coll.userId === req.user.id);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or unauthorized' });
        }

        const newItem = {
            id: uuidv4(),
            title,
            tags,
            customFieldValues,
            comments: []  // Initialize with empty comments array
        };
        collection.items.push(newItem);

        await fs.writeJson(collectionsFile, collections);

        res.json(newItem);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Удаление айтема из коллекции (только для владельца)
router.delete('/:collectionId/items/:itemId', auth, async (req, res) => {
    const { collectionId, itemId } = req.params;

    try {
        const collections = await fs.readJson(collectionsFile);
        const collection = collections.find(coll => coll.id === collectionId && coll.userId === req.user.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or unauthorized' });
        }

        const updatedItems = collection.items.filter(item => item.id !== itemId);

        if (collection.items.length === updatedItems.length) {
            return res.status(404).json({ message: 'Item not found' });
        }

        collection.items = updatedItems;

        await fs.writeJson(collectionsFile, collections);

        res.json({ message: 'Item deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Удаление коллекции (только для владельца)
router.delete('/:collectionId', auth, async (req, res) => {
    const { collectionId } = req.params;

    try {
        const collections = await fs.readJson(collectionsFile);
        const updatedCollections = collections.filter(collection => collection.id !== collectionId || collection.userId !== req.user.id);

        if (collections.length === updatedCollections.length) {
            return res.status(404).json({ message: 'Collection not found or unauthorized' });
        }

        await fs.writeJson(collectionsFile, updatedCollections);

        res.json({ message: 'Collection deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Обновление коллекции (только для владельца)
router.put('/:collectionId', auth, async (req, res) => {
    const { collectionId } = req.params;
    const { name, description, category, customFields } = req.body;

    try {
        const collections = await fs.readJson(collectionsFile);
        const collection = collections.find(coll => coll.id === collectionId && coll.userId === req.user.id);

        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or unauthorized' });
        }

        if (name) collection.name = name;
        if (description) collection.description = description;
        if (category) collection.category = category;
        if (customFields) collection.customFields = customFields;

        await fs.writeJson(collectionsFile, collections);

        res.json(collection);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Обновление айтема в коллекции (только для владельца)
router.put('/:collectionId/items/:itemId', auth, async (req, res) => {
    const { collectionId, itemId } = req.params;
    const { title, tags, customFieldValues } = req.body;
    try {
        const collections = await fs.readJson(collectionsFile);
        const collection = collections.find(coll => coll.id === collectionId && coll.userId === req.user.id);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found or unauthorized' });
        }
        const item = collection.items.find(item => item.id === itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        if (title) item.title = title;
        if (tags) item.tags = tags;
        if (customFieldValues) item.customFieldValues = customFieldValues;
        await fs.writeJson(collectionsFile, collections);
        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Получение конкретного айтема в коллекции (доступно всем)
router.get('/:collectionId/items/:itemId', async (req, res) => {
    const { collectionId, itemId } = req.params;
    try {
        const collections = await fs.readJson(collectionsFile);
        const collection = collections.find(coll => coll.id === collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        const item = collection.items.find(item => item.id === itemId);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Получение коллекций текущего пользователя (доступно только владельцу)
router.get('/user', auth, async (req, res) => {
    try {
        const collections = await fs.readJson(collectionsFile);
        const userCollections = collections.filter(collection => collection.userId === req.user.id);
        res.json(userCollections);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Получение всех коллекций (доступно всем)
router.get('/', async (req, res) => {
    try {
        const collections = await fs.readJson(collectionsFile);
        res.json(collections);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
