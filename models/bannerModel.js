const BaseModel = require('./baseModel');

class BannerModel extends BaseModel {
  constructor() {
    super('banners');
  }

  // You can add any banner-specific database methods here.
}

module.exports = BannerModel;
