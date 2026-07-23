const asyncHandler = require("express-async-handler");
const Blog = require("../models/blogModel");
const BlogModel = new Blog();
const S3Helper = require("../helpers/s3Helper");
const Response = require("../helpers/responseHelper");
const { ROLE_MANAGER, ROLE_STAFF } = require("../config/constants");
const bucket = process.env.AWS_BUCKET;
const pool = require("../config/dbConnection"); // Import the database pool
const ImageHelper = require('../helpers/imageHelper');
const { uploadBlogImageFromUrlToS3 } = require('../helpers/blogImageHelper');

const { propertyImageBaseUrl, hasUsableCdnBaseUrl, buildCdnUrl } = require('../config/cdnConfig');

const extractS3Key = (value) => {
  if (!value) return null;
  let key = value.trim();
  if (!key) return null;

  try {
    const parsed = new URL(key);
    key = parsed.pathname || '';
  } catch (_) {
    if (key.includes('.com/')) {
      key = key.split('.com/')[1];
    }
  }

  key = key.replace(/^\/+/, '');
  const queryIndex = key.indexOf('?');
  if (queryIndex !== -1) {
    key = key.substring(0, queryIndex);
  }

  return key || null;
};

const isManagerBlogRequest = (req) =>
  typeof req.originalUrl === "string" && req.originalUrl.includes("/api/manager/");

/** Plain-text preview for /blogs cards (~3 lines). Stored on save — list API never reads `content`. */
const buildListingExcerpt = (html) => {
  if (!html || typeof html !== "string") return null;
  const plain = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  const max = 280;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
};

/** Presigned S3 URLs — browsers fetch images directly instead of proxying through Node. */
const BLOG_IMAGE_URL_TTL = 86400;

const resolveBlogImageUrl = async (key) => {
  if (!key) return null;
  try {
    return await S3Helper.getSignedUrlPromise({
      Bucket: bucket,
      Key: key,
      Expires: BLOG_IMAGE_URL_TTL,
    });
  } catch (error) {
    console.error(`Error presigning blog image ${key}:`, error);
    return null;
  }
};

const decorateFeaturedImages = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  await Promise.all(
    rows.map(async (row) => {
      // Externally-hosted images (e.g. ingested via webhook without S3) are stored
      // as full URLs — serve them directly instead of presigning through S3.
      if (row.featured_image && /^https?:\/\//i.test(row.featured_image)) {
        row.featured_image_key = null;
        return;
      }
      const key = extractS3Key(row.featured_image);
      row.featured_image_key = key;
      if (key) {
        row.featured_image = await resolveBlogImageUrl(key);
      }
    })
  );
  return rows;
};

/** Rewrite inline /api/blogs/images/ URLs in HTML to direct S3 presigned URLs. */
const rewriteContentImageUrls = async (html) => {
  if (!html || typeof html !== "string") return html;

  const pattern = /(?:https?:\/\/[^"'\\s>]+)?\/api\/blogs\/images\/([^"'\\s>)]+)/g;
  const keys = new Set();
  let match;
  while ((match = pattern.exec(html)) !== null) {
    keys.add(decodeURIComponent(match[1]));
  }
  if (keys.size === 0) return html;

  const urlByKey = {};
  await Promise.all(
    [...keys].map(async (key) => {
      urlByKey[key] = await resolveBlogImageUrl(key);
    })
  );

  return html.replace(pattern, (full, encodedKey) => {
    const key = decodeURIComponent(encodedKey);
    return urlByKey[key] || full;
  });
};

const buildBlogImageUrl = (req, key) => {
  if (hasUsableCdnBaseUrl) {
    return buildCdnUrl(key);
  }

  // Check for environment variable first (for production)
  if (process.env.BASE_URL) {
    // Remove trailing slash if present
    const cleanBaseUrl = process.env.BASE_URL.replace(/\/$/, '');
    return `${cleanBaseUrl}/api/blogs/images/${encodeURIComponent(key)}`;
  }
  
  // Fallback to request headers (for development)
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  // Check x-forwarded-host first (for proxies/load balancers), then fallback to host
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:8080';
  
  if (!host) {
    console.error('Warning: Unable to determine host from request headers');
    // Fallback to a default or throw an error
    throw new Error('Unable to determine host for image URL construction');
  }
  
  return `${protocol}://${host}/api/blogs/images/${encodeURIComponent(key)}`;
};

const uploadBlogImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return Response.error(res, "ERROR", "Image file is required.", 400);
  }

  try {
    const featured_image = req.file;
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(featured_image);
    const photoKey = `blogs/${formattedDate}_${baseName}${ext}`;
    const uploadResult = await S3Helper.uploadFile(bucket, photoKey, buffer, {
      ContentType: contentType,
    });

    if (!uploadResult) {
      throw new Error("Failed to upload image to storage.");
    }

    const publicUrl = buildBlogImageUrl(req, photoKey);

    return Response.success(res, {
      key: photoKey,
      imageUrl: publicUrl,
      url: publicUrl,
    }, 201);
  } catch (error) {
    console.error("Error in uploadBlogImage:", error);
    return Response.error(res, "ERROR", "Failed to upload blog image: " + error.message, 500);
  }
});

