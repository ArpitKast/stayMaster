const express = require("express");
const multer = require("multer");
const {
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImage,
  serveBannerImage,
} = require("../controllers/bannerController");
const validateToken = require("../middleware/validateTokenHandler");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024,
  },
});

const router = express.Router();

// Public routes (no authentication required)
router.route("/images/:key(*)").get(serveBannerImage); // Serve banner images

// Protected routes (authentication required)
router.use(validateToken); // Apply middleware to subsequent routes

router.route("/image-upload").post(upload.single('image'), uploadBannerImage);
router.route("/").post(upload.single('image'), createBanner); // Create banner
router.route("/:id").put(upload.single('image'), updateBanner).delete(deleteBanner); // Update/Delete banner

module.exports = router;
