/**
 * Manager API Routes
 * Base path: /api/manager
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const managerAuth = require("../middleware/managerAuthHandler");
const managerController = require("../controllers/managerController");
const {
  createBlog,
  getBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  getCategories: getBlogCategoriesLegacy, // rename legacy one
  uploadBlogImage,
  uploadBlogImageFromUrl,
} = require("../controllers/blogController");

const blogCategoryController = require("../controllers/blogCategoryController");
const blogTagController = require("../controllers/blogTagController");

// Blog image uploads — 10MB is more than enough for a blog featured image
const blogUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 10 * 1024 * 1024,
    fileSize: 10 * 1024 * 1024,
    fields: 100,
    files: 10,
  },
});

// Bridge middleware: maps req.manager → req.user so blogController works unchanged
const bridgeManagerToUser = (req, res, next) => {
  req.user = req.manager;
  next();
};

// Public - no auth required
router.post("/login", (req, res) => managerController.login(req, res));

// Protected - manager auth required
router.get("/me", managerAuth, (req, res) => managerController.me(req, res));
router.patch("/me", managerAuth, (req, res) => managerController.updateMe(req, res));
router.get("/properties", managerAuth, (req, res) => managerController.getProperties(req, res));
router.get("/bookings", managerAuth, (req, res) => managerController.getBookings(req, res));
router.get("/booking/:id", managerAuth, (req, res) => managerController.getBookingDetail(req, res));
router.get("/booking/:id/checkin", managerAuth, (req, res) => managerController.getCheckinStatus(req, res));
router.post("/booking/:id/feedback", managerAuth, (req, res) => managerController.saveFeedback(req, res));
router.post("/booking/:id/guest/:guestId/upload-document", managerAuth, upload.single("idFile"), (req, res) => managerController.uploadGuestDocument(req, res));
// Approve or reject a guest's uploaded ID document
router.patch("/booking/:id/guest/:guestId/document-status", managerAuth, (req, res) => managerController.updateDocumentStatus(req, res));
// Approve or reject a guest's cancellation request and set refund details
router.patch("/booking/:id/cancellation", managerAuth, (req, res) => managerController.manageCancellation(req, res));

// ── Abandoned Bookings ──
const AbandonedBookingControllerClass = require('../controllers/abandonedBookingController');
const AbandonedBookingControllerMgr = new AbandonedBookingControllerClass();
router.get('/abandoned-bookings', managerAuth, (req, res) => AbandonedBookingControllerMgr.list(req, res));
router.delete('/abandoned-bookings/:id', managerAuth, (req, res) => AbandonedBookingControllerMgr.remove(req, res));

// ── Blog Management Routes (manager-scoped) ──
router.get("/blogs/categories-legacy", managerAuth, bridgeManagerToUser, getBlogCategoriesLegacy);
router.get("/blogs", managerAuth, bridgeManagerToUser, getBlogs);
router.get("/blogs/:id", managerAuth, bridgeManagerToUser, getBlog);
// Auth runs before multer so unauthenticated requests are rejected before file streaming begins
router.post("/blogs/image-upload", managerAuth, bridgeManagerToUser, blogUpload.single("image"), uploadBlogImage);
router.post("/blogs/image-upload-from-url", managerAuth, bridgeManagerToUser, uploadBlogImageFromUrl);
router.post("/blogs", managerAuth, bridgeManagerToUser, blogUpload.single("featured_image"), createBlog);
router.put("/blogs/:id", managerAuth, bridgeManagerToUser, blogUpload.single("featured_image"), updateBlog);
router.delete("/blogs/:id", managerAuth, bridgeManagerToUser, deleteBlog);

// ── Blog Categories CRUD ──
router.get("/blogs/categories", managerAuth, blogCategoryController.getCategories);
router.post("/blogs/categories", managerAuth, blogCategoryController.createCategory);
router.put("/blogs/categories/:id", managerAuth, blogCategoryController.updateCategory);
router.delete("/blogs/categories/:id", managerAuth, blogCategoryController.deleteCategory);

// ── Blog Tags CRUD ──
router.get("/blogs/tags", managerAuth, blogTagController.getTags);
router.post("/blogs/tags", managerAuth, blogTagController.createTag);
router.put("/blogs/tags/:id", managerAuth, blogTagController.updateTag);
router.delete("/blogs/tags/:id", managerAuth, blogTagController.deleteTag);

module.exports = router;