const uploadBlogImageFromUrl = asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.error(res, "ERROR", "A valid http/https URL is required.", 400);
  }

  try {
    const photoKey = await uploadBlogImageFromUrlToS3(url);
    if (!photoKey) {
      return Response.error(res, "ERROR", "URL does not point to a valid image or upload failed.", 400);
    }

    const publicUrl = buildBlogImageUrl(req, photoKey);
    return Response.success(res, { key: photoKey, imageUrl: publicUrl, url: publicUrl }, 201);
  } catch (error) {
    console.error("Error in uploadBlogImageFromUrl:", error);
    return Response.error(res, "ERROR", "Failed to upload image from URL: " + error.message, 500);
  }
});

const createBlog = asyncHandler(async (req, res) => {
  const { title, content, category, meta_tags, keywords, qa_section, written_by } = req.body; // Added qa_section and written_by
  const author_id = req.user.id;
  let featured_image_url = null;

  if (!title || !content) {
    return Response.error(res, "ERROR", "Please fill all required fields!", 400);
  }

  try {
    if (req.file) {
      const featured_image = req.file;
      const now = new Date();
      const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(featured_image);
      const photoKey = `blogs/${formattedDate}_${baseName}${ext}`;
      await S3Helper.uploadFile(bucket, photoKey, buffer, {
        ContentType: contentType,
      });
      featured_image_url = photoKey;
    }

    const listing_excerpt =
      (typeof req.body.listing_excerpt === "string" && req.body.listing_excerpt.trim()) ||
      buildListingExcerpt(content);

    const blog = await BlogModel.create({
      title,
      content,
      author_id,
      category,
      meta_tags,
      keywords,
      qa_section,
      featured_image: featured_image_url,
      written_by,
      listing_excerpt,
    });

    return Response.success(res, blog, 201);
  } catch (error) {
    console.error("Error in createBlog:", error); // Keep error log for production debugging
    return Response.error(res, "ERROR", "Failed to create blog post: " + error.message, 500);
  }
});

const serveBlogImage = asyncHandler(async (req, res) => {
  const rawKey = req.params.key;
  if (!rawKey) {
    return Response.error(res, "ERROR", "Image key is required.", 400);
  }

  const key = decodeURIComponent(rawKey);

  try {
    const url = await resolveBlogImageUrl(key);
    if (!url) {
      return Response.error(res, "ERROR", "Image not found", 404);
    }
    res.set("Cache-Control", "public, max-age=3600");
    return res.redirect(302, url);
  } catch (error) {
    console.error("Error serving blog image:", error);
    return Response.error(res, "ERROR", "Image not found", 404);
  }
});

const getBlogs = asyncHandler(async (req, res) => {
  try {
    const { category, tag, search, sort_by, page, limit } = req.query;
    const isManager = isManagerBlogRequest(req);
    const options = {
      category,
      tag,
      search,
      sort_by,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || (isManager ? 500 : 10),
      includeInactive: isManager,
    };

    const [blogs, total] = await Promise.all([
      BlogModel.getAllForList(options),
      BlogModel.getCount(options),
    ]);

    // Manager table has no thumbnails — skip S3 presigning (was slowing /manager/blogs).
    if (!isManager) {
      await decorateFeaturedImages(blogs);
    }

    return Response.success(res, {
      blogs,
      pagination: {
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit)
      }
    }, 200);
  } catch (error) {
    console.error("Error in getBlogs:", error); // Keep error log for production debugging
    return Response.error(res, "ERROR", "Failed to fetch blogs: " + error.message, 500);
  }
});

