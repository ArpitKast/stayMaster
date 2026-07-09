const express = require("express");
const router = express.Router();
const {getContacts, createContact, getContact, updateContact, deleteContact} = require("../controllers/contactController");
const validateToken = require("../middleware/validateTokenHandler");

router.use(validateToken);

/**
 * @swagger
 * tags:
 *   name: Contacts
 *   description: CRM Contact management
 */

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all contacts
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 */
router.route("/").get(getContacts);
router.route("/").post(createContact);
//router.route("/").get(getContacts).post(createContact);
router.route("/:id").get(getContact);
router.route("/:id").put(updateContact);
router.route("/:id").delete(deleteContact);
//router.route("/:id").get(getContact).put(updateContact).delete(deleteContact);

module.exports = router;