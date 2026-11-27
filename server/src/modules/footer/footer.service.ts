import {
  DEFAULT_FOOTER_CONFIG,
  cloneFooterConfig,
  filterEnabledFooterPaymentBadges,
  filterVisibleFooterColumns,
  formatCopyrightText,
  normalizeFooterConfig,
  type FooterConfigPayload,
  type FooterSocialLinkConfig,
  type StorePaymentMethodFlag,
} from '../../../../shared/footerHelpers.ts';
import { StoreSettingsModel } from '../cms/cms.model.ts';
import {
  getCachedFooter,
  getFooterCacheKey,
  invalidateFooterCache,
  setCachedFooter,
} from './footer.cache.ts';
import { FooterConfigModel, type IFooterConfig } from './footer.model.ts';

export function buildSeedFooterFromStoreSettings(
  storeSettings?: {
    storeName?: string;
    tagline?: string;
    supportEmail?: string;
    supportPhone?: string;
    businessAddress?: string;
    socialLinks?: Record<string, string | undefined>;
    footerSettings?: {
      footerLogoUrl?: string;
      description?: string;
      copyrightText?: string;
      showPaymentLogos?: boolean;
    };
  } | null
): FooterConfigPayload {
  const base = cloneFooterConfig(DEFAULT_FOOTER_CONFIG);
  if (!storeSettings) return base;

  if (storeSettings.storeName) {
    base.brand.storeName = storeSettings.storeName;
    base.bottomBar.companyName = storeSettings.storeName;
  }
  if (storeSettings.tagline) base.brand.tagline = storeSettings.tagline;
  if (storeSettings.supportEmail) base.brand.contactEmail = storeSettings.supportEmail;
  if (storeSettings.supportPhone) base.brand.contactPhone = storeSettings.supportPhone;
  if (storeSettings.businessAddress) base.brand.businessAddress = storeSettings.businessAddress;
  if (storeSettings.footerSettings?.footerLogoUrl) {
    base.brand.logoUrl = storeSettings.footerSettings.footerLogoUrl;
  }
  if (storeSettings.footerSettings?.description) {
    base.brand.description = storeSettings.footerSettings.description;
  }
  if (typeof storeSettings.footerSettings?.showPaymentLogos === 'boolean') {
    base.payments.enabled = storeSettings.footerSettings.showPaymentLogos;
  }

  const socialMap = storeSettings.socialLinks || {};
  const seededLinks: FooterSocialLinkConfig[] = [];
  const candidates: Array<{ key: FooterSocialLinkConfig['platform']; label: string; iconName: string }> = [
    { key: 'facebook', label: 'Facebook', iconName: 'Globe' },
    { key: 'instagram', label: 'Instagram', iconName: 'Camera' },
    { key: 'youtube', label: 'YouTube', iconName: 'Tv' },
    { key: 'linkedin', label: 'LinkedIn', iconName: 'Briefcase' },
    { key: 'tiktok', label: 'TikTok', iconName: 'Music' },
    { key: 'whatsapp', label: 'WhatsApp', iconName: 'Phone' },
  ];
  for (const c of candidates) {
    const val = socialMap[c.key];
    if (val && typeof val === 'string' && val.trim()) {
      seededLinks.push({
        id: `soc-${c.key}`,
        platform: c.key,
        label: c.label,
        url: val.trim(),
        iconType: 'brand',
        iconName: c.iconName,
        openInNewTab: true,
        displayOrder: seededLinks.length,
        isActive: true,
      });
    }
  }
  if (seededLinks.length > 0) {
    base.social.links = seededLinks;
  }

  return normalizeFooterConfig(base);
}

export async function ensureDefaultFooterConfig(): Promise<IFooterConfig> {
  const existing = await FooterConfigModel.findOne({ key: 'primary' });
  if (existing) {
    return existing;
  }

  const storeSettings = await StoreSettingsModel.findOne({ key: 'primary' }).lean();
  const initialConfig = buildSeedFooterFromStoreSettings(storeSettings || null);

  const created = await FooterConfigModel.create({
    key: 'primary',
    draft: cloneFooterConfig(initialConfig),
    published: cloneFooterConfig(initialConfig),
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    updatedByName: 'System Seed',
  });
  invalidateFooterCache();
  return created;
}

export interface PublicFooterResolvedResponse {
  enabled: boolean;
  status: 'draft' | 'published';
  version: number;
  publishedAt: string | null;
  footer: FooterConfigPayload | null;
  resolvedCopyrightText: string;
  enabledPaymentChannels: StorePaymentMethodFlag[];
}

