'use strict';

const crypto = require('crypto');

const EXTERNAL_SOURCE = 'scalnex';

const HTML_BLOCK_TYPES = new Set(['text', 'html', 'code', 'table', 'quote', 'testimonial']);

/**
 * Strip ```lang ... ``` fences from Scalnex column content.
 */
function stripCodeFences(str = '') {
  if (typeof str !== 'string') {
    return '';
  }
  const fenced = str.match(/^```\w*\s*\n([\s\S]*?)\n```\s*$/);
  return fenced ? fenced[1] : str;
}

/**
 * Return first defined value from payload using candidate keys (supports nested paths).
 */
function pickField(payload, keys) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  for (const key of keys) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let cur = payload;
      let found = true;
      for (const part of parts) {
        if (cur == null || typeof cur !== 'object' || !(part in cur)) {
          found = false;
          break;
        }
        cur = cur[part];
      }
      if (found && cur !== undefined && cur !== null && cur !== '') {
        return cur;
      }
      continue;
    }

    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
      return payload[key];
    }
  }

  return undefined;
}

function normalizeTags(value) {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(', ');
  }
  return String(value).trim() || null;
}

function buildListingExcerpt(htmlOrText) {
  if (!htmlOrText || typeof htmlOrText !== 'string') {
    return null;
  }
  const plain = htmlOrText
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) {
    return null;
  }
  const max = 280;
  if (plain.length <= max) {
    return plain;
  }
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/**
 * Extract FAQ pairs from Scalnex FAQ HTML markup.
 * @returns {Array<{question: string, answer: string}>}
 */
function extractFaqItems(html) {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const items = [];
  const itemPattern =
    /<div[^>]*class="[^"]*faq-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*faq-item|$)/gi;

  let itemMatch;
  while ((itemMatch = itemPattern.exec(html)) !== null) {
    const chunk = itemMatch[1];
    const questionMatch = chunk.match(
      /<div[^>]*class="[^"]*faq-question[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const answerMatch = chunk.match(
      /<div[^>]*class="[^"]*faq-answer[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );

    if (!questionMatch) {
      continue;
    }

    const question = questionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const answer = answerMatch ? answerMatch[1].trim() : '';

    if (question) {
      items.push({ question, answer });
    }
  }

  return items;
}

function renderImageBlock(url) {
  const safe = String(url).trim();
  if (!safe) {
    return '';
  }
  return `<figure class="blog-image"><img src="${safe}" alt="" loading="lazy" /></figure>`;
}

function renderCtaButton(label) {
  const text = String(label).trim();
  if (!text) {
    return '';
  }
  return `<p class="cta-button-wrap"><span class="cta-button">${text}</span></p>`;
}

/**
 * Build HTML body, cover image URL, and FAQ section from Scalnex article.columns.
 */
function buildContentFromColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return { content: '', featured_image_url: null, qa_section: null };
  }

  const ordered = [...columns].sort(
    (a, b) => (a.sectionPriority ?? 0) - (b.sectionPriority ?? 0)
  );

  const htmlParts = [];
  const faqItems = [];
  let featured_image_url = null;

  for (const block of ordered) {
    const type = String(block.columnType || '').toLowerCase();
    const raw = block.content ?? '';

    if (type === 'image') {
      const url = String(raw).trim();
      if (!url) {
        continue;
      }
      if (!featured_image_url) {
        featured_image_url = url;
      } else {
        htmlParts.push(renderImageBlock(url));
      }
      continue;
    }

    if (type === 'faq') {
      const html = stripCodeFences(raw);
      if (html) {
        htmlParts.push(html);
        const extracted = extractFaqItems(html);
        if (extracted.length > 0) {
          faqItems.push(...extracted);
        }
      }
      continue;
    }

    if (type === 'ctabutton') {
      const btn = renderCtaButton(stripCodeFences(raw));
      if (btn) {
        htmlParts.push(btn);
      }
      continue;
    }

    if (HTML_BLOCK_TYPES.has(type)) {
      const html = stripCodeFences(raw);
      if (html) {
        htmlParts.push(html);
      }
    }
  }

  return {
    content: htmlParts.join('\n'),
    featured_image_url,
    qa_section: faqItems.length > 0 ? faqItems : null,
  };
}

