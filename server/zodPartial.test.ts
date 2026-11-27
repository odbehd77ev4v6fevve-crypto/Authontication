import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { toPatchSchema } from './src/utils/zodPartial.ts';

test('toPatchSchema strips Zod v4 defaults on omitted keys while keeping field validators', () => {
  const productLikeSchema = z.object({
    name: z.string().trim().min(2).max(180),
    slug: z.string().trim().min(2).max(200).toLowerCase(),
    description: z.string().trim().max(15000).default(''),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    stockOnHand: z.number().int().min(0).default(0),
    variants: z.array(z.object({ sku: z.string() })).default([]),
    flashSalePrice: z.number().min(0).nullable().optional(),
    brandId: z.string().nullable().optional().default(null),
  });

  const patchSchema = toPatchSchema(productLikeSchema);

  const singleFieldPatch = patchSchema.parse({ flashSalePrice: 499 });
  assert.deepEqual(singleFieldPatch, { flashSalePrice: 499 });
  assert.equal('isActive' in singleFieldPatch, false);
  assert.equal('isFeatured' in singleFieldPatch, false);
  assert.equal('stockOnHand' in singleFieldPatch, false);
  assert.equal('variants' in singleFieldPatch, false);
  assert.equal('description' in singleFieldPatch, false);
  assert.equal('brandId' in singleFieldPatch, false);

  // Explicit false / 0 / null must still be preserved when sent
  const explicitValuesPatch = patchSchema.parse({
    isActive: false,
    stockOnHand: 0,
    brandId: null,
    name: '  Updated Name  ',
    slug: 'UPDATED-SLUG',
  });
  assert.deepEqual(explicitValuesPatch, {
    isActive: false,
    stockOnHand: 0,
    brandId: null,
    name: 'Updated Name',
    slug: 'updated-slug',
  });

  // Invalid provided values still fail validation
  assert.throws(() => patchSchema.parse({ name: 'x' }));
  assert.throws(() => patchSchema.parse({ stockOnHand: -1 }));
});

test('toPatchSchema strips nested defaults inside partial sub-objects (e.g. megaMenuConfig)', () => {
  const megaMenuConfigSchema = z
    .object({
      showSidebar: z.boolean().default(true),
      showGrid: z.boolean().default(true),
      columns: z.enum(['1', '2', '3', '4', 'auto', 'custom']).default('2'),
      sidebarWidthPx: z.number().int().min(180).max(360).default(235),
      sectionOrder: z.array(z.enum(['sidebar', 'grid', 'slider'])).default(['sidebar', 'grid', 'slider']),
    })
    .partial();

  const menuSchema = z.object({
    name: z.string().trim().min(2),
    status: z.enum(['draft', 'active']).default('draft'),
    isVisible: z.boolean().default(true),
    megaMenuConfig: megaMenuConfigSchema.optional(),
  });

  const patchSchema = toPatchSchema(menuSchema);
  const parsed = patchSchema.parse({
    megaMenuConfig: { columns: '3' },
  });

  assert.deepEqual(parsed, {
    megaMenuConfig: { columns: '3' },
  });
  assert.equal('status' in parsed, false);
  assert.equal('isVisible' in parsed, false);
  assert.equal('showSidebar' in (parsed.megaMenuConfig ?? {}), false);
  assert.equal('sidebarWidthPx' in (parsed.megaMenuConfig ?? {}), false);
});

test('toPatchSchema supports .omit() derived schemas (e.g. slideshow without slides)', () => {
  const slideSchema = z.object({
    mainHeading: z.string().min(2),
    isActive: z.boolean().default(true),
  });
  const slideshowSchema = z.object({
    name: z.string().trim().min(2),
    autoplay: z.boolean().default(true),
    transitionDurationMs: z.number().int().min(150).max(3000).default(600),
    isActive: z.boolean().default(true),
    slides: z.array(slideSchema).optional(),
  });

  const patchSlideshow = toPatchSchema(slideshowSchema.omit({ slides: true }));
  const parsed = patchSlideshow.parse({ autoplay: false });
  assert.deepEqual(parsed, { autoplay: false });
  assert.equal('transitionDurationMs' in parsed, false);
  assert.equal('isActive' in parsed, false);
});