const getBlog = asyncHandler(async (req, res) => {
  try {
    const isManager = isManagerBlogRequest(req);
    const rawId = req.params.id;

    // Accepts either the public slug (external_id) or a numeric id.
    const blog = await BlogModel.getBySlugOrId(rawId);

    if (!blog) {
      return Response.error(res, "ERROR", "Blog not found", 404);
    }
    if (!isManager && !blog.active) {
      return Response.error(res, "ERROR", "Blog not found", 404);
    }

    const [{ prevBlog, nextBlog }, recentSummaries] = await Promise.all([
      BlogModel.getAdjacentBlogs(blog.id, { activeOnly: !isManager }),
      BlogModel.getRecentSummaries(blog.id, 6),
    ]);

    // Externally-hosted images (stored as full URLs) are served directly.
    if (blog.featured_image && /^https?:\/\//i.test(blog.featured_image)) {
      blog.featured_image_key = null;
    } else {
      const key = extractS3Key(blog.featured_image);
      blog.featured_image_key = key;
      if (key) {
        blog.featured_image = await resolveBlogImageUrl(key);
      }
    }

    if (blog.content) {
      blog.content = await rewriteContentImageUrls(blog.content);
    }

    const recentForResponse = recentSummaries.slice(0, 3);
    await decorateFeaturedImages(recentForResponse);

    const responsePayload = {
      ...blog,
      prev_blog_id: prevBlog?.id || null,
      next_blog_id: nextBlog?.id || null,
      prev_blog_slug: prevBlog ? (prevBlog.external_id || prevBlog.id) : null,
      next_blog_slug: nextBlog ? (nextBlog.external_id || nextBlog.id) : null,
      recent_blogs: recentForResponse,
    };

    return Response.success(res, responsePayload, 200);
  } catch (error) {
    console.error("Error in getBlog:", error);
    return Response.error(res, "ERROR", "Failed to fetch blog: " + error.message, 500);
  }
});

const updateBlog = asyncHandler(async (req, res) => {
  console.log("updateBlog function started. Blog ID:", req.params.id);
  const author_id = req.user.id;
  const updateFields = {};

  try {
    const blog = await BlogModel.getById(req.params.id);

    if (!blog) {
      return Response.error(res, "ERROR", "Blog not found", 404);
    }

    const canEditAnyBlog = Number(req.user.role) === ROLE_MANAGER || Number(req.user.role) === ROLE_STAFF;
    if (blog.author_id !== author_id && !canEditAnyBlog) {
      return Response.error(res, "ERROR", "User doesn't have permission to update other user's blog posts", 403);
    }

    // Handle featured image upload first
    let featuredImageKeyToPersist = null;

    if (req.file) {
      console.log("File detected for update, attempting S3 upload.");
      const featured_image = req.file;
      const now = new Date();
      const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(featured_image);
      const photoKey = `blogs/${formattedDate}_${baseName}${ext}`;
      await S3Helper.uploadFile(bucket, photoKey, buffer, {
        ContentType: contentType,
      });
      featuredImageKeyToPersist = photoKey;
      console.log("S3 upload successful for update. Key:", featuredImageKeyToPersist);
    } else if (req.body.featured_image === 'null' || req.body.featured_image === '') { // Frontend might send 'null' string or empty string to clear
      updateFields.featured_image = null;
    } else if (req.body.featured_image_key_to_retain || req.body.featured_image_key || req.body.featured_image_url_to_retain) {
      const retainedValue =
        req.body.featured_image_key_to_retain ||
        req.body.featured_image_key ||
        req.body.featured_image_url_to_retain;
      featuredImageKeyToPersist = extractS3Key(retainedValue);
    }

    if (featuredImageKeyToPersist) {
      updateFields.featured_image = featuredImageKeyToPersist;
    }


    // Dynamically add other fields to updateFields if they are present in req.body
    if (req.body.title !== undefined) updateFields.title = req.body.title;
    if (req.body.content !== undefined) {
      updateFields.content = req.body.content;
      updateFields.listing_excerpt = buildListingExcerpt(req.body.content);
    }
    if (req.body.listing_excerpt !== undefined) {
      const manual = String(req.body.listing_excerpt).trim();
      updateFields.listing_excerpt = manual || buildListingExcerpt(req.body.content || blog.content);
    }
    if (req.body.category !== undefined) updateFields.category = req.body.category;
    if (req.body.meta_tags !== undefined) updateFields.meta_tags = req.body.meta_tags;
    if (req.body.keywords !== undefined) updateFields.keywords = req.body.keywords;
    if (req.body.active !== undefined) updateFields.active = req.body.active;
    if (req.body.written_by !== undefined) updateFields.written_by = req.body.written_by;

    // Handle qa_section - it comes as a JSON string from formData
    if (req.body.qa_section !== undefined) {
      console.log("Received qa_section from frontend:", req.body.qa_section); // Log the raw input
      try {
        const parsedQa = JSON.parse(req.body.qa_section);
        // If the parsed array is empty or contains only empty objects, store as NULL
        if (Array.isArray(parsedQa) && parsedQa.every(item => !item.question && !item.answer)) {
          updateFields.qa_section = null;
        } else {
          updateFields.qa_section = parsedQa;
        }
      } catch (e) {
        console.error("Error parsing qa_section JSON:", e);
        console.error("Problematic qa_section value:", req.body.qa_section); // Log the problematic value
        return Response.error(res, "ERROR", "Invalid JSON format for Q&A section.", 400);
      }
    }

    // Ensure there's something to update
    if (Object.keys(updateFields).length === 0) {
      return Response.error(res, "ERROR", "No fields provided for update.", 400);
    }

    const updatedBlog = await BlogModel.update(req.params.id, updateFields);
    console.log("Blog updated in database. Blog ID:", req.params.id);

    return Response.success(res, updatedBlog, 200);
  } catch (error) {
    console.error("Error in updateBlog:", error);
    return Response.error(res, "ERROR", "Failed to update blog post: " + error.message, 500);
  }
});

