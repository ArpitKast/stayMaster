'use strict';

/**
 * Smoke test for Scalnex blog adapter (official article._doc + columns format).
 * Run: node scripts/test_scalnex_webhook_adapter.js
 */

const {
  mapScalnexPayloadToBlog,
  stripCodeFences,
  extractFaqItems,
} = require('../services/scalnexBlogAdapter');

process.env.BLOG_WEBHOOK_DEFAULT_ACTIVE = '0';

const officialSample = {
  article: {
    _doc: {
      heading: '10 Summer Outfit Ideas for 2026',
      introText: 'Discover the latest summer fashion trends.',
      tags: ['summer fashion', 'outfits'],
      subURL: 'summer-outfits-2026',
      metaDescription: 'Top summer outfits for 2026',
      metaTitle: 'Summer Outfit Ideas',
      primaryKeyword: 'summer outfits',
      secondaryKeywords: ['outfit ideas', 'fashion trends'],
      pageTitle: 'Best Summer Outfits',
      articleSchemaFormatId: {
        templateName: 'Main Blog Content',
      },
    },
    columns: [
      {
        columnType: 'image',
        sectionPriority: 1,
        content: 'https://example.com/cover.jpg',
      },
      {
        columnType: 'text',
        sectionPriority: 2,
        content: '<h2>Introduction</h2><p>This is the blog intro...</p>',
      },
      {
        columnType: 'faq',
        sectionPriority: 3,
        content: `<div class="faq">
          <div class="faq-item">
            <div class="faq-question">What is summer fashion?</div>
            <div class="faq-answer"><p>Light fabrics and bright colors.</p></div>
          </div>
        </div>`,
      },
      {
        columnType: 'ctaButton',
        sectionPriority: 4,
        content: 'Shop Now',
      },
    ],
  },
};

const mapped = mapScalnexPayloadToBlog(officialSample);

const checks = [
  mapped.title === '10 Summer Outfit Ideas for 2026',
  mapped.external_id === 'summer-outfits-2026',
  mapped.featured_image_url === 'https://example.com/cover.jpg',
  mapped.listing_excerpt === 'Discover the latest summer fashion trends.',
  mapped.meta_tags === 'summer fashion, outfits',
  mapped.keywords?.includes('summer outfits'),
  mapped.content?.includes('<h2>Introduction</h2>'),
  mapped.content?.includes('Discover the latest summer fashion trends.'),
  mapped.qa_section?.length === 1,
  mapped.qa_section?.[0]?.question === 'What is summer fashion?',
  mapped.active === 0,
  mapped.written_by === 'Scalnex (Main Blog Content)',
  stripCodeFences('```html\n<p>Hi</p>\n```') === '<p>Hi</p>',
  extractFaqItems(officialSample.article.columns[2].content).length === 1,
];

if (checks.every(Boolean)) {
  console.log('PASS: Scalnex official payload mapped correctly');
  console.log(JSON.stringify(mapped, null, 2));
  process.exit(0);
}

console.error('FAIL: adapter mapping mismatch');
console.error(
  checks.map((ok, i) => `${i}: ${ok}`).join('\n')
);
console.error(JSON.stringify(mapped, null, 2));
process.exit(1);
