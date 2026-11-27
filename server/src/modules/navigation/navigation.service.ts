import mongoose from 'mongoose';
import {
  buildMegaMenuItemTree,
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_PLACEMENT_DEFINITIONS,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  filterActiveMegaMenuSlides,
  getMegaMenuTemplatePreset,
  isMenuScheduledActive,
  resolveDynamicCategoryHierarchy,
  type MegaMenuSlideRecord,
  type NavigationItemRecord,
  type NavigationMenuRecord,
  type NavigationPlacementKey,
  type ResolvedNavProduct,
} from '../../../../shared/megaMenuHelpers.ts';
import { resolveEffectiveUnitPrice } from '../../../../shared/pricing.ts';
import {
  BrandModel,
  CategoryModel,
  CollectionModel,
  ProductModel,
} from '../catalog/catalog.model.ts';
import { BlogPostModel, StaticPageModel } from '../cms/cms.model.ts';
import { CampaignModel } from '../marketing/marketing.model.ts';
import {
  getCachedNavigation,
  getNavigationCacheKey,
  setCachedNavigation,
} from './navigation.cache.ts';
import {
  MegaMenuSlideModel,
  NavigationItemModel,
  NavigationMenuModel,
  NavigationPlacementModel,
  type INavigationMenu,
} from './navigation.model.ts';

function toResolvedProduct(p: Record<string, unknown>, now: Date): ResolvedNavProduct {
  const priceInfo = resolveEffectiveUnitPrice(
    {
      basePrice: Number(p.basePrice ?? 0),
      salePrice: p.salePrice as number | null | undefined,
      flashSalePrice: p.flashSalePrice as number | null | undefined,
      flashSaleStart: p.flashSaleStart as Date | string | null | undefined,
      flashSaleEnd: p.flashSaleEnd as Date | string | null | undefined,
    },
    now
  );
  const images = Array.isArray(p.images) ? (p.images as Array<{ url?: string }>) : [];
  return {
    _id: String(p._id),
    name: String(p.name || 'Product'),
    slug: String(p.slug || ''),
    imageUrl: images[0]?.url || '/src/assets/images/product_smartphone_pro_1795621230630.jpg',
    effectivePrice: priceInfo.unitPrice,
    originalPrice: priceInfo.originalPrice,
    discountPercent: priceInfo.discountPercent,
    isFlashSaleActive: priceInfo.isFlashSaleActive,
    ratingAverage: Number(p.ratingAverage ?? 0),
  };
}

let seedPromise: Promise<void> | null = null;

