const BaseModel = require('./baseModel');

class BlogTagModel extends BaseModel {
  constructor() {
    super('blog_tags');
  }
}

module.exports = BlogTagModel;
