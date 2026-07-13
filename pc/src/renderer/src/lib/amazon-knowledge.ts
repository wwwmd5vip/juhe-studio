/**
 * Amazon 图片规范知识库
 * 从 amazon-image-studio 移植，作为 AI 策划时的参考材料
 */

const LISTING_REFERENCE_NOTES = [
  'Source summary: current project knowledge files for Amazon product images. Treat this as reference material for judgment, not a fixed creative template.',
  'Every product needs a compliant MAIN image; a strong gallery usually adds about 6 secondary images.',
  'Image technical baseline: clear, non-pixelated product images; supported formats include JPEG/JPG, PNG, TIFF, and non-animated GIF; the longest side should be 500-10,000 px.',
  'MAIN image: accurately show the real sold product with truthful color, proportion, quantity, and included accessories; use a seamless pure white background RGB 255,255,255; product fills about 85% of the frame.',
  'MAIN image exclusions: no text, logo, watermark, border, color block, graphic overlay, badge, prop, support stand, confusing accessory, extra item, duplicate product view, or packaging unless packaging is an actual product feature.',
  'All listing images should match the product title and only show what is sold. Avoid nudity, buyer reviews, five-star ratings, pricing, coupons, free shipping claims.',
  'Do not use Amazon, Prime, Alexa, Amazon Choice, Premium Choice, Best Seller badges or marketplace marks.',
  'Secondary images may use lifestyle, detail, scale, contents, comparison, or use-step concepts. On-image copy should be concise, US-English, defensible, and readable on mobile.',
]

const APLUS_REFERENCE_NOTES = [
  'Source summary: A+ content rules and US A+ module image sizes. Treat this as reference material, not a fixed template.',
  'A+ technical baseline: RGB JPG/PNG/BMP, at least 72 dpi, sharp and non-blurry, under 2 MB per upload, no animation, no watermark, no tiny text.',
  'Standard A+ upload sizes: Header Banner 970x300, Single Image 970x600, Logo Image 600x180, Highlight Tile 220x220, Comparison Thumbnail 150x300.',
  'Premium A+ upload sizes: Hero Banner 1464x600, Single/Feature Image 970x600, Logo Image 600x180, Brand Story module image around 463x625.',
  'Mobile A+ modules: five compact 600x450 modules (1 hero + 4 feature images). Use short mobile-readable copy.',
  'Design: keep key content in central safe area, mobile-readable copy, clear hierarchy, balanced spacing, coherent lighting/color/composition.',
  'A+ should be unique to the product and brand story; avoid reusing listing carousel images.',
  'Avoid prices, discounts, QR codes, phone numbers, email addresses, external URLs, customer reviews, star ratings, competitor mentions.',
  'Do not mimic Amazon page UI or use Amazon/Prime/Alexa badges.',
]

function formatReferenceMaterial(title: string, notes: readonly string[]): string {
  return [title, ...notes.map((note) => `- ${note}`)].join('\n')
}

export function formatAmazonListingReferenceMaterial(): string {
  return formatReferenceMaterial('Amazon Listing reference material for the planner:', LISTING_REFERENCE_NOTES)
}

export function formatAmazonAPlusReferenceMaterial(): string {
  return formatReferenceMaterial('Amazon A+ reference material for the planner:', APLUS_REFERENCE_NOTES)
}
