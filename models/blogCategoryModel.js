const BaseModel = require('./baseModel');

class BlogCategoryModel extends BaseModel {
  constructor() {
    super('blog_categories');
  }
}

module.exports = BlogCategoryModel;