const deleteBlog = asyncHandler(async (req, res) => {
  console.log("deleteBlog function started. Blog ID:", req.params.id);
  const author_id = req.user.id;

  try {
    const blog = await BlogModel.getById(req.params.id);

    if (!blog) {
      return Response.error(res, "ERROR", "Blog not found", 404);
    }

    const canEditAnyBlog = Number(req.user.role) === ROLE_MANAGER || Number(req.user.role) === ROLE_STAFF;
    if (blog.author_id !== author_id && !canEditAnyBlog) {
      return Response.error(res, "ERROR", "User doesn't have permission to delete other user's blog posts", 403);
    }

    await BlogModel.delete({ id: req.params.id }); // Pass id as an object for the where clause
    console.log("Blog deleted from database. Blog ID:", req.params.id);

    return Response.success(res, { message: "Blog post deleted successfully" }, 200);
  } catch (error) {
    console.error("Error in deleteBlog:", error);
    return Response.error(res, "ERROR", "Failed to delete blog post: " + error.message, 500);
  }
});

const getCategories = asyncHandler(async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT name, slug FROM blog_categories WHERE active = 1 ORDER BY name ASC');
    console.log("Categories fetched:", rows);
    return Response.success(res, rows, 200);
  } catch (error) {
    console.error("Error in getCategories:", error);
    return Response.error(res, "ERROR", "Failed to fetch categories: " + error.message, 500);
  }
});

const getListingMeta = asyncHandler(async (req, res) => {
  try {
    const [categoriesResult, tagsResult, totalResult] = await Promise.all([
      pool.query(`
      SELECT
        bc.id,
        bc.name,
        bc.slug,
        bc.active,
        COUNT(b.id) AS blog_count
      FROM blog_categories bc
      LEFT JOIN blogs b
        ON LOWER(TRIM(b.category)) = LOWER(TRIM(bc.name))
        AND b.active = 1
      GROUP BY bc.id, bc.name, bc.slug, bc.active
      ORDER BY bc.name ASC
    `),
      pool.query(`
      SELECT id, name, slug, active
      FROM blog_tags
      ORDER BY name ASC
    `),
      pool.query(`SELECT COUNT(*) AS total_blogs FROM blogs WHERE active = 1`),
    ]);

    const categoryRows = categoriesResult[0];
    const tagRows = tagsResult[0];
    const totalRows = totalResult[0];

    return Response.success(
      res,
      {
        categories: categoryRows,
        tags: tagRows,
        total_blogs: totalRows[0]?.total_blogs || 0,
      },
      200
    );
  } catch (error) {
    console.error("Error in getListingMeta:", error);
    return Response.error(res, "ERROR", "Failed to fetch blog listing metadata: " + error.message, 500);
  }
});

module.exports = { createBlog, getBlogs, getBlog, updateBlog, deleteBlog, getCategories, getListingMeta, uploadBlogImage, serveBlogImage, uploadBlogImageFromUrl };
