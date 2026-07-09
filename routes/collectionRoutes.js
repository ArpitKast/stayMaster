const express = require("express");
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const CollectionController = new collectionController();
const validateCookieToken = require("../middleware/cookieTokenHandler");

const multer = require('multer');
const validateToken = require("../middleware/validateTokenHandler");
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        fieldSize: 10 * 1024 * 1024
    }
});

router.get('/', CollectionController.getAllCollections);
router.get('/list',validateCookieToken, CollectionController.getAllCollections);//authenticate via token
router.get('/:id', CollectionController.getCollectionById);
router.post('/',validateToken, upload.single('icon'), CollectionController.createCollection);
router.put('/:id',validateToken, upload.single('icon'), CollectionController.updateCollection);
router.delete('/:id',validateToken, CollectionController.deleteCollection);

module.exports = router
