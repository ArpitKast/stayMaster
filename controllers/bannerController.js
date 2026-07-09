const asyncHandler = require("express-async-handler");
const Banner = require("../models/bannerModel");
const BannerModel = new Banner();
const S3Helper = require("../helpers/s3Helper");
const Response = require("../helpers/responseHelper");
const SettingModel = require("../models/settingModel");
const bucket = process.env.AWS_BUCKET;
const ImageHelper = require('../helpers/imageHelper');
const { propertyImageBaseUrl, hasUsableCdnBaseUrl, buildCdnUrl } = require('../config/cdnConfig');

const LEAD_FORM_IMAGE_SETTING = 'lead_form_image';
const LEAD_FORM_IMAGE_CATEGORY = 'lead_form';

const settingsModel = new SettingModel();

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

const buildBannerImageUrl = (req, key) => {
  if (hasUsableCdnBaseUrl) {
    return buildCdnUrl(key);
  }

  // Check for environment variable first (for production)
  if (process.env.BASE_URL) {
    // Remove trailing slash if present
    const cleanBaseUrl = process.env.BASE_URL.replace(/\/$/, '');
    return `${cleanBaseUrl}/api/banners/images/${encodeURIComponent(key)}`;
  }
  
  // Fallback to request headers (for development)
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  // Check x-forwarded-host first (for proxies/load balancers), then fallback to host
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${protocol}://${host}/api/banners/images/${encodeURIComponent(key)}`;
};

const uploadBannerImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return Response.error(res, "ERROR", "Image file is required.", 400);
  }

  try {
    const banner_image = req.file;
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(banner_image, { width: 1920 });
    const photoKey = `banners/${formattedDate}_${baseName}${ext}`;
    const uploadResult = await S3Helper.uploadFile(bucket, photoKey, buffer, {
      ContentType: contentType,
    });

    if (!uploadResult) {
      throw new Error("Failed to upload image to storage.");
    }

    const publicUrl = buildBannerImageUrl(req, photoKey);

    return Response.success(res, {
      key: photoKey,
      imageUrl: publicUrl,
      url: publicUrl,
    }, 201);
  } catch (error) {
    console.error("Error in uploadBannerImage:", error);
    return Response.error(res, "ERROR", "Failed to upload banner image: " + error.message, 500);
  }
});

const createBanner = asyncHandler(async (req, res) => {
  const { title, description, link, order, active } = req.body;
  let image_url = null;

  if (!req.file) {
    return Response.error(res, "ERROR", "Banner image is required.", 400);
  }

  try {
    const banner_image = req.file;
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(banner_image, { width: 1920 });
    const photoKey = `banners/${formattedDate}_${baseName}${ext}`;
    await S3Helper.uploadFile(bucket, photoKey, buffer, {
      ContentType: contentType,
    });
    image_url = photoKey;

    const bannerData = {
      title: title || null,
      description: description || null,
      image_url: image_url,
      link: link || null,
      order: order ? parseInt(order) : 0,
      active: active !== undefined ? (active === 'true' || active === true ? 1 : 0) : 1,
    };

    const bannerId = await BannerModel.create(bannerData);
    const banner = await BannerModel.getById(bannerId);

    // Build image URL for response
    const key = extractS3Key(banner.image_url);
    banner.image_url_key = key;
    if (key) {
      banner.image_url = buildBannerImageUrl(req, key);
    }

    return Response.success(res, banner, 201);
  } catch (error) {
    console.error("Error in createBanner:", error);
    return Response.error(res, "ERROR", "Failed to create banner: " + error.message, 500);
  }
});

const serveBannerImage = asyncHandler(async (req, res) => {
  const rawKey = req.params.key;
  if (!rawKey) {
    return Response.error(res, "ERROR", "Image key is required.", 400);
  }

  const key = decodeURIComponent(rawKey);

  try {
    const file = await S3Helper.getObject(bucket, key);
    res.set('Content-Type', file.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.Body);
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      console.warn(`Banner image not found in S3: ${key}`);
    } else {
      console.error(`Error serving banner image (${key}):`, error.message);
    }
    return Response.error(res, "ERROR", "Image not found", 404);
  }
});

