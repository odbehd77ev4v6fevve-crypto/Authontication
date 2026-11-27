import { useId, useState, type CSSProperties } from 'react';
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Clock,
  Shield,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  filterEnabledFooterPaymentBadges,
  filterVisibleFooterColumns,
  formatCopyrightText,
  sanitizeFooterCustomCss,
  type FooterColumnConfig,
  type FooterConfigPayload,
  type FooterMenuItemConfig,
  type FooterSocialLinkConfig,
  type StorePaymentMethodFlag,
} from '../../../shared/footerHelpers.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { apiRequest, ApiError } from '../../lib/api.ts';
import { NavIconRenderer } from '../navigation/NavIconRenderer.tsx';
import { SafeImage } from '../ui/SafeImage.tsx';

interface FooterRendererProps {
  config: FooterConfigPayload;
  storePaymentMethods?: StorePaymentMethodFlag[] | null;
  isAuthenticated?: boolean;
  onAdminAccessClick?: () => void;
  previewMode?: boolean;
  previewViewport?: 'desktop' | 'tablet' | 'mobile';
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function renderSocialPlatformSvg(platform: FooterSocialLinkConfig['platform'], sizePx: number) {
  const common = {
    width: sizePx,
    height: sizePx,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (platform) {
    case 'facebook':
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...common}>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3v6Z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect width="4" height="12" x="2" y="9" />
          <circle cx="4" cy="4" r="2" />
        </svg>
      );
    case 'twitter':
      return (
        <svg {...common}>
          <path d="M4 4l11.733 16h4.267l-11.733-16z" />
          <path d="M4 20l6.768-6.768m2.46-2.46L20 4" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'pinterest':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 20l4-9" />
          <path d="M10.7 14c.4 1.1 1.4 2 2.8 2 2.2 0 3.5-2 3.5-4.3 0-2.6-2-4.7-5-4.7-3.4 0-5.5 2.4-5.5 5 0 1.2.5 2.3 1.4 2.8" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common}>
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    default:
      return (
        <NavIconRenderer iconType="lucide" iconName="Globe" sizePx={sizePx} />
      );
  }
}