export async function resolvePublicFooter(options: {
  isAuthenticated?: boolean;
  bypassCache?: boolean;
} = {}): Promise<PublicFooterResolvedResponse> {
  const isAuthenticated = Boolean(options.isAuthenticated);
  const cacheKey = getFooterCacheKey(isAuthenticated);

  if (!options.bypassCache) {
    const cached = getCachedFooter<PublicFooterResolvedResponse>(cacheKey);
    if (cached) return cached;
  }

  const [doc, storeSettings] = await Promise.all([
    FooterConfigModel.findOne({ key: 'primary' }).lean<IFooterConfig | null>(),
    StoreSettingsModel.findOne({ key: 'primary' }).select('paymentMethods').lean(),
  ]);

  let activeDoc = doc;
  if (!activeDoc) {
    const seeded = await ensureDefaultFooterConfig();
    activeDoc = seeded.toObject() as IFooterConfig;
  }

  const storePaymentMethods = (storeSettings?.paymentMethods || []) as StorePaymentMethodFlag[];

  if (activeDoc.status !== 'published' || !activeDoc.published) {
    const disabledResponse: PublicFooterResolvedResponse = {
      enabled: false,
      status: 'draft',
      version: activeDoc.version || 1,
      publishedAt: activeDoc.publishedAt ? new Date(activeDoc.publishedAt).toISOString() : null,
      footer: null,
      resolvedCopyrightText: '',
      enabledPaymentChannels: storePaymentMethods.filter((m) => m.enabled),
    };
    setCachedFooter(cacheKey, disabledResponse);
    return disabledResponse;
  }

  const normalized = normalizeFooterConfig(activeDoc.published);
  if (!normalized.general.enabled) {
    const disabledResponse: PublicFooterResolvedResponse = {
      enabled: false,
      status: 'published',
      version: activeDoc.version || 1,
      publishedAt: activeDoc.publishedAt ? new Date(activeDoc.publishedAt).toISOString() : null,
      footer: {
        ...normalized,
      },
      resolvedCopyrightText: '',
      enabledPaymentChannels: storePaymentMethods.filter((m) => m.enabled),
    };
    setCachedFooter(cacheKey, disabledResponse);
    return disabledResponse;
  }

  const filteredColumns = filterVisibleFooterColumns(normalized.columns, {
    isAuthenticated,
    includeHidden: false,
  });

  const filteredBadges = filterEnabledFooterPaymentBadges(
    normalized.payments.badges,
    storePaymentMethods
  );

  const filteredSocialLinks = [...(normalized.social.links || [])]
    .filter((l) => l.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const filteredBottomLinks = [...(normalized.bottomBar.links || [])]
    .filter((l) => l.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const filteredTrustBadges = [...(normalized.trustBadges.items || [])]
    .filter((t) => t.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const resolvedFooter: FooterConfigPayload = {
    ...normalized,
    columns: filteredColumns,
    social: {
      ...normalized.social,
      links: filteredSocialLinks,
    },
    payments: {
      ...normalized.payments,
      badges: filteredBadges,
    },
    trustBadges: {
      ...normalized.trustBadges,
      items: filteredTrustBadges,
    },
    bottomBar: {
      ...normalized.bottomBar,
      links: filteredBottomLinks,
    },
  };

  const payload: PublicFooterResolvedResponse = {
    enabled: true,
    status: 'published',
    version: activeDoc.version || 1,
    publishedAt: activeDoc.publishedAt ? new Date(activeDoc.publishedAt).toISOString() : null,
    footer: resolvedFooter,
    resolvedCopyrightText: formatCopyrightText(
      resolvedFooter.bottomBar.copyrightTemplate,
      resolvedFooter.bottomBar.companyName,
      resolvedFooter.bottomBar.copyrightYear
    ),
    enabledPaymentChannels: storePaymentMethods.filter((m) => m.enabled),
  };

  setCachedFooter(cacheKey, payload);
  return payload;
}

export async function syncPublishedFooterToStoreSettings(footer: FooterConfigPayload): Promise<void> {
  const socialLinksPatch: Record<string, string> = {};
  for (const link of footer.social.links || []) {
    if (
      link.isActive &&
      ['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'whatsapp'].includes(link.platform)
    ) {
      socialLinksPatch[`socialLinks.${link.platform}`] = link.url;
    }
  }

  await StoreSettingsModel.updateOne(
    { key: 'primary' },
    {
      $set: {
        'footerSettings.footerLogoUrl': footer.brand.logoUrl || '',
        'footerSettings.description': footer.brand.description || '',
        'footerSettings.copyrightText': formatCopyrightText(
          footer.bottomBar.copyrightTemplate,
          footer.bottomBar.companyName,
          footer.bottomBar.copyrightYear
        ),
        'footerSettings.showPaymentLogos': footer.payments.enabled,
        ...socialLinksPatch,
      },
    }
  );
}