export async function ensureDefaultNavigationDocuments(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // Ensure placement definitions exist
      const existingPlacements = await NavigationPlacementModel.find().select('key').lean();
      const existingKeys = new Set(existingPlacements.map((p) => String(p.key)));
      const missingPlacements = DEFAULT_PLACEMENT_DEFINITIONS.filter((p) => !existingKeys.has(p.key));
      if (missingPlacements.length > 0) {
        await NavigationPlacementModel.insertMany(missingPlacements);
      }

      const menuCount = await NavigationMenuModel.countDocuments();
      if (menuCount > 0) {
        return;
      }

      const modernGreenAppearance = getMegaMenuTemplatePreset('modern_green');

      const [allCatsMenu, headerMainMenu, shopMenu, dealsMenu, footerMenu, mobileMenu] =
        await Promise.all([
          NavigationMenuModel.create({
            name: 'All Categories Mega Menu',
            slug: 'all-categories-mega-menu',
            menuType: 'category_mega_menu',
            placement: 'all_categories',
            description:
              'Primary 3-part green-and-white category mega menu matching the storefront header.',
            status: 'published',
            visibility: 'public',
            displayOrder: 0,
            categoryMode: 'auto',
            maxDepth: 3,
            megaMenuConfig: {
              ...DEFAULT_MEGA_MENU_LAYOUT,
              showSidebar: true,
              showGrid: true,
              showSlider: true,
              columns: '2',
              showHelpCard: true,
              helpCardTitle: 'Need Help?',
              helpCardPhone: '+880 1234 567890',
            },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
          NavigationMenuModel.create({
            name: 'Main Header Navigation',
            slug: 'main-header-navigation',
            menuType: 'nested_dropdown',
            placement: 'header_main',
            description: 'Primary horizontal links rendered in the storefront navigation bar.',
            status: 'published',
            visibility: 'public',
            displayOrder: 0,
            categoryMode: 'manual',
            maxDepth: 3,
            megaMenuConfig: {
              ...DEFAULT_MEGA_MENU_LAYOUT,
              showSidebar: false,
              showSlider: false,
            },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
          NavigationMenuModel.create({
            name: 'Shop Navigation Mega Menu',
            slug: 'shop-navigation-mega-menu',
            menuType: 'multi_column_mega_menu',
            placement: 'shop_nav',
            description: 'Multi-column catalog & featured collections mega menu for Shop link.',
            status: 'published',
            visibility: 'public',
            displayOrder: 1,
            categoryMode: 'auto',
            maxDepth: 3,
            megaMenuConfig: {
              ...DEFAULT_MEGA_MENU_LAYOUT,
              showSidebar: true,
              showGrid: true,
              showSlider: true,
              columns: '2',
            },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
          NavigationMenuModel.create({
            name: 'Deals & Flash Offers Menu',
            slug: 'deals-promotional-menu',
            menuType: 'promotional_mega_menu',
            placement: 'deals_nav',
            description: 'Highlights flash sales, best sellers, and active promotional campaigns.',
            status: 'published',
            visibility: 'public',
            displayOrder: 2,
            categoryMode: 'manual',
            maxDepth: 2,
            megaMenuConfig: {
              ...DEFAULT_MEGA_MENU_LAYOUT,
              showSidebar: false,
              showGrid: true,
              showSlider: true,
              columns: '2',
            },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
          NavigationMenuModel.create({
            name: 'Footer Quick Links',
            slug: 'footer-quick-links',
            menuType: 'classic_dropdown',
            placement: 'footer_nav',
            description: 'Primary footer links column.',
            status: 'published',
            visibility: 'public',
            displayOrder: 3,
            categoryMode: 'manual',
            maxDepth: 1,
            megaMenuConfig: {
              ...DEFAULT_MEGA_MENU_LAYOUT,
              showSidebar: false,
              showSlider: false,
            },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: { ...DEFAULT_RESPONSIVE_CONFIG },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
          NavigationMenuModel.create({
            name: 'Mobile & Tablet Drawer',
            slug: 'mobile-drawer-navigation',
            menuType: 'category_mega_menu',
            placement: 'mobile_nav',
            description: 'Responsive accordion categories & quick actions for mobile devices.',
            status: 'published',
            visibility: 'public',
            displayOrder: 4,
            categoryMode: 'auto',
            maxDepth: 3,
            megaMenuConfig: { ...DEFAULT_MEGA_MENU_LAYOUT },
            appearanceConfig: modernGreenAppearance,
            responsiveConfig: {
              ...DEFAULT_RESPONSIVE_CONFIG,
              mobileDrawerMode: 'accordion',
              showPromoSliderOnMobile: true,
            },
            sliderSettings: { ...DEFAULT_SLIDER_SETTINGS },
            createdByName: 'System',
            updatedByName: 'System',
          }),
        ]);

      await NavigationItemModel.insertMany([
        {
          menuId: headerMainMenu._id,
          label: 'Home',
          itemType: 'internal_route',
          url: '/',
          iconType: 'lucide',
          iconName: 'Home',
          iconColor: '#16A34A',
          displayOrder: 0,
          isVisible: true,
        },
        {
          menuId: headerMainMenu._id,
          label: 'Shop',
          itemType: 'internal_route',
          url: '/shop',
          iconType: 'lucide',
          iconName: 'ShoppingBag',
          iconColor: '#16A34A',
          displayOrder: 1,
          isVisible: true,
        },
        {
          menuId: headerMainMenu._id,
          label: 'Deals',
          itemType: 'flash_sale',
          url: '/deals',
          iconType: 'lucide',
          iconName: 'Flame',
          iconColor: '#16A34A',
          badgeText: 'Hot',
          badgeBgColor: '#16A34A',
          badgeTextColor: '#FFFFFF',
          displayOrder: 2,
          isVisible: true,
        },
        {
          menuId: headerMainMenu._id,
          label: 'About Us',
          itemType: 'static_page',
          url: '/policies/about',
          iconType: 'lucide',
          iconName: 'Info',
          displayOrder: 3,
          isVisible: true,
        },
        {
          menuId: headerMainMenu._id,
          label: 'Blog',
          itemType: 'blog',
          url: '/blog',
          iconType: 'lucide',
          iconName: 'BookOpen',
          displayOrder: 4,
          isVisible: true,
        },
        {
          menuId: headerMainMenu._id,
          label: 'Contact Us',
          itemType: 'internal_route',
          url: '/contact',
          iconType: 'lucide',
          iconName: 'Phone',
          displayOrder: 5,
          isVisible: true,
        },
        // Deals menu items
        {
          menuId: dealsMenu._id,
          label: 'Flash Sale Deals',
          itemType: 'flash_sale',
          url: '/deals',
          iconType: 'lucide',
          iconName: 'Zap',
          iconColor: '#16A34A',
          iconBgColor: '#DCFCE7',
          badgeText: 'Live',
          description: 'Limited-time price drops across Bangladesh',
          featuredGroupLimit: 4,
          displayOrder: 0,
          isVisible: true,
        },
        {
          menuId: dealsMenu._id,
          label: 'Best Sellers',
          itemType: 'best_sellers',
          url: '/shop?sort=best_selling',
          iconType: 'lucide',
          iconName: 'Award',
          iconColor: '#0284C7',
          iconBgColor: '#E0F2FE',
          description: 'Top verified customer favorites',
          featuredGroupLimit: 4,
          displayOrder: 1,
          isVisible: true,
        },
        {
          menuId: dealsMenu._id,
          label: 'Featured Picks',
          itemType: 'featured_products',
          url: '/shop?featured=true',
          iconType: 'lucide',
          iconName: 'Star',
          iconColor: '#D97706',
          iconBgColor: '#FEF3C7',
          description: 'Curated tech, fashion, and home essentials',
          featuredGroupLimit: 4,
          displayOrder: 2,
          isVisible: true,
        },
        {
          menuId: dealsMenu._id,
          label: 'Latest Arrivals',
          itemType: 'latest_products',
          url: '/shop?sort=newest',
          iconType: 'lucide',
          iconName: 'Sparkles',
          iconColor: '#7C3AED',
          iconBgColor: '#EDE9FE',
          description: 'Fresh additions to our store',
          featuredGroupLimit: 4,
          displayOrder: 3,
          isVisible: true,
        },
        // Footer quick links
        {
          menuId: footerMenu._id,
          label: 'Home',
          itemType: 'internal_route',
          url: '/',
          iconType: 'none',
          displayOrder: 0,
          isVisible: true,
        },
        {
          menuId: footerMenu._id,
          label: 'Shop Catalog',
          itemType: 'internal_route',
          url: '/shop',
          iconType: 'none',
          displayOrder: 1,
          isVisible: true,
        },
        {
          menuId: footerMenu._id,
          label: 'Hot Deals',
          itemType: 'flash_sale',
          url: '/deals',
          iconType: 'none',
          displayOrder: 2,
          isVisible: true,
        },
        {
          menuId: footerMenu._id,
          label: 'Journal & Guides',
          itemType: 'blog',
          url: '/blog',
          iconType: 'none',
          displayOrder: 3,
          isVisible: true,
        },
        {
          menuId: footerMenu._id,
          label: 'Track Order',
          itemType: 'internal_route',
          url: '/track-order',
          iconType: 'none',
          displayOrder: 4,
          isVisible: true,
        },
        {
          menuId: footerMenu._id,
          label: 'Contact Us',
          itemType: 'internal_route',
          url: '/contact',
          iconType: 'none',
          displayOrder: 5,
          isVisible: true,
        },
      ]);

      const existingSlidesCount = await MegaMenuSlideModel.countDocuments();
      if (existingSlidesCount === 0) {
        await MegaMenuSlideModel.insertMany([
          {
            menuIds: [allCatsMenu._id, shopMenu._id, dealsMenu._id, mobileMenu._id],
            internalName: 'Smart Living Flagship Tech Offer',
            badgeText: 'Special Offer',
            mainHeading: 'Smart Living',
            highlightText: 'Better Tomorrow',
            discountText: 'Up to 60% Off',
            description: 'on Top Brands',
            ctaLabel: 'Shop Now',
            ctaUrl: '/deals',
            desktopImageUrl: '/src/assets/images/product_wireless_earbuds_1795621231733.jpg',
            mobileImageUrl: '/src/assets/images/product_wireless_earbuds_1795621231733.jpg',
            altText: 'Smart Living electronics promotional bundle',
            imagePosition: 'bottom_right',
            textColor: '#0F172A',
            highlightColor: '#16A34A',
            buttonBgColor: '#16A34A',
            buttonTextColor: '#FFFFFF',
            badgeBgColor: '#16A34A',
            badgeTextColor: '#FFFFFF',
            textAlign: 'left',
            overlayColor: '#DCFCE7',
            overlayOpacity: 0,
            borderRadiusPx: 16,
            priority: 20,
            displayOrder: 0,
            isActive: true,
            status: 'published',
          },
          {
            menuIds: [allCatsMenu._id, shopMenu._id, dealsMenu._id],
            internalName: 'Electronics & Laptops Mega Savings',
            badgeText: 'Limited Deal',
            mainHeading: 'Upgrade Tech',
            highlightText: 'Work Smarter',
            discountText: 'Save up to 40%',
            description: 'Official Warranty Nationwide',
            ctaLabel: 'Explore Deals',
            ctaUrl: '/category/electronics',
            desktopImageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
            mobileImageUrl: '/src/assets/images/promo_electronics_bundle_1795621230553.jpg',
            altText: 'Electronics and laptop deals',
            imagePosition: 'bottom_right',
            textColor: '#0F172A',
            highlightColor: '#15803D',
            buttonBgColor: '#16A34A',
            buttonTextColor: '#FFFFFF',
            badgeBgColor: '#15803D',
            badgeTextColor: '#FFFFFF',
            textAlign: 'left',
            overlayColor: '#ECFDF5',
            overlayOpacity: 0,
            borderRadiusPx: 16,
            priority: 10,
            displayOrder: 1,
            isActive: true,
            status: 'published',
          },
        ]);
      }
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

interface CatalogContext {
  now: Date;
  categories: Array<Record<string, unknown>>;
  activeCategoryById: Map<string, Record<string, unknown>>;
  activeBrandById: Map<string, Record<string, unknown>>;
  activeCollectionById: Map<string, Record<string, unknown>>;
  activeCampaignById: Map<string, Record<string, unknown>>;
  activePageById: Map<string, Record<string, unknown>>;
  activeBlogById: Map<string, Record<string, unknown>>;
  publishedProductById: Map<string, Record<string, unknown>>;
  featuredProducts: ResolvedNavProduct[];
  bestSellers: ResolvedNavProduct[];
  latestProducts: ResolvedNavProduct[];
  flashSaleProducts: ResolvedNavProduct[];
}

async function loadCatalogContext(now: Date): Promise<CatalogContext> {
  const [categories, brands, collections, campaigns, pages, blogs, products] = await Promise.all([
    CategoryModel.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).lean(),
    BrandModel.find({ isActive: true }).select('name slug logo').lean(),
    CollectionModel.find({ isActive: true }).sort({ displayOrder: 1 }).select('title slug image').lean(),
    CampaignModel.find({ status: { $in: ['active', 'scheduled'] } })
      .select('name slug discountLabel startsAt endsAt status')
      .lean(),
    StaticPageModel.find({ isPublished: true }).select('title slug pageType').lean(),
    BlogPostModel.find({
      $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: now } }],
    })
      .select('title slug category')
      .lean(),
    ProductModel.find({ status: 'published' })
      .select(
        'name slug images basePrice salePrice flashSalePrice flashSaleStart flashSaleEnd ratingAverage isFeatured isBestSeller salesCount createdAt categoryId'
      )
      .sort({ salesCount: -1, createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const activeCategoryById = new Map(categories.map((c) => [String(c._id), c]));
  const activeBrandById = new Map(brands.map((b) => [String(b._id), b]));
  const activeCollectionById = new Map(collections.map((c) => [String(c._id), c]));
  const activeCampaignById = new Map(
    campaigns
      .filter((c) => {
        if (c.startsAt && new Date(c.startsAt) > now) return false;
        if (c.endsAt && new Date(c.endsAt) < now) return false;
        return true;
      })
      .map((c) => [String(c._id), c])
  );
  const activePageById = new Map(pages.map((p) => [String(p._id), p]));
  const activeBlogById = new Map(blogs.map((b) => [String(b._id), b]));
  const publishedProductById = new Map(products.map((p) => [String(p._id), p]));

  const resolvedAll = products.map((p) => toResolvedProduct(p, now));
  const featuredProducts = resolvedAll.filter((_, idx) => Boolean(products[idx]?.isFeatured)).slice(0, 8);
  const bestSellers = [...products]
    .sort((a, b) => Number(b.salesCount ?? 0) - Number(a.salesCount ?? 0))
    .slice(0, 8)
    .map((p) => toResolvedProduct(p, now));
  const latestProducts = [...products]
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, 8)
    .map((p) => toResolvedProduct(p, now));
  const flashSaleProducts = resolvedAll.filter((p) => p.isFlashSaleActive).slice(0, 8);

  return {
    now,
    categories,
    activeCategoryById,
    activeBrandById,
    activeCollectionById,
    activeCampaignById,
    activePageById,
    activeBlogById,
    publishedProductById,
    featuredProducts,
    bestSellers,
    latestProducts,
    flashSaleProducts,
  };
}

export async function resolveMenuPayload(
  rawMenu: INavigationMenu | Record<string, unknown>,
  options: {
    includeDraftItems?: boolean;
    includeInactiveSlides?: boolean;
    rawItemsOverride?: Array<Record<string, unknown>>;
    rawSlidesOverride?: Array<Record<string, unknown>>;
    context?: CatalogContext;
  } = {}
): Promise<NavigationMenuRecord> {
  const now = new Date();
  const ctx = options.context ?? (await loadCatalogContext(now));
  const menuObj =
    typeof (rawMenu as INavigationMenu).toObject === 'function'
      ? (rawMenu as INavigationMenu).toObject()
      : { ...rawMenu };
  const menuIdStr = String(menuObj._id);

  const rawItems =
    options.rawItemsOverride ??
    (await NavigationItemModel.find({ menuId: menuObj._id })
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean());

  const hydratedItems: NavigationItemRecord[] = [];
  for (const item of rawItems as Array<Record<string, unknown>>) {
    if (!options.includeDraftItems && item.isVisible === false) {
      continue;
    }

    const itemType = String(item.itemType || 'internal_route') as NavigationItemRecord['itemType'];
    const targetId = item.targetId ? String(item.targetId) : null;
    let url = String(item.url || '/shop');
    let label = String(item.label || '');
    let resolvedProducts: ResolvedNavProduct[] | undefined;
    let resolvedBrand: NavigationItemRecord['resolvedBrand'] = null;

    // Resolve dynamic references against live DB records; gracefully omit inactive/deleted references on public view
    if ((itemType === 'category' || itemType === 'subcategory') && targetId) {
      const cat = ctx.activeCategoryById.get(targetId);
      if (!cat) {
        if (!options.includeDraftItems) continue;
      } else {
        url = `/category/${String(cat.slug)}`;
        if (!label) label = String(cat.name);
      }
    } else if (itemType === 'product' && targetId) {
      const prod = ctx.publishedProductById.get(targetId);
      if (!prod) {
        if (!options.includeDraftItems) continue;
      } else {
        const resolved = toResolvedProduct(prod, now);
        url = `/product/${resolved.slug}`;
        if (!label) label = resolved.name;
        resolvedProducts = [resolved];
      }
    } else if (itemType === 'brand' && targetId) {
      const brand = ctx.activeBrandById.get(targetId);
      if (!brand) {
        if (!options.includeDraftItems) continue;
      } else {
        url = `/brand/${String(brand.slug)}`;
        if (!label) label = String(brand.name);
        resolvedBrand = {
          _id: String(brand._id),
          name: String(brand.name),
          slug: String(brand.slug),
          logoUrl: (brand.logo as { url?: string } | undefined)?.url,
        };
      }
    } else if (itemType === 'collection' && targetId) {
      const col = ctx.activeCollectionById.get(targetId);
      if (!col) {
        if (!options.includeDraftItems) continue;
      } else {
        url = `/shop?collection=${encodeURIComponent(String(col.slug))}`;
        if (!label) label = String(col.title);
      }
    } else if (itemType === 'campaign' && targetId) {
      const camp = ctx.activeCampaignById.get(targetId);
      if (!camp) {
        if (!options.includeDraftItems) continue;
      } else {
        url = `/deals?campaign=${encodeURIComponent(String(camp.slug))}`;
        if (!label) label = String(camp.name);
      }
    } else if (itemType === 'static_page' && targetId) {
      const pg = ctx.activePageById.get(targetId);
      if (!pg) {
        if (!options.includeDraftItems) continue;
      } else {
        url = pg.pageType === 'policy' ? `/policies/${String(pg.slug)}` : `/page/${String(pg.slug)}`;
        if (!label) label = String(pg.title);
      }
    } else if (itemType === 'blog' && targetId) {
      const post = ctx.activeBlogById.get(targetId);
      if (!post) {
        if (!options.includeDraftItems) continue;
      } else {
        url = `/blog/${String(post.slug)}`;
        if (!label) label = String(post.title);
      }
    } else if (itemType === 'featured_products') {
      const limit = Math.max(1, Math.min(8, Number(item.featuredGroupLimit || 4)));
      resolvedProducts = ctx.featuredProducts.slice(0, limit);
    } else if (itemType === 'best_sellers') {
      const limit = Math.max(1, Math.min(8, Number(item.featuredGroupLimit || 4)));
      resolvedProducts = ctx.bestSellers.slice(0, limit);
    } else if (itemType === 'latest_products') {
      const limit = Math.max(1, Math.min(8, Number(item.featuredGroupLimit || 4)));
      resolvedProducts = ctx.latestProducts.slice(0, limit);
    } else if (itemType === 'flash_sale') {
      const limit = Math.max(1, Math.min(8, Number(item.featuredGroupLimit || 4)));
      resolvedProducts = ctx.flashSaleProducts.slice(0, limit);
    }

    hydratedItems.push({
      _id: String(item._id || new mongoose.Types.ObjectId()),
      menuId: menuIdStr,
      parentId: item.parentId ? String(item.parentId) : null,
      label,
      itemType,
      targetId,
      targetSlug: String(item.targetSlug || ''),
      url,
      openInNewTab: Boolean(item.openInNewTab),
      iconType: (item.iconType as NavigationItemRecord['iconType']) || 'lucide',
      iconName: String(item.iconName || 'LayoutGrid'),
      iconSvg: String(item.iconSvg || ''),
      iconImageUrl: String(item.iconImageUrl || ''),
      iconImagePublicId: String(item.iconImagePublicId || ''),
      iconColor: String(item.iconColor || '#16A34A'),
      iconBgColor: String(item.iconBgColor || '#DCFCE7'),
      imageUrl: String(item.imageUrl || ''),
      imagePublicId: String(item.imagePublicId || ''),
      badgeText: String(item.badgeText || ''),
      badgeBgColor: String(item.badgeBgColor || '#16A34A'),
      badgeTextColor: String(item.badgeTextColor || '#FFFFFF'),
      description: String(item.description || ''),
      structuredBlocks: Array.isArray(item.structuredBlocks) ? item.structuredBlocks : [],
      featuredGroupLimit: Number(item.featuredGroupLimit || 4),
      columnIndex: Number(item.columnIndex || 0),
      displayOrder: Number(item.displayOrder ?? 0),
      isVisible: item.isVisible !== false,
      resolvedProducts,
      resolvedBrand,
    });
  }

  const maxDepth = Math.max(1, Math.min(5, Number(menuObj.maxDepth || 4)));
  const itemTree = buildMegaMenuItemTree(hydratedItems, {
    includeHidden: Boolean(options.includeDraftItems),
    maxDepth,
  });

  // Resolve Category Tree if auto/hybrid
  const categoryMode = (menuObj.categoryMode as 'auto' | 'hybrid' | 'manual') || 'auto';
  const includedIds = Array.isArray(menuObj.includedCategoryIds)
    ? menuObj.includedCategoryIds.map((id: unknown) => String(id))
    : [];
  const excludedIds = Array.isArray(menuObj.excludedCategoryIds)
    ? menuObj.excludedCategoryIds.map((id: unknown) => String(id))
    : [];

  const categoriesTree = resolveDynamicCategoryHierarchy(
    ctx.categories.map((c) => ({
      _id: String(c._id),
      name: String(c.name),
      nameBn: c.nameBn ? String(c.nameBn) : undefined,
      slug: String(c.slug),
      parentId: c.parentId ? String(c.parentId) : null,
      image: c.image as { url?: string } | undefined,
      displayOrder: Number(c.displayOrder ?? 0),
      isActive: c.isActive !== false,
    })),
    {
      mode: categoryMode,
      includedCategoryIds: includedIds,
      excludedCategoryIds: excludedIds,
    }
  );

  // Attach featured products per category if showProductImages is enabled
  const megaCfg = {
    ...DEFAULT_MEGA_MENU_LAYOUT,
    ...((menuObj.megaMenuConfig as Record<string, unknown>) || {}),
  };
  if (megaCfg.showProductImages) {
    for (const catNode of categoriesTree) {
      const subIds = new Set(catNode.subcategories.map((s) => s._id));
      const matchingProducts: ResolvedNavProduct[] = [];
      for (const prod of ctx.publishedProductById.values()) {
        const pCat = String(prod.categoryId || '');
        if (pCat === catNode._id || subIds.has(pCat)) {
          matchingProducts.push(toResolvedProduct(prod, now));
          if (matchingProducts.length >= 2) break;
        }
      }
      catNode.featuredProducts = matchingProducts;
    }
  }

  // Resolve Promotional Slides assigned to this menu
  const slideDocs =
    options.rawSlidesOverride ??
    (await MegaMenuSlideModel.find({
      menuIds: menuObj._id,
    })
      .sort({ priority: -1, displayOrder: 1 })
      .lean());

  const mappedSlides: MegaMenuSlideRecord[] = (slideDocs as Array<Record<string, unknown>>).map((s) => ({
    _id: String(s._id),
    menuIds: Array.isArray(s.menuIds) ? s.menuIds.map((id) => String(id)) : [],
    internalName: String(s.internalName || ''),
    badgeText: String(s.badgeText || ''),
    mainHeading: String(s.mainHeading || ''),
    highlightText: String(s.highlightText || ''),
    discountText: String(s.discountText || ''),
    description: String(s.description || ''),
    ctaLabel: String(s.ctaLabel || 'Shop Now'),
    ctaUrl: String(s.ctaUrl || '/shop'),
    openInNewTab: Boolean(s.openInNewTab),
    desktopImageUrl: String(s.desktopImageUrl || ''),
    desktopImagePublicId: String(s.desktopImagePublicId || ''),
    mobileImageUrl: String(s.mobileImageUrl || ''),
    mobileImagePublicId: String(s.mobileImagePublicId || ''),
    altText: String(s.altText || s.mainHeading || 'Promotional Slide'),
    imagePosition: (s.imagePosition as MegaMenuSlideRecord['imagePosition']) || 'bottom_right',
    textColor: String(s.textColor || '#0F172A'),
    highlightColor: String(s.highlightColor || '#16A34A'),
    buttonBgColor: String(s.buttonBgColor || '#16A34A'),
    buttonTextColor: String(s.buttonTextColor || '#FFFFFF'),
    badgeBgColor: String(s.badgeBgColor || '#16A34A'),
    badgeTextColor: String(s.badgeTextColor || '#FFFFFF'),
    textAlign: (s.textAlign as MegaMenuSlideRecord['textAlign']) || 'left',
    overlayColor: String(s.overlayColor || '#DCFCE7'),
    overlayOpacity: Number(s.overlayOpacity ?? 0),
    borderRadiusPx: Number(s.borderRadiusPx ?? 16),
    customStyleCss: String(s.customStyleCss || ''),
    priority: Number(s.priority ?? 10),
    displayOrder: Number(s.displayOrder ?? 0),
    isActive: Boolean(s.isActive),
    status: (s.status as MegaMenuSlideRecord['status']) || 'published',
    startsAt: (s.startsAt as Date | string | null) ?? null,
    endsAt: (s.endsAt as Date | string | null) ?? null,
    productIds: Array.isArray(s.productIds) ? s.productIds.map((id) => String(id)) : [],
  }));

  const slides = options.includeInactiveSlides
    ? mappedSlides
    : filterActiveMegaMenuSlides(mappedSlides, now);

  return {
    _id: menuIdStr,
    name: String(menuObj.name),
    slug: String(menuObj.slug),
    menuType: (menuObj.menuType as NavigationMenuRecord['menuType']) || 'category_mega_menu',
    placement: (menuObj.placement as NavigationPlacementKey) || 'all_categories',
    description: String(menuObj.description || ''),
    status: (menuObj.status as NavigationMenuRecord['status']) || 'draft',
    visibility: (menuObj.visibility as NavigationMenuRecord['visibility']) || 'public',
    displayOrder: Number(menuObj.displayOrder ?? 0),
    startsAt: (menuObj.startsAt as Date | string | null) ?? null,
    endsAt: (menuObj.endsAt as Date | string | null) ?? null,
    targetPaths: Array.isArray(menuObj.targetPaths) ? menuObj.targetPaths.map(String) : [],
    categoryMode,
    includedCategoryIds: includedIds,
    excludedCategoryIds: excludedIds,
    maxDepth,
    megaMenuConfig: megaCfg,
    appearanceConfig: {
      ...DEFAULT_MEGA_MENU_APPEARANCE,
      ...((menuObj.appearanceConfig as Record<string, unknown>) || {}),
    },
    responsiveConfig: {
      ...DEFAULT_RESPONSIVE_CONFIG,
      ...((menuObj.responsiveConfig as Record<string, unknown>) || {}),
    },
    sliderSettings: {
      ...DEFAULT_SLIDER_SETTINGS,
      ...((menuObj.sliderSettings as Record<string, unknown>) || {}),
    },
    createdByName: String(menuObj.createdByName || 'Admin'),
    updatedByName: String(menuObj.updatedByName || 'Admin'),
    itemCount: hydratedItems.length,
    items: itemTree,
    categoriesTree,
    slides,
    resolvedGroups: {
      featuredProducts: ctx.featuredProducts.slice(0, 6),
      bestSellers: ctx.bestSellers.slice(0, 6),
      latestProducts: ctx.latestProducts.slice(0, 6),
      flashSaleProducts: ctx.flashSaleProducts.slice(0, 6),
    },
    createdAt: menuObj.createdAt ? String(menuObj.createdAt) : undefined,
    updatedAt: menuObj.updatedAt ? String(menuObj.updatedAt) : undefined,
  };
}

export async function resolvePublicNavigation(options: {
  placement?: NavigationPlacementKey;
  slug?: string;
  currentPath?: string;
  isAuthenticatedCustomer?: boolean;
}): Promise<{
  menus: NavigationMenuRecord[];
  byPlacement: Partial<Record<NavigationPlacementKey, NavigationMenuRecord[]>>;
}> {
  const scope = options.slug ? 'slug' : options.placement ? 'placement' : 'all';
  const cacheKey = getNavigationCacheKey({
    scope,
    key: options.slug || options.placement,
    path: options.currentPath,
    isCustomer: options.isAuthenticatedCustomer,
  });

  const cached = getCachedNavigation<{
    menus: NavigationMenuRecord[];
    byPlacement: Partial<Record<NavigationPlacementKey, NavigationMenuRecord[]>>;
  }>(cacheKey);
  if (cached) {
    return cached;
  }

  await ensureDefaultNavigationDocuments();

  const now = new Date();
  const query: Record<string, unknown> = {
    status: { $in: ['published', 'scheduled'] },
  };
  if (options.placement) query.placement = options.placement;
  if (options.slug) query.slug = options.slug.toLowerCase();

  const candidateMenus = await NavigationMenuModel.find(query)
    .sort({ displayOrder: 1, updatedAt: -1 })
    .lean();

  const activeMenus = candidateMenus.filter((m) =>
    isMenuScheduledActive(
      {
        status: m.status,
        visibility: m.visibility,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        targetPaths: m.targetPaths,
      },
      {
        now,
        currentPath: options.currentPath,
        isAuthenticatedCustomer: options.isAuthenticatedCustomer,
      }
    )
  );

  const ctx = await loadCatalogContext(now);
  const resolvedMenus = await Promise.all(
    activeMenus.map((m) =>
      resolveMenuPayload(m as unknown as Record<string, unknown>, {
        includeDraftItems: false,
        includeInactiveSlides: false,
        context: ctx,
      })
    )
  );

  const byPlacement: Partial<Record<NavigationPlacementKey, NavigationMenuRecord[]>> = {};
  for (const menu of resolvedMenus) {
    const arr = byPlacement[menu.placement] || [];
    arr.push(menu);
    byPlacement[menu.placement] = arr;
  }

  const payload = { menus: resolvedMenus, byPlacement };
  setCachedNavigation(cacheKey, payload);
  return payload;
}