function FooterNavLink({
  url,
  openInNewTab,
  className,
  style,
  previewMode,
  children,
}: {
  url: string;
  openInNewTab?: boolean;
  className?: string;
  style?: CSSProperties;
  previewMode?: boolean;
  children: React.ReactNode;
}) {
  const safeUrl = sanitizeHref(url) || '/';
  if (previewMode) {
    return (
      <a
        href={safeUrl}
        onClick={(e) => e.preventDefault()}
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  if (openInNewTab || isExternalUrl(safeUrl)) {
    return (
      <a
        href={safeUrl}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={safeUrl} className={className} style={style}>
      {children}
    </Link>
  );
}

export function FooterRenderer({
  config,
  storePaymentMethods,
  isAuthenticated = false,
  onAdminAccessClick,
  previewMode = false,
  previewViewport,
}: FooterRendererProps) {
  const scopeId = useId().replace(/:/g, '');
  const scopeAttr = `footer-${scopeId}`;

  const { general, brand, social, newsletter, payments, trustBadges, bottomBar, advanced } = config;

  const [openColumnIds, setOpenColumnIds] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [submittingNewsletter, setSubmittingNewsletter] = useState(false);
  const [newsletterFeedback, setNewsletterFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  if (!general.enabled) {
    if (!previewMode) return null;
    return (
      <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
        <p className="text-sm font-bold text-slate-800">Footer is Currently Disabled</p>
        <p className="text-xs text-slate-500">
          Enable the footer under General Settings to display it on the live storefront.
        </p>
      </div>
    );
  }

  const visibleColumns = filterVisibleFooterColumns(config.columns, {
    isAuthenticated,
    includeHidden: false,
  });

  const activeSocialLinks = [...(social.links || [])]
    .filter((l) => l.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const visiblePaymentBadges = filterEnabledFooterPaymentBadges(
    payments.badges,
    storePaymentMethods
  );

  const activeTrustBadges = [...(trustBadges.items || [])]
    .filter((t) => t.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const activeBottomLinks = [...(bottomBar.links || [])]
    .filter((l) => l.isActive)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const copyrightText = formatCopyrightText(
    bottomBar.copyrightTemplate,
    bottomBar.companyName || brand.storeName,
    bottomBar.copyrightYear
  );

  const isMobilePreview = previewViewport === 'mobile';
  const isTabletPreview = previewViewport === 'tablet';

  // Responsive visibility classes when on real storefront vs forced viewport preview
  let visibilityClass = '';
  if (previewViewport) {
    if (previewViewport === 'desktop' && !general.desktopEnabled) visibilityClass = 'opacity-40';
    if (previewViewport === 'tablet' && !general.tabletEnabled) visibilityClass = 'opacity-40';
    if (previewViewport === 'mobile' && !general.mobileEnabled) visibilityClass = 'opacity-40';
  } else {
    const hideDesktop = !general.desktopEnabled ? 'lg:hidden' : 'lg:block';
    const hideTablet = !general.tabletEnabled ? 'sm:hidden' : 'sm:block';
    const hideMobile = !general.mobileEnabled ? 'hidden' : 'block';
    visibilityClass = `${hideMobile} ${hideTablet} ${hideDesktop}`;
  }

  const maxWidthStyle: string | undefined =
    general.maxWidth === 'full'
      ? '100%'
      : general.maxWidth === '1440px'
      ? '1440px'
      : general.maxWidth === 'custom'
      ? `${general.customMaxWidthPx}px`
      : '1280px';

  const shadowClass =
    general.shadow === 'sm'
      ? 'shadow-sm'
      : general.shadow === 'md'
      ? 'shadow-md'
      : general.shadow === 'lg'
      ? 'shadow-xl'
      : '';

  const backgroundStyle = general.backgroundGradientEnabled
    ? `linear-gradient(${general.backgroundGradientDirection || '135deg'}, ${general.backgroundGradientStart}, ${general.backgroundGradientEnd})`
    : general.backgroundColor;

  const customCssSafe = sanitizeFooterCustomCss(advanced.customCss);

  const toggleMobileColumn = (id: string) => {
    setOpenColumnIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterFeedback(null);

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setNewsletterFeedback({
        type: 'error',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    if (newsletter.requireConsent && !consent) {
      setNewsletterFeedback({
        type: 'error',
        message: 'Please accept the marketing consent checkbox to subscribe.',
      });
      return;
    }

    if (previewMode) {
      setNewsletterFeedback({
        type: 'success',
        message: `${newsletter.successMessage} (Live Preview)`,
      });
      return;
    }

    setSubmittingNewsletter(true);
    try {
      await apiRequest('/api/support/newsletter/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          consent: true,
          source: 'footer_newsletter',
        }),
      });
      setEmail('');
      setNewsletterFeedback({
        type: 'success',
        message: newsletter.successMessage || 'Thank you for subscribing!',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setNewsletterFeedback({
          type: 'error',
          message: newsletter.duplicateMessage || 'This email address is already subscribed.',
        });
      } else {
        setNewsletterFeedback({
          type: 'error',
          message:
            err instanceof Error
              ? err.message
              : newsletter.errorMessage || 'Unable to subscribe right now.',
        });
      }
    } finally {
      setSubmittingNewsletter(false);
    }
  };

  const renderNewsletterSection = (compact = false) => {
    if (!newsletter.enabled) return null;
    return (
      <div
        style={{
          backgroundColor: newsletter.backgroundColor,
          color: newsletter.textColor,
          borderColor: general.borderColor,
        }}
        className={`rounded-2xl border ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
      >
        <div
          className={`flex ${
            compact || isMobilePreview
              ? 'flex-col gap-4'
              : 'flex-col lg:flex-row lg:items-center lg:justify-between gap-5'
          }`}
        >
          <div className="space-y-1 max-w-xl">
            <h3
              style={{ color: general.headingColor }}
              className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-bold`}
            >
              {newsletter.heading}
            </h3>
            {newsletter.description && (
              <p className="text-xs opacity-80 leading-relaxed">{newsletter.description}</p>
            )}
          </div>

          <form onSubmit={handleNewsletterSubmit} className="w-full lg:max-w-md space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor={`newsletter-email-${scopeId}`} className="sr-only">
                Email address
              </label>
              <input
                id={`newsletter-email-${scopeId}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={newsletter.inputPlaceholder || 'Enter your email'}
                disabled={submittingNewsletter}
                className="flex-1 h-10 px-3.5 rounded-xl bg-white/95 text-slate-900 placeholder:text-slate-400 text-xs font-medium border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="submit"
                disabled={submittingNewsletter}
                style={{
                  backgroundColor: newsletter.buttonBgColor || general.accentColor,
                  color: newsletter.buttonTextColor || '#FFFFFF',
                }}
                className="h-10 px-5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:brightness-110 transition-all shrink-0 disabled:opacity-60"
              >
                {submittingNewsletter && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{newsletter.buttonLabel || 'Subscribe'}</span>
              </button>
            </div>

            {newsletter.requireConsent && (
              <label className="flex items-start gap-2 text-[11px] opacity-85 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500"
                />
                <span>{newsletter.consentLabel}</span>
              </label>
            )}

            {newsletterFeedback && (
              <div
                role="status"
                className={`flex items-center gap-1.5 text-xs font-semibold pt-0.5 ${
                  newsletterFeedback.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {newsletterFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{newsletterFeedback.message}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  };

  const renderSocialIcons = () => {
    if (!social.enabled || activeSocialLinks.length === 0) return null;
    const radiusStyle =
      social.buttonStyle === 'circle'
        ? '9999px'
        : social.buttonStyle === 'square'
        ? '4px'
        : `${social.borderRadiusPx ?? 10}px`;

    return (
      <div className="space-y-2 pt-1">
        {social.title && (
          <p
            style={{ color: general.headingColor }}
            className="text-[11px] font-bold uppercase tracking-wider opacity-80"
          >
            {social.title}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {activeSocialLinks.map((item) => {
            const safeUrl = sanitizeHref(item.url) || '#';
            return (
              <a
                key={item.id}
                href={safeUrl}
                target={item.openInNewTab ? '_blank' : undefined}
                rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                onClick={previewMode ? (e) => e.preventDefault() : undefined}
                aria-label={item.label}
                title={item.label}
                style={{
                  backgroundColor:
                    social.buttonStyle === 'ghost' ? 'transparent' : social.backgroundColor,
                  color: social.iconColor,
                  borderRadius: radiusStyle,
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 border border-white/10 transition-all ${
                  advanced.enableHoverAnimations ? 'hover:-translate-y-0.5' : ''
                } footer-social-btn-${scopeId}`}
              >
                {item.iconType === 'image' && item.iconImageUrl ? (
                  <SafeImage
                    src={item.iconImageUrl}
                    alt={item.label}
                    style={{ width: social.iconSizePx, height: social.iconSizePx }}
                    className="object-contain"
                  />
                ) : item.iconType === 'lucide' || item.iconType === 'svg' ? (
                  <NavIconRenderer
                    iconType={item.iconType}
                    iconName={item.iconName}
                    iconSvg={item.iconSvg}
                    iconColor={social.iconColor}
                    sizePx={social.iconSizePx}
                  />
                ) : (
                  renderSocialPlatformSvg(item.platform, social.iconSizePx)
                )}
                {social.showLabels && (
                  <span className="text-xs font-medium">{item.label}</span>
                )}
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBrandBlock = (centered = false) => {
    if (!brand.enabled) return null;
    const logoSrc = sanitizeHref(brand.logoUrl) || sanitizeHref(brand.altLogoUrl);

    return (
      <div className={`space-y-3.5 ${centered ? 'flex flex-col items-center text-center max-w-xl mx-auto' : ''}`}>
        {brand.showLogo && (
          <FooterNavLink
            url="/"
            previewMode={previewMode}
            className={`inline-flex items-center gap-2.5 ${centered ? 'justify-center' : ''}`}
          >
            {logoSrc ? (
              <SafeImage
                src={logoSrc}
                alt={brand.storeName}
                style={{ height: `${brand.logoHeightPx}px` }}
                className="w-auto max-w-[180px] object-contain"
              />
            ) : (
              <>
                <div
                  style={{ backgroundColor: general.accentColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                >
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p
                    style={{ color: general.headingColor }}
                    className="text-base font-extrabold leading-none"
                  >
                    {brand.storeName}
                  </p>
                  {brand.showTagline && brand.tagline && (
                    <p
                      style={{ color: general.linkHoverColor }}
                      className="text-[11px] font-medium mt-0.5"
                    >
                      {brand.tagline}
                    </p>
                  )}
                </div>
              </>
            )}
          </FooterNavLink>
        )}

        {brand.showDescription && brand.description && (
          <p className="text-xs opacity-80 leading-relaxed">{brand.description}</p>
        )}

        {brand.showContactInfo && (
          <ul className={`space-y-2 text-xs opacity-85 ${centered ? 'flex flex-wrap justify-center gap-4 space-y-0' : ''}`}>
            {brand.contactPhone && (
              <li className="flex items-start gap-2">
                <Phone style={{ color: general.linkHoverColor }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="tabular-nums">{brand.contactPhone}</span>
              </li>
            )}
            {brand.contactEmail && (
              <li className="flex items-start gap-2">
                <Mail style={{ color: general.linkHoverColor }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{brand.contactEmail}</span>
              </li>
            )}
            {brand.businessAddress && (
              <li className="flex items-start gap-2">
                <MapPin style={{ color: general.linkHoverColor }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{brand.businessAddress}</span>
              </li>
            )}
            {brand.businessHours && (
              <li className="flex items-start gap-2">
                <Clock style={{ color: general.linkHoverColor }} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{brand.businessHours}</span>
              </li>
            )}
          </ul>
        )}

        {brand.registrationInfo && (
          <p className="text-[11px] opacity-60">{brand.registrationInfo}</p>
        )}

        {renderSocialIcons()}
      </div>
    );
  };

  const renderMenuItem = (item: FooterMenuItemConfig) => (
    <li key={item.id} className="space-y-1">
      <FooterNavLink
        url={item.url}
        openInNewTab={item.openInNewTab}
        previewMode={previewMode}
        className={`inline-flex items-center gap-1.5 footer-link-${scopeId} transition-colors ${
          advanced.enableHoverAnimations ? 'hover:translate-x-0.5 transition-transform' : ''
        }`}
      >
        {item.iconType !== 'none' && (
          <NavIconRenderer
            iconType={item.iconType}
            iconName={item.iconName}
            iconSvg={item.iconSvg}
            iconImageUrl={item.iconImageUrl}
            sizePx={13}
          />
        )}
        <span>{item.label}</span>
        {item.badgeText && (
          <span
            style={{ backgroundColor: general.accentColor }}
            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white leading-none"
          >
            {item.badgeText}
          </span>
        )}
        {item.openInNewTab && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
      </FooterNavLink>
      {item.description && (
        <p className="text-[11px] opacity-60 pl-0.5">{item.description}</p>
      )}
      {item.children && item.children.length > 0 && (
        <ul className="pl-3 space-y-1 border-l border-white/15 mt-1">
          {item.children.map((sub) => (
            <li key={sub.id}>
              <FooterNavLink
                url={sub.url}
                openInNewTab={sub.openInNewTab}
                previewMode={previewMode}
                className={`inline-flex items-center gap-1 text-[11px] opacity-80 footer-link-${scopeId}`}
              >
                <ChevronRight className="w-2.5 h-2.5 opacity-60" />
                <span>{sub.label}</span>
              </FooterNavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  const renderColumn = (col: FooterColumnConfig) => {
    const isAccordion = general.mobileLayoutMode === 'accordion';
    const isOpenMobile = openColumnIds[col.id] ?? false;
    const alignClass =
      col.alignment === 'center'
        ? 'text-center items-center'
        : col.alignment === 'right'
        ? 'text-right items-end'
        : 'text-left items-start';

    return (
      <div
        key={col.id}
        data-footer-col={col.id}
        style={
          !isMobilePreview && col.width === 'custom'
            ? { minWidth: `${col.customWidthPx}px` }
            : undefined
        }
        className={`flex flex-col ${alignClass}`}
      >
        {/* Mobile accordion toggle or regular heading */}
        <button
          type="button"
          onClick={() => toggleMobileColumn(col.id)}
          aria-expanded={isOpenMobile}
          className={`w-full flex items-center justify-between gap-2 pb-2 border-b border-white/10 ${
            isMobilePreview && isAccordion
              ? 'flex'
              : isAccordion
              ? 'sm:hidden flex'
              : 'hidden'
          }`}
        >
          <span
            style={{
              color: general.headingColor,
              fontSize: `${general.headingSizePx}px`,
              fontWeight: general.headingFontWeight,
            }}
            className="inline-flex items-center gap-2"
          >
            {col.iconType !== 'none' && (
              <NavIconRenderer
                iconType={col.iconType}
                iconName={col.iconName}
                iconSvg={col.iconSvg}
                iconImageUrl={col.iconImageUrl}
                iconColor={col.iconColor || general.linkHoverColor}
                sizePx={15}
              />
            )}
            <span>{col.title}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpenMobile ? 'rotate-180' : ''}`}
          />
        </button>

        <h3
          style={{
            color: general.headingColor,
            fontSize: `${general.headingSizePx}px`,
            fontWeight: general.headingFontWeight,
          }}
          className={`items-center gap-2 mb-3 ${
            isMobilePreview && isAccordion
              ? 'hidden'
              : isAccordion
              ? 'hidden sm:inline-flex'
              : 'inline-flex'
          }`}
        >
          {col.iconType !== 'none' && (
            <NavIconRenderer
              iconType={col.iconType}
              iconName={col.iconName}
              iconSvg={col.iconSvg}
              iconImageUrl={col.iconImageUrl}
              iconColor={col.iconColor || general.linkHoverColor}
              sizePx={15}
            />
          )}
          <span>{col.title}</span>
        </h3>

        {col.description && (
          <p className="text-[11px] opacity-70 mb-2.5 leading-relaxed">{col.description}</p>
        )}

        <ul
          className={`space-y-2 w-full ${
            isMobilePreview && isAccordion
              ? isOpenMobile
                ? 'block pt-2.5'
                : 'hidden'
              : isAccordion
              ? isOpenMobile
                ? 'block pt-2.5 sm:pt-0 sm:block'
                : 'hidden sm:block'
              : 'block'
          }`}
        >
          {col.items.length > 0 ? (
            col.items.map(renderMenuItem)
          ) : (
            <li className="text-[11px] opacity-50 italic">No active links</li>
          )}
        </ul>
      </div>
    );
  };

  // Determine grid classes respecting previewViewport OR responsive Tailwind breakpoints
  const getColumnsGridClass = () => {
    const dCols = Math.min(6, Math.max(1, general.desktopColumns || 4));
    const tCols = general.tabletColumns || 2;
    const mCols = general.mobileColumns || 1;
    if (isMobilePreview) return mCols === 2 ? 'grid-cols-2' : 'grid-cols-1';
    if (isTabletPreview) {
      return tCols === 3 ? 'grid-cols-3' : tCols === 2 ? 'grid-cols-2' : 'grid-cols-1';
    }
    const mobileCls = mCols === 2 ? 'grid-cols-2' : 'grid-cols-1';
    const tabletCls = tCols === 3 ? 'sm:grid-cols-3' : tCols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1';
    const desktopMap: Record<number, string> = {
      1: 'lg:grid-cols-1',
      2: 'lg:grid-cols-2',
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
      5: 'lg:grid-cols-5',
      6: 'lg:grid-cols-6',
    };
    return `${mobileCls} ${tabletCls} ${desktopMap[dCols] || 'lg:grid-cols-4'}`;
  };

  const renderTrustBadgesRow = () => {
    if (!trustBadges.enabled || activeTrustBadges.length === 0) return null;
    return (
      <div
        style={{ borderColor: general.borderColor }}
        className={`grid ${
          isMobilePreview ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'
        } gap-3 py-4 border-t border-b`}
      >
        {activeTrustBadges.map((badge) => (
          <div
            key={badge.id}
            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div
              style={{ color: general.linkHoverColor }}
              className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0"
            >
              <NavIconRenderer iconType="lucide" iconName={badge.iconName} sizePx={16} />
            </div>
            <div className="min-w-0">
              <p style={{ color: general.headingColor }} className="text-xs font-bold truncate">
                {badge.title}
              </p>
              {badge.subtitle && (
                <p className="text-[11px] opacity-70 truncate">{badge.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPaymentBadges = () => {
    if (!payments.enabled || visiblePaymentBadges.length === 0) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {payments.title && <span className="text-xs opacity-80 mr-1">{payments.title}</span>}
        {visiblePaymentBadges.map((badge) => (
          <span
            key={badge.id}
            style={{
              backgroundColor: badge.bgColor || '#FFFFFF',
              color: badge.textColor || '#0F172A',
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-bold text-[10px] shadow-2xs"
          >
            {badge.iconImageUrl && (
              <SafeImage
                src={badge.iconImageUrl}
                alt={badge.label}
                className="h-3.5 w-auto object-contain"
              />
            )}
            <span>{badge.label}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <footer
      data-testid="storefront-footer"
      data-footer-scope={scopeAttr}
      style={{
        background: backgroundStyle,
        color: general.textColor,
        borderTopWidth: `${general.borderTopWidthPx}px`,
        borderTopStyle: 'solid',
        borderTopColor: general.borderColor,
        borderRadius: `${general.borderRadiusPx}px`,
        fontFamily: general.fontFamily,
        fontSize: `${general.bodySizePx}px`,
      }}
      className={`${visibilityClass} ${shadowClass} overflow-hidden`}
    >
      <style>{`
        [data-footer-scope="${scopeAttr}"] .footer-link-${scopeId} {
          color: ${general.linkColor};
        }
        [data-footer-scope="${scopeAttr}"] .footer-link-${scopeId}:hover {
          color: ${general.linkHoverColor};
        }
        [data-footer-scope="${scopeAttr}"] .footer-social-btn-${scopeId}:hover {
          background-color: ${general.accentColor} !important;
          color: ${social.hoverColor} !important;
        }
        ${customCssSafe ? `[data-footer-scope="${scopeAttr}"] { ${customCssSafe} }` : ''}
      `}</style>

      {general.layoutPreset === 'minimal_bar' ? (
        <div
          style={{
            maxWidth: maxWidthStyle,
            paddingTop: `${Math.min(general.paddingTopPx, 28)}px`,
            paddingBottom: `${Math.min(general.paddingBottomPx, 28)}px`,
            paddingLeft: `${general.paddingXPx}px`,
            paddingRight: `${general.paddingXPx}px`,
          }}
          className="mx-auto space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{ color: general.headingColor }} className="text-sm font-extrabold">
                {brand.storeName}
              </span>
              {visibleColumns.flatMap((c) => c.items).slice(0, 6).map((it) => (
                <FooterNavLink
                  key={it.id}
                  url={it.url}
                  openInNewTab={it.openInNewTab}
                  previewMode={previewMode}
                  className={`text-xs footer-link-${scopeId}`}
                >
                  {it.label}
                </FooterNavLink>
              ))}
            </div>
            {renderSocialIcons()}
          </div>
          {renderPaymentBadges()}
        </div>
      ) : (
        <div
          style={{
            maxWidth: maxWidthStyle,
            paddingTop: `${general.paddingTopPx}px`,
            paddingBottom: `${general.paddingBottomPx}px`,
            paddingLeft: `${general.paddingXPx}px`,
            paddingRight: `${general.paddingXPx}px`,
            rowGap: `${general.sectionGapPx}px`,
          }}
          className="mx-auto flex flex-col"
        >
          {/* Top Newsletter Banner */}
          {newsletter.enabled && newsletter.placement === 'top_banner' && renderNewsletterSection(false)}

          {/* Main Body */}
          {general.layoutPreset === 'centered_compact' ? (
            <div className="space-y-8">
              {renderBrandBlock(true)}
              <div
                style={{ columnGap: `${general.columnGapPx}px`, rowGap: `${general.sectionGapPx}px` }}
                className={`grid ${getColumnsGridClass()}`}
              >
                {visibleColumns.map(renderColumn)}
              </div>
            </div>
          ) : (
            <div
              style={{ columnGap: `${general.columnGapPx}px`, rowGap: `${general.sectionGapPx}px` }}
              className={`grid ${getColumnsGridClass()}`}
            >
              {brand.enabled && <div>{renderBrandBlock(false)}</div>}
              {visibleColumns.map(renderColumn)}
              {newsletter.enabled && newsletter.placement === 'column' && (
                <div>{renderNewsletterSection(true)}</div>
              )}
            </div>
          )}

          {/* Trust Badges */}
          {renderTrustBadgesRow()}

          {/* Bottom Newsletter Placement */}
          {newsletter.enabled && newsletter.placement === 'above_bottom_bar' && renderNewsletterSection(false)}

          {/* Payment Methods if bottomBar is disabled */}
          {!bottomBar.enabled && renderPaymentBadges()}
        </div>
      )}

      {/* Bottom Bar */}
      {bottomBar.enabled && (
        <div
          style={{
            backgroundColor: bottomBar.backgroundColor,
            color: bottomBar.textColor,
            borderTopWidth: advanced.showDividerAboveBottomBar ? '1px' : '0px',
            borderTopStyle: 'solid',
            borderTopColor: bottomBar.borderColor,
          }}
        >
          <div
            style={{
              maxWidth: maxWidthStyle,
              paddingLeft: `${general.paddingXPx}px`,
              paddingRight: `${general.paddingXPx}px`,
            }}
            className={`mx-auto py-4 flex ${
              isMobilePreview
                ? 'flex-col items-center text-center'
                : 'flex-col lg:flex-row items-center justify-between'
            } gap-4 text-xs`}
          >
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1.5">
              <p>{copyrightText}</p>
              {bottomBar.developerCreditText && (
                <span className="opacity-75">
                  {bottomBar.developerCreditUrl ? (
                    <FooterNavLink
                      url={bottomBar.developerCreditUrl}
                      openInNewTab
                      previewMode={previewMode}
                      className="underline hover:text-white"
                    >
                      {bottomBar.developerCreditText}
                    </FooterNavLink>
                  ) : (
                    bottomBar.developerCreditText
                  )}
                </span>
              )}
              {activeBottomLinks.length > 0 && (
                <div className="flex items-center flex-wrap gap-2.5 pl-1">
                  {activeBottomLinks.map((lnk) => (
                    <FooterNavLink
                      key={lnk.id}
                      url={lnk.url}
                      openInNewTab={lnk.openInNewTab}
                      previewMode={previewMode}
                      className={`footer-link-${scopeId} hover:underline`}
                    >
                      {lnk.label}
                    </FooterNavLink>
                  ))}
                </div>
              )}
              {bottomBar.showAdminAccess && onAdminAccessClick && (
                <button
                  type="button"
                  onClick={previewMode ? undefined : onAdminAccessClick}
                  aria-label="Administrator Sign In"
                  title="Admin Access"
                  data-testid="footer-admin-access-btn"
                  className="w-6 h-6 rounded-md inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:text-emerald-400 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center">
              {renderPaymentBadges()}
              {advanced.backToTopEnabled && !previewMode && (
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  aria-label="Back to top"
                  title="Back to top"
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition-colors"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
