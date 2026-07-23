const BaseModel = require('./baseModel');
const pool = require('../config/dbConnection');

class BlogModel extends BaseModel {
  constructor() {
    super('blogs');
  }

  /**
   * Resolves a blog by its public slug (external_id) or by numeric id.
   * Numeric identifiers are tried as a primary-key lookup first; otherwise
   * (or if that misses) we fall back to matching external_id.
   */
  async getBySlugOrId(identifier) {
    if (identifier === undefined || identifier === null) {
      return null;
    }

    const raw = String(identifier).trim();
    if (!raw) {
      return null;
    }

    if (/^\d+$/.test(raw)) {
      const byId = await this.getById(raw);
      if (byId) {
        return byId;
      }
    }

    const [rows] = await pool.query(
      'SELECT * FROM blogs WHERE external_id = ? ORDER BY id DESC LIMIT 1',
      [raw]
    );
    return rows[0] || null;
  }

  async getAdjacentBlogs(id, { activeOnly = false } = {}) {
    const blogId = parseInt(id, 10);
    if (Number.isNaN(blogId)) {
      return { prevBlog: null, nextBlog: null };
    }

    const activeClause = activeOnly ? ' AND active = 1' : '';

    const prevSql = `
      SELECT id, external_id
      FROM blogs
      WHERE id < ?${activeClause}
      ORDER BY id DESC
      LIMIT 1
    `;

    const nextSql = `
      SELECT id, external_id
      FROM blogs
      WHERE id > ?${activeClause}
      ORDER BY id ASC
      LIMIT 1
    `;

    const [[prevRows], [nextRows]] = await Promise.all([
      pool.query(prevSql, [blogId]),
      pool.query(nextSql, [blogId]),
    ]);

    return {
      prevBlog: prevRows[0] || null,
      nextBlog: nextRows[0] || null,
    };
  }

  /**
   * Lightweight rows for "recent posts" sidebar (no HTML body).
   */
  async getRecentSummaries(excludeId, limit = 4) {
    const exclude = parseInt(excludeId, 10);
    const take = Math.min(Math.max(parseInt(limit, 10) || 4, 1), 12);
    if (Number.isNaN(exclude)) {
      return [];
    }

    const sql = `
      SELECT b.id, b.external_id, b.title, b.category, b.featured_image, b.created_at
      FROM blogs b
      WHERE b.active = 1 AND b.id <> ?
      ORDER BY b.created_at DESC
      LIMIT ?
    `;

    const [rows] = await pool.query(sql, [exclude, take]);
    return rows;
  }

  /**
   * Fetches blogs with filtering, sorting, searching, and pagination.
   */
  _buildListQuery(selectColumns, options) {
    const { category, tag, search, sort_by = 'desc', page = 1, limit = 10, includeInactive = false } = options;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT ${selectColumns}
      FROM blogs b
      LEFT JOIN blog_categories bc ON LOWER(TRIM(b.category)) = LOWER(TRIM(bc.name))
      WHERE 1=1
    `;
    const params = [];

    if (!includeInactive) {
      sql += ` AND b.active = 1`;
    }

    if (category && category !== 'Latest') {
      sql += ` AND bc.slug = ?`;
      params.push(category);
    }

    if (tag) {
      sql += ` AND (meta_tags LIKE ? OR keywords LIKE ?)`;
      params.push(`%${tag}%`, `%${tag}%`);
    }

    if (search) {
      sql += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY created_at ${sort_by.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    return { sql, params };
  }

  async getAllForList(options = {}) {
    const listColumns =
      'b.id, b.external_id, b.title, b.category, b.written_by, b.active, b.created_at, b.featured_image, b.meta_tags, b.keywords, b.listing_excerpt, bc.slug as category_slug';
    const legacyColumns =
      'b.id, b.external_id, b.title, b.category, b.written_by, b.active, b.created_at, b.featured_image, b.meta_tags, b.keywords, bc.slug as category_slug';

    const { sql, params } = this._buildListQuery(listColumns, options);

    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR' && String(error.message).includes('listing_excerpt')) {
        const legacy = this._buildListQuery(legacyColumns, options);
        const [rows] = await pool.query(legacy.sql, legacy.params);
        return rows;
      }
      throw error;
    }
  }

  /**
   * Gets the total count of blogs matching the filters.
   */
  async getCount(options = {}) {
    const { category, tag, search, includeInactive = false } = options;
    
    let sql = `
      SELECT COUNT(*) as total 
      FROM blogs b
      LEFT JOIN blog_categories bc ON LOWER(TRIM(b.category)) = LOWER(TRIM(bc.name))
      WHERE 1=1
    `;
    const params = [];

    if (!includeInactive) {
      sql += ` AND b.active = 1`;
    }

    if (category && category !== 'Latest') {
      sql += ` AND bc.slug = ?`;
      params.push(category);
    }

    if (tag) {
      sql += ` AND (meta_tags LIKE ? OR keywords LIKE ?)`;
      params.push(`%${tag}%`, `%${tag}%`);
    }

    if (search) {
      sql += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    try {
      const [rows] = await pool.query(sql, params);
      return rows[0].total;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = BlogModel;
