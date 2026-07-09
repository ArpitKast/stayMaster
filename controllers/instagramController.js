const asyncHandler = require('express-async-handler');
const Response = require("../helpers/responseHelper");
const axios = require('axios');

const fallbackThumbnail = 'https://example.com/reels/fallback-thumbnail.jpg';
const cacheTtlMs = Number(process.env.INSTAGRAM_CACHE_TTL_MS || 86400000);

let reelsCache = null;
let reelsCacheAt = 0;

const fetchInstagramReels = async () => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    const error = new Error('Instagram access token is missing.');
    error.status = 500;
    throw error;
  }
  console.log('Fetching Instagram reels from API...');

  const response = await axios.get('https://graph.instagram.com/me/media', {
    params: {
      fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,views_count,duration',
      access_token: token
    },
    timeout: 10000
  });

  const items = response?.data?.data ?? [];
  const reelsOnly = items.filter((item) => {
    const mediaType = item?.media_type;
    const productType = item?.media_product_type;
    return productType === 'REELS' || mediaType === 'VIDEO';
  });

  return reelsOnly;
};

const getReels = asyncHandler(async (req, res) => {
  const now = Date.now();
  if (reelsCache && now - reelsCacheAt < cacheTtlMs) {
    
  console.log('Fetching Instagram reels from Cache...');
    return Response.success(res, {
      data: reelsCache
    }, 200);
  }

  try {
    const data = await fetchInstagramReels();
    reelsCache = data;
    reelsCacheAt = now;

    return Response.success(res, {
      data
    }, 200);
  } catch (error) {
    const status = error?.status || 502;
    return Response.error(res, "ERROR", error?.message || 'Failed to fetch Instagram reels.', status);
  }
});

module.exports = {
  getReels
};