const getBanners = asyncHandler(async (req, res) => {
  try {
    const { active_only } = req.query;
    let banners;
    
    if (active_only === 'true') {
      banners = await BannerModel.select('banners', { active: 1 });
      // Sort by order
      banners.sort((a, b) => (a.order || 0) - (b.order || 0));
    } else {
      banners = await BannerModel.getAll();
      // Sort by order
      banners.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    for (let i = 0; i < banners.length; i++) {
      const key = extractS3Key(banners[i].image_url);
      banners[i].image_url_key = key;
      if (key) {
        banners[i].image_url = buildBannerImageUrl(req, key);
      }
    }

    let leadBanner = { url: null, key: null, alt: 'Lead banner' };
    const setting = await settingsModel.getSettingValue(
      LEAD_FORM_IMAGE_SETTING,
      LEAD_FORM_IMAGE_CATEGORY
    );
    if (setting && setting.value) {
      const leadBannerUrl = await S3Helper.generatePreSignedUrl(process.env.AWS_BUCKET, setting.value);
      leadBanner = {
        url: leadBannerUrl || null,
        key: setting.value,
        alt: 'Lead banner'
      };
    }

    return Response.success(res, { banners, lead_banner: leadBanner }, 200);
  } catch (error) {
    console.error("Error in getBanners:", error);
    return Response.error(res, "ERROR", "Failed to fetch banners: " + error.message, 500);
  }
});

const getBanner = asyncHandler(async (req, res) => {
  try {
    const banner = await BannerModel.getById(req.params.id);
    if (!banner) {
      return Response.error(res, "ERROR", "Banner not found", 404);
    }

    const key = extractS3Key(banner.image_url);
    banner.image_url_key = key;
    if (key) {
      banner.image_url = buildBannerImageUrl(req, key);
    }

    return Response.success(res, banner, 200);
  } catch (error) {
    console.error("Error in getBanner:", error);
    return Response.error(res, "ERROR", "Failed to fetch banner: " + error.message, 500);
  }
});

const updateBanner = asyncHandler(async (req, res) => {
  const updateFields = {};

  try {
    const banner = await BannerModel.getById(req.params.id);

    if (!banner) {
      res.status(404);
      throw new Error("Banner not found");
    }

    // Handle image upload first
    let imageKeyToPersist = null;

    if (req.file) {
      const banner_image = req.file;
      const now = new Date();
      const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(banner_image, { width: 1920 });
      const photoKey = `banners/${formattedDate}_${baseName}${ext}`;
      await S3Helper.uploadFile(bucket, photoKey, buffer, {
        ContentType: contentType,
      });
      imageKeyToPersist = photoKey;
    } else if (req.body.image_url === 'null' || req.body.image_url === '') {
      updateFields.image_url = null;
    } else if (req.body.image_url_key_to_retain || req.body.image_url_key || req.body.image_url_url_to_retain) {
      const retainedValue =
        req.body.image_url_key_to_retain ||
        req.body.image_url_key ||
        req.body.image_url_url_to_retain;
      imageKeyToPersist = extractS3Key(retainedValue);
    }

    if (imageKeyToPersist) {
      updateFields.image_url = imageKeyToPersist;
    }

    // Dynamically add other fields to updateFields if they are present in req.body
    if (req.body.title !== undefined) updateFields.title = req.body.title;
    if (req.body.description !== undefined) updateFields.description = req.body.description;
    if (req.body.link !== undefined) updateFields.link = req.body.link;
    if (req.body.order !== undefined) updateFields.order = parseInt(req.body.order);
    if (req.body.active !== undefined) {
      updateFields.active = req.body.active === 'true' || req.body.active === true ? 1 : 0;
    }

    // Ensure there's something to update
    if (Object.keys(updateFields).length === 0) {
      return Response.error(res, "ERROR", "No fields provided for update.", 400);
    }

    await BannerModel.update(req.params.id, updateFields);
    const updatedBanner = await BannerModel.getById(req.params.id);

    // Build image URL for response
    const key = extractS3Key(updatedBanner.image_url);
    updatedBanner.image_url_key = key;
    if (key) {
      updatedBanner.image_url = buildBannerImageUrl(req, key);
    }

    return Response.success(res, updatedBanner, 200);
  } catch (error) {
    console.error("Error in updateBanner:", error);
    return Response.error(res, "ERROR", "Failed to update banner: " + error.message, 500);
  }
});

const deleteBanner = asyncHandler(async (req, res) => {
  try {
    const banner = await BannerModel.getById(req.params.id);

    if (!banner) {
      res.status(404);
      throw new Error("Banner not found");
    }

    // Optionally delete the image from S3
    if (banner.image_url) {
      const key = extractS3Key(banner.image_url);
      if (key) {
        try {
          await S3Helper.deleteFile(bucket, key);
        } catch (error) {
          console.error("Error deleting banner image from S3:", error);
          // Continue with database deletion even if S3 deletion fails
        }
      }
    }

    await BannerModel.delete({ id: req.params.id });

    return Response.success(res, { message: "Banner deleted successfully" }, 200);
  } catch (error) {
    console.error("Error in deleteBanner:", error);
    return Response.error(res, "ERROR", "Failed to delete banner: " + error.message, 500);
  }
});

// Admin view methods
const index = asyncHandler(async (req, res) => {
  try {
    const banners = await BannerModel.getAll();
    banners.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    for (let i = 0; i < banners.length; i++) {
      const key = extractS3Key(banners[i].image_url);
      banners[i].image_url_key = key;
      if (key) {
        banners[i].image_url = buildBannerImageUrl(req, key);
      }
    }
    
    const flash = req.params.flash || '';
    const setting = await settingsModel.getSettingValue(
      LEAD_FORM_IMAGE_SETTING,
      LEAD_FORM_IMAGE_CATEGORY
    );
    let leadFormImageUrl = '';
    if (setting && setting.value) {
      leadFormImageUrl = await S3Helper.generatePreSignedUrl(process.env.AWS_BUCKET, setting.value);
    }
    res.render('banners/list', { banners, flash, leadFormImageUrl });
  } catch (error) {
    console.error("Error in index:", error);
    res.status(500).render('banners/list', { banners: [], flash: 'Error loading banners', leadFormImageUrl: '' });
  }
});

const add = asyncHandler(async (req, res) => {
  res.render('banners/add');
});

const edit = asyncHandler(async (req, res) => {
  try {
    const banner = await BannerModel.getById(req.params.id);
    if (!banner) {
      return res.status(404).render('error', { message: 'Banner not found' });
    }

    const key = extractS3Key(banner.image_url);
    banner.image_url_key = key;
    if (key) {
      banner.image_url = buildBannerImageUrl(req, key);
    }

    res.render('banners/edit', { banner });
  } catch (error) {
    console.error("Error in edit:", error);
    res.status(500).render('error', { message: 'Error loading banner' });
  }
});

// Admin CRUD methods (using cookie auth)
const createBannerAdmin = async (req, res) => {
  try {
    const { title, description, link, order, active } = req.body;
    let image_url = null;

    if (!req.file) {
      return Response.error(res, "ERROR", "Banner image is required.", 400);
    }

    const banner_image = req.file;
    const now = new Date();
    const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(banner_image, { width: 1920 });
    const photoKey = `banners/${formattedDate}_${baseName}${ext}`;
    await S3Helper.uploadFile(bucket, photoKey, buffer, {
      ContentType: contentType,
    });
    image_url = photoKey;

    const bannerData = {
      title: title || null,
      description: description || null,
      image_url: image_url,
      link: link || null,
      order: order ? parseInt(order) : 0,
      active: active !== undefined ? (active === 'true' || active === true ? 1 : 0) : 1,
    };

    await BannerModel.create(bannerData);
    return Response.success(res, { flash: 'Banner created successfully' }, 200);
  } catch (error) {
    console.error("Error in createBannerAdmin:", error);
    return Response.error(res, "ERROR", "Failed to create banner: " + (error.message || 'Unknown error'), 400);
  }
};

const updateBannerAdmin = async (req, res) => {
  try {
    const updateFields = {};
    const banner = await BannerModel.getById(req.params.id);

    if (!banner) {
      return Response.error(res, "ERROR", "Banner not found", 404);
    }

    // Handle image upload first
    let imageKeyToPersist = null;

    if (req.file) {
      const banner_image = req.file;
      const now = new Date();
      const formattedDate = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const { buffer, ext, baseName, contentType } = await ImageHelper.processUpload(banner_image, { width: 1920 });
      const photoKey = `banners/${formattedDate}_${baseName}${ext}`;
      await S3Helper.uploadFile(bucket, photoKey, buffer, {
        ContentType: contentType,
      });
      imageKeyToPersist = photoKey;
    } else if (req.body.image_url === 'null' || req.body.image_url === '') {
      updateFields.image_url = null;
    } else if (req.body.image_url_key_to_retain || req.body.image_url_key || req.body.image_url_url_to_retain) {
      const retainedValue =
        req.body.image_url_key_to_retain ||
        req.body.image_url_key ||
        req.body.image_url_url_to_retain;
      imageKeyToPersist = extractS3Key(retainedValue);
    }

    if (imageKeyToPersist) {
      updateFields.image_url = imageKeyToPersist;
    }

    // Dynamically add other fields to updateFields if they are present in req.body
    if (req.body.title !== undefined) updateFields.title = req.body.title;
    if (req.body.description !== undefined) updateFields.description = req.body.description;
    if (req.body.link !== undefined) updateFields.link = req.body.link;
    if (req.body.order !== undefined) updateFields.order = parseInt(req.body.order);
    if (req.body.active !== undefined) {
      updateFields.active = req.body.active === 'true' || req.body.active === true ? 1 : 0;
    }

    // Ensure there's something to update
    if (Object.keys(updateFields).length === 0) {
      return Response.error(res, "ERROR", "No fields provided for update.", 400);
    }

    await BannerModel.update(req.params.id, updateFields);
    return Response.success(res, { flash: 'Banner updated successfully' }, 200);
  } catch (error) {
    console.error("Error in updateBannerAdmin:", error);
    return Response.error(res, "ERROR", "Failed to update banner: " + (error.message || 'Unknown error'), 400);
  }
};

const deleteBannerAdmin = async (req, res) => {
  try {
    const banner = await BannerModel.getById(req.params.id);

    if (!banner) {
      return Response.error(res, "ERROR", "Banner not found", 404);
    }

    // Optionally delete the image from S3
    if (banner.image_url) {
      const key = extractS3Key(banner.image_url);
      if (key) {
        try {
          await S3Helper.deleteFile(bucket, key);
        } catch (error) {
          console.error("Error deleting banner image from S3:", error);
          // Continue with database deletion even if S3 deletion fails
        }
      }
    }

    await BannerModel.delete({ id: req.params.id });
    return Response.success(res, { flash: 'Banner deleted successfully' }, 200);
  } catch (error) {
    console.error("Error in deleteBannerAdmin:", error);
    return Response.error(res, "ERROR", "Failed to delete banner: " + (error.message || 'Unknown error'), 400);
  }
};

module.exports = {
  createBanner,
  getBanners,
  getBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImage,
  serveBannerImage,
  index,
  add,
  edit,
  createBannerAdmin,
  updateBannerAdmin,
  deleteBannerAdmin,
};
