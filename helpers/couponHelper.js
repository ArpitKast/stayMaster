const ALPHA_NUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const randomSegment = (length = 6) => {
  let segment = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHA_NUMERIC.length);
    segment += ALPHA_NUMERIC[index];
  }
  return segment;
};

const generateRandomCouponCode = (bookingId) => {
  const normalizedId = bookingId ? String(bookingId).trim() : '';
  return `STM${normalizedId}${randomSegment()}`;
};

const generateRandomDiscount = () => {
  return 10; // Fixed 10% discount for booking coupons
};

module.exports = {
  generateRandomCouponCode,
  generateRandomDiscount,
  randomSegment,
};
