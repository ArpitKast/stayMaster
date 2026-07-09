const express = require("express");
const multer = require("multer");
const {
  createBlog,
  getBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  getCategories, // Import getCategories
  getListingMeta,
  uploadBlogImage,
  serveBlogImage,
  uploadBlogImageFromUrl,
} = require("../controllers/blogController");
const validateToken = require("../middleware/validateTokenHandler");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fieldSize: 500 * 1024 * 1024, // 500MB for field values (like HTML content)
    fileSize: 500 * 1024 * 1024,  // 500MB for actual files (increased from 100MB)
    fields: 100,                   // Max number of non-file fields
    files: 10,                     // Max number of file fields
  },
});

// Wrapper function to handle multer errors
const handleMulterUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error("========== Multer Error ==========");
        console.error("Error code:", err.code);
        console.error("Error message:", err.message);
        console.error("Field:", err.field);
        console.error("Request body size:", JSON.stringify(req.body || {}).length, "bytes");
        console.error("==================================");
        
        let message = "File upload error";
        let statusCode = 400;
        
        switch (err.code) {
          case 'LIMIT_FILE_SIZE':
            message = `File too large. Maximum size is 500MB.`;
            statusCode = 413;
            break;
          case 'LIMIT_FIELD_SIZE':
            message = `Field value too large. Maximum size is 500MB.`;
            statusCode = 413;
            break;
          case 'LIMIT_FILE_COUNT':
            message = `Too many files. Maximum is 10 files.`;
            break;
          case 'LIMIT_FIELD_COUNT':
            message = `Too many fields. Maximum is 100 fields.`;
            break;
          case 'LIMIT_UNEXPECTED_FILE':
            message = `Unexpected file field: ${err.field}`;
            break;
          default:
            message = `File upload error: ${err.message}`;
        }
        
        return res.status(statusCode).json({
          title: "File Upload Error",
          message: message,
          error: err.code
        });
      } else if (err) {
        // Other errors (not multer errors)
        console.error("========== Upload Error (Non-Multer) ==========");
        console.error("Error:", err.message);
        console.error("==============================================");
        return res.status(500).json({
          title: "Upload Error",
          message: err.message || "An error occurred during file upload"
        });
      }
      next();
    });
  };
};

const router = express.Router();
console.log("blogRoutes.js is being loaded and routes are being defined."); // Add this log

// Public routes (no authentication required)
router.route("/").get(getBlogs); // Get all blogs
router.route("/categories").get(getCategories); // Get categories
router.route("/listing-meta").get(getListingMeta); // Get blog listing metadata (categories with counts + tags)
router.route("/images/:key(*)").get(serveBlogImage); // Serve inline/editor images
router.route("/:id").get(getBlog); // Get single blog

// Protected routes (authentication required)
router.use(validateToken); // Apply middleware to subsequent routes

router.route("/image-upload").post(handleMulterUpload(upload.single('image')), uploadBlogImage);
router.route("/image-upload-from-url").post(uploadBlogImageFromUrl);
router.route("/").post(handleMulterUpload(upload.single('featured_image')), createBlog); // Create blog
router.route("/:id").put(handleMulterUpload(upload.single('featured_image')), updateBlog).delete(deleteBlog); // Update/Delete blog

module.exports = router;