function buildKeywordsFromDoc(doc) {
  const parts = [];
  if (doc.primaryKeyword) {
    parts.push(String(doc.primaryKeyword).trim());
  }
  if (Array.isArray(doc.secondaryKeywords)) {
    parts.push(...doc.secondaryKeywords.map(String).filter(Boolean));
  }
  if (doc.metaTitle && !parts.includes(doc.metaTitle)) {
    parts.push(String(doc.metaTitle).trim());
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Map official Scalnex payload: { article: { _doc, columns } }
 */
function mapScalnexArticlePayload(payload) {
  const article = payload.article;
  const doc = article._doc || {};
  const tags = Array.isArray(doc.tags) ? doc.tags : [];

  const { content: columnContent, featured_image_url: columnImageUrl, qa_section } = buildContentFromColumns(
    article.columns
  );

  // Prefer an image block from columns; otherwise fall back to a featured image on _doc.
  const featured_image_url =
    columnImageUrl ||
    doc.featured_image ||
    doc.featuredImage ||
    doc.image ||
    doc.coverImage ||
    doc.thumbnail ||
    null;

  const introText = doc.introText ? String(doc.introText).trim() : '';
  const contentParts = [];
  if (introText) {
    contentParts.push(`<p>${introText}</p>`);
  }
  if (columnContent) {
    contentParts.push(columnContent);
  }
  const content = contentParts.join('\n');

  const title = doc.heading ? String(doc.heading).trim() : null;
  const subURL = doc.subURL ? String(doc.subURL).trim() : null;

  let external_id = subURL;
  if (!external_id && title) {
    external_id = crypto.createHash('sha256').update(title).digest('hex').slice(0, 32);
  }

  const activeDefault = process.env.BLOG_WEBHOOK_DEFAULT_ACTIVE;
  const active =
    activeDefault === '1' || activeDefault === 1 || activeDefault === true ? 1 : 0;

  const category =
    tags[0] ||
    process.env.SCALNEX_WEBHOOK_DEFAULT_CATEGORY ||
    'Blog';

  const templateName = doc.articleSchemaFormatId?.templateName;

  return {
    title,
    content: content || null,
    listing_excerpt: introText || buildListingExcerpt(content),
    category: String(category).trim(),
    meta_tags: normalizeTags(tags),
    keywords: buildKeywordsFromDoc(doc) || (doc.metaDescription ? String(doc.metaDescription).trim() : null),
    written_by: templateName ? `Scalnex (${templateName})` : 'Scalnex',
    featured_image_url,
    qa_section,
    active,
    external_source: EXTERNAL_SOURCE,
    external_id,
    event_type: pickField(payload, ['event', 'event_type', 'type']) || 'blog.published',
    sub_url: subURL,
    meta_title: doc.metaTitle || doc.pageTitle || null,
    meta_description: doc.metaDescription || null,
  };
}

/**
 * Map flat/legacy webhook JSON (backward compatible).
 */
function mapFlatScalnexPayload(payload) {
  const title = pickField(payload, ['title', 'name', 'headline']);
  const content = pickField(payload, ['content', 'body', 'html', 'description']);
  const excerpt = pickField(payload, ['excerpt', 'summary', 'short_description', 'listing_excerpt']);
  const category =
    pickField(payload, ['category', 'category_name', 'section']) ||
    process.env.SCALNEX_WEBHOOK_DEFAULT_CATEGORY ||
    'Blog';
  const metaTags = normalizeTags(pickField(payload, ['tags', 'meta_tags']));
  const keywords = pickField(payload, ['keywords', 'seo_keywords', 'meta_keywords']);
  const writtenBy = pickField(payload, ['author', 'written_by', 'author_name']) || 'Scalnex';
  const featuredImageUrl = pickField(payload, [
    'featured_image_url',
    'featured_image',
    'image',
    'image_url',
    'thumbnail',
    'thumbnail_url',
  ]);
  const externalId = pickField(payload, ['id', 'article_id', 'post_id', 'external_id', 'subURL']);
  const eventType = pickField(payload, ['event', 'event_type', 'type']);

  let qaSection = null;
  const rawFaq = pickField(payload, ['faq', 'qa_section', 'questions']);
  if (Array.isArray(rawFaq)) {
    qaSection = rawFaq;
  }

  const titleStr = title ? String(title).trim() : null;
  const contentStr = content ? String(content) : null;

  let resolvedExternalId = externalId != null ? String(externalId).trim() : null;
  if (!resolvedExternalId && titleStr) {
    resolvedExternalId = crypto.createHash('sha256').update(titleStr).digest('hex').slice(0, 32);
  }

  const activeDefault = process.env.BLOG_WEBHOOK_DEFAULT_ACTIVE;
  const active =
    activeDefault === '1' || activeDefault === 1 || activeDefault === true ? 1 : 0;

  return {
    title: titleStr,
    content: contentStr,
    listing_excerpt:
      (typeof excerpt === 'string' && excerpt.trim()) || buildListingExcerpt(contentStr),
    category: String(category).trim(),
    meta_tags: metaTags,
    keywords: keywords != null ? String(keywords).trim() : null,
    written_by: String(writtenBy).trim(),
    featured_image_url: featuredImageUrl ? String(featuredImageUrl).trim() : null,
    qa_section: qaSection,
    active,
    external_source: EXTERNAL_SOURCE,
    external_id: resolvedExternalId,
    event_type: eventType != null ? String(eventType) : null,
    sub_url: null,
    meta_title: null,
    meta_description: null,
  };
}

/**
 * Map Scalnex webhook JSON to Staymaster blog fields.
 * Supports official { article: { _doc, columns } } and flat legacy payloads.
 */
function mapScalnexPayloadToBlog(payload) {
  if (payload?.article?._doc || Array.isArray(payload?.article?.columns)) {
    return mapScalnexArticlePayload(payload);
  }
  return mapFlatScalnexPayload(payload);
}

module.exports = {
  EXTERNAL_SOURCE,
  mapScalnexPayloadToBlog,
  pickField,
  buildListingExcerpt,
  stripCodeFences,
  buildContentFromColumns,
  extractFaqItems,
};
