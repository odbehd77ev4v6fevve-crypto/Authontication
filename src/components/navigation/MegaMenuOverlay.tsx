import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Headset,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  computeMegaMenuGridColumnsClass,
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  type MegaMenuSectionId,
  type NavigationItemRecord,
  type NavigationMenuRecord,
  type ResolvedNavCategory,
  type ResolvedNavProduct,
} from '../../../shared/megaMenuHelpers.ts';
import { sanitizeHref } from '../../../shared/security.ts';
import { formatBdt } from '../../lib/api.ts';
import { SafeImage } from '../ui/SafeImage.tsx';
import { MegaMenuPromoSlider } from './MegaMenuPromoSlider.tsx';
import { NavIconRenderer } from './NavIconRenderer.tsx';

interface MegaMenuOverlayProps {
  menu: NavigationMenuRecord;
  fallbackPhone?: string;
  onClose: () => void;
  previewMode?: boolean;
  forcedViewport?: 'desktop' | 'tablet';
}

function isExternalHref(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function NavLinkElement({
  url,
  openInNewTab,
  className,
  style,
  onClick,
  onFocus,
  onMouseEnter,
  children,
}: {
  url: string;
  openInNewTab?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onFocus?: () => void;
  onMouseEnter?: () => void;
  children: React.ReactNode;
}) {
  const safe = sanitizeHref(url) || '/shop';
  if (openInNewTab || isExternalHref(safe)) {
    return (
      <a
        href={safe}
        target={openInNewTab ? '_blank' : undefined}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        onClick={onClick}
        onFocus={onFocus}
        onMouseEnter={onMouseEnter}
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      to={safe}
      onClick={onClick}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      className={className}
      style={style}
    >
      {children}
    </Link>
  );
}

export function MegaMenuOverlay({
  menu,
  fallbackPhone = '+880 1234 567890',
  onClose,
  previewMode = false,
  forcedViewport = 'desktop',
}: MegaMenuOverlayProps) {
  const layout = { ...DEFAULT_MEGA_MENU_LAYOUT, ...(menu.megaMenuConfig || {}) };
  const appearance = { ...DEFAULT_MEGA_MENU_APPEARANCE, ...(menu.appearanceConfig || {}) };

  const [selectedSidebarKey, setSelectedSidebarKey] = useState<string>('__all__');
  const [hoveredNestedId, setHoveredNestedId] = useState<string | null>(null);
  const [hoveredLevel2Id, setHoveredLevel2Id] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSidebarKey(layout.showAllCategoriesEntry ? '__all__' : menu.categoriesTree?.[0]?._id || menu.items?.[0]?._id || '__all__');
    setHoveredNestedId(null);
    setHoveredLevel2Id(null);
  }, [menu._id, layout.showAllCategoriesEntry]);

  const categories = menu.categoriesTree || [];
  const customItems = menu.items || [];
  const slides = menu.slides || [];

  const isDropdownOnly =
    menu.menuType === 'classic_dropdown' || menu.menuType === 'nested_dropdown';

  const shadowClass =
    appearance.shadow === 'none'
      ? ''
      : appearance.shadow === 'sm'
      ? 'shadow-sm'
      : appearance.shadow === 'md'
      ? 'shadow-md'
      : appearance.shadow === 'xl'
      ? 'shadow-xl'
      : 'shadow-[0_24px_60px_-15px_rgba(15,23,42,0.22)]';

  const animClass =
    appearance.animation === 'none'
      ? ''
      : appearance.animation === 'slide_down'
      ? 'mega-menu-anim-slide_down'
      : appearance.animation === 'scale'
      ? 'mega-menu-anim-scale'
      : 'mega-menu-anim-fade';

  const colCount =
    forcedViewport === 'tablet'
      ? menu.responsiveConfig?.tabletColumns || 2
      : computeMegaMenuGridColumnsClass(layout.columns, layout.customColumnCount);

  const gridColsClass =
    colCount === 1
      ? 'grid-cols-1'
      : colCount === 3
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      : colCount === 4
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 md:grid-cols-2';

  const hasSlidesToShow = layout.showSlider && slides.length > 0;

  const dividerClass =
    appearance.dividerStyle === 'none'
      ? 'border-transparent'
      : appearance.dividerStyle === 'dashed'
      ? 'border-dashed'
      : 'border-solid';

  const handleLinkClick = () => {
    if (!previewMode) onClose();
  };

  // Build unified sidebar entries: either dynamic categoriesTree OR manual top-level items if categoryMode === 'manual'
  const sidebarEntries = useMemo(() => {
    if (menu.categoryMode !== 'manual' && categories.length > 0) {
      return categories.map((c) => ({
        key: `cat:${c._id}`,
        label: c.name,
        url: `/category/${c.slug}`,
        iconType: 'lucide' as const,
        iconName: c.iconName || 'LayoutGrid',
        iconColor: c.iconColor,
        iconBgColor: c.iconBgColor,
        imageUrl: c.imageUrl,
        badgeText: '',
        category: c,
        item: undefined as NavigationItemRecord | undefined,
      }));
    }
    return customItems.map((it) => ({
      key: `item:${it._id}`,
      label: it.label,
      url: it.url,
      iconType: it.iconType,
      iconName: it.iconName,
      iconColor: it.iconColor,
      iconBgColor: it.iconBgColor,
      imageUrl: it.imageUrl,
      badgeText: it.badgeText,
      category: undefined as ResolvedNavCategory | undefined,
      item: it,
    }));
  }, [menu.categoryMode, categories, customItems]);

  const focusedEntry = useMemo(
    () => sidebarEntries.find((e) => e.key === selectedSidebarKey) || null,
    [sidebarEntries, selectedSidebarKey]
  );

  // Classic / Multi-Level Nested Dropdown Renderer
  if (isDropdownOnly) {
    const hoveredNode = customItems.find((i) => i._id === hoveredNestedId);
    return (
      <div
        role="menu"
        aria-label={menu.name}
        onMouseLeave={() => {
          setHoveredNestedId(null);
          setHoveredLevel2Id(null);
        }}
        style={
          {
            backgroundColor: appearance.backgroundColor,
            borderColor: appearance.borderColor,
            borderRadius: `${appearance.borderRadiusPx}px`,
            color: appearance.textColor,
            fontFamily: appearance.fontFamily,
            '--mm-dur': `${appearance.animationDurationMs}ms`,
          } as CSSProperties
        }
        className={`border ${shadowClass} ${animClass} min-w-[240px] max-w-[300px] py-2 relative`}
      >
        {customItems.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-500">No items configured.</div>
        ) : (
          customItems.map((item) => {
            const hasChildren = Boolean(item.children && item.children.length > 0);
            return (
              <div
                key={item._id}
                className="relative"
                onMouseEnter={() => {
                  setHoveredNestedId(hasChildren ? item._id : null);
                  setHoveredLevel2Id(null);
                }}
              >
                <NavLinkElement
                  url={item.url}
                  openInNewTab={item.openInNewTab}
                  onClick={handleLinkClick}
                  onFocus={() => {
                    setHoveredNestedId(hasChildren ? item._id : null);
                    setHoveredLevel2Id(null);
                  }}
                  className="flex items-center justify-between gap-2.5 px-4 py-2 text-sm font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.iconType !== 'none' && (
                      <NavIconRenderer
                        iconType={item.iconType}
                        iconName={item.iconName}
                        iconSvg={item.iconSvg}
                        iconImageUrl={item.iconImageUrl}
                        iconColor={item.iconColor}
                        sizePx={16}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.badgeText && (
                      <span
                        style={{
                          backgroundColor: item.badgeBgColor || '#16A34A',
                          color: item.badgeTextColor || '#FFFFFF',
                        }}
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      >
                        {item.badgeText}
                      </span>
                    )}
                    {hasChildren && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                  </span>
                </NavLinkElement>

                {hasChildren && hoveredNode?._id === item._id && (
                  <div
                    role="menu"
                    aria-label={`${item.label} submenu`}
                    style={{
                      backgroundColor: appearance.backgroundColor,
                      borderColor: appearance.borderColor,
                      borderRadius: `${Math.max(10, appearance.borderRadiusPx - 4)}px`,
                    }}
                    className="absolute left-full top-0 ml-1 w-60 border shadow-xl py-2 z-50"
                  >
                    {item.children!.map((child) => {
                      const hasLevel3 = Boolean(child.children && child.children.length > 0);
                      return (
                        <div
                          key={child._id}
                          className="relative"
                          onMouseEnter={() => setHoveredLevel2Id(hasLevel3 ? child._id : null)}
                        >
                          <NavLinkElement
                            url={child.url}
                            openInNewTab={child.openInNewTab}
                            onClick={handleLinkClick}
                            onFocus={() => setHoveredLevel2Id(hasLevel3 ? child._id : null)}
                            className="flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          >
                            <span className="truncate">{child.label}</span>
                            {hasLevel3 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                          </NavLinkElement>

                          {hasLevel3 && hoveredLevel2Id === child._id && (
                            <div
                              role="menu"
                              aria-label={`${child.label} submenu`}
                              style={{
                                backgroundColor: appearance.backgroundColor,
                                borderColor: appearance.borderColor,
                                borderRadius: `${Math.max(10, appearance.borderRadiusPx - 4)}px`,
                              }}
                              className="absolute left-full top-0 ml-1 w-56 border shadow-xl py-2 z-50"
                            >
                              {child.children!.map((grandChild) => (
                                <NavLinkElement
                                  key={grandChild._id}
                                  url={grandChild.url}
                                  openInNewTab={grandChild.openInNewTab}
                                  onClick={handleLinkClick}
                                  className="flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                >
                                  <span className="truncate">{grandChild.label}</span>
                                </NavLinkElement>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  const renderProductMiniCard = (prod: ResolvedNavProduct) => (
    <Link
      key={prod._id}
      to={`/product/${prod.slug}`}
      onClick={handleLinkClick}
      className="group flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all bg-white"
    >
      <div className="w-11 h-11 rounded-lg bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
        <SafeImage
          src={prod.imageUrl}
          alt={prod.name}
          loading="lazy"
          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 truncate">
          {prod.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-bold text-[#16A34A] tabular-nums">
            {formatBdt(prod.effectivePrice)}
          </span>
          {prod.originalPrice && prod.originalPrice > prod.effectivePrice && (
            <span className="text-[10px] text-slate-400 line-through tabular-nums">
              {formatBdt(prod.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );

  const renderCategoryGroupCard = (cat: ResolvedNavCategory) => {
    const visibleSubs = cat.subcategories.slice(0, layout.maxSubcategoriesPerGroup || 6);
    return (
      <div
        key={cat._id}
        className={`pb-2.5 border-b ${dividerClass}`}
        style={{ borderColor: appearance.dividerStyle === 'none' ? 'transparent' : '#F1F5F9' }}
      >
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
          <Link
            to={`/category/${cat.slug}`}
            onClick={handleLinkClick}
            className="flex items-center gap-2 min-w-0 group"
          >
            {layout.showCategoryIcons && (
              <span
                style={{
                  backgroundColor: cat.iconBgColor || '#DCFCE7',
                  color: cat.iconColor || '#16A34A',
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
              >
                {menu.menuType === 'image_based_mega_menu' && cat.imageUrl ? (
                  <SafeImage
                    src={cat.imageUrl}
                    alt={cat.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                ) : (
                  <NavIconRenderer
                    iconType="lucide"
                    iconName={cat.iconName || 'LayoutGrid'}
                    iconColor={cat.iconColor || '#16A34A'}
                    sizePx={appearance.iconSizePx || 16}
                  />
                )}
              </span>
            )}
            <span className="text-[13.5px] font-bold tracking-tight group-hover:text-[#16A34A] transition-colors truncate">
              {cat.name}
            </span>
          </Link>

          {layout.showViewAllLinks && (
            <Link
              to={`/category/${cat.slug}`}
              onClick={handleLinkClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] hover:text-emerald-700 whitespace-nowrap shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {visibleSubs.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {visibleSubs.map((sub) => (
              <li key={sub._id}>
                <Link
                  to={`/category/${sub.slug}`}
                  onClick={handleLinkClick}
                  className="group flex items-center gap-1.5 text-[12px] leading-snug opacity-85 hover:opacity-100 hover:text-[#16A34A] transition-colors py-0.5"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-[#16A34A] group-hover:translate-x-0.5 transition-all shrink-0" />
                  {layout.showSubcategoryIcons && sub.imageUrl && (
                    <SafeImage src={sub.imageUrl} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                  )}
                  <span className="truncate">{sub.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs opacity-60">
            Explore curated {cat.name.toLowerCase()} products
          </p>
        )}

        {layout.showProductImages && cat.featuredProducts && cat.featuredProducts.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {cat.featuredProducts.map(renderProductMiniCard)}
          </div>
        )}
      </div>
    );
  };

  const renderCustomItemGroupCard = (item: NavigationItemRecord) => {
    const children = item.children || [];
    return (
      <div key={item._id} className="pb-3 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <NavLinkElement
            url={item.url}
            openInNewTab={item.openInNewTab}
            onClick={handleLinkClick}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            {item.iconType !== 'none' && (
              <span
                style={{
                  backgroundColor: item.iconBgColor || '#DCFCE7',
                  color: item.iconColor || '#16A34A',
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              >
                <NavIconRenderer
                  iconType={item.iconType}
                  iconName={item.iconName}
                  iconSvg={item.iconSvg}
                  iconImageUrl={item.iconImageUrl}
                  iconColor={item.iconColor}
                  sizePx={17}
                />
              </span>
            )}
            <div className="min-w-0">
              <span className="text-[14px] font-bold group-hover:text-[#16A34A] transition-colors flex items-center gap-1.5 truncate">
                {item.label}
                {item.badgeText && (
                  <span
                    style={{
                      backgroundColor: item.badgeBgColor || '#16A34A',
                      color: item.badgeTextColor || '#FFFFFF',
                    }}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  >
                    {item.badgeText}
                  </span>
                )}
              </span>
              {item.description && (
                <p className="text-[11px] opacity-65 truncate">{item.description}</p>
              )}
            </div>
          </NavLinkElement>

          {layout.showViewAllLinks && (
            <NavLinkElement
              url={item.url}
              openInNewTab={item.openInNewTab}
              onClick={handleLinkClick}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] hover:text-emerald-700 shrink-0"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </NavLinkElement>
          )}
        </div>

        {item.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-100 h-24 bg-slate-50">
            <SafeImage src={item.imageUrl} alt={item.label} className="w-full h-full object-cover" />
          </div>
        )}

        {children.length > 0 && (
          <ul className="space-y-1">
            {children.map((child) => (
              <li key={child._id}>
                <NavLinkElement
                  url={child.url}
                  openInNewTab={child.openInNewTab}
                  onClick={handleLinkClick}
                  className="group flex items-center gap-1.5 text-[12.5px] opacity-85 hover:opacity-100 hover:text-[#16A34A] py-0.5"
                >
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-[#16A34A] shrink-0" />
                  <span className="truncate">{child.label}</span>
                </NavLinkElement>
              </li>
            ))}
          </ul>
        )}

        {item.resolvedProducts && item.resolvedProducts.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5">
            {item.resolvedProducts.map(renderProductMiniCard)}
          </div>
        )}

        {item.structuredBlocks && item.structuredBlocks.length > 0 && (
          <div className="space-y-2">
            {item.structuredBlocks.map((block, bIdx) => (
              <div key={bIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                {block.badgeText && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    {block.badgeText}
                  </span>
                )}
                {block.title && <p className="text-xs font-bold">{block.title}</p>}
                {block.body && <p className="text-[11px] opacity-75">{block.body}</p>}
                {block.items && block.items.length > 0 && (
                  <ul className="space-y-0.5 text-[11px] opacity-80 list-disc pl-4">
                    {block.items.map((line, lIdx) => (
                      <li key={lIdx}>{line}</li>
                    ))}
                  </ul>
                )}
                {block.ctaText && block.ctaUrl && (
                  <NavLinkElement
                    url={block.ctaUrl}
                    onClick={handleLinkClick}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] hover:underline pt-0.5"
                  >
                    <span>{block.ctaText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </NavLinkElement>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (sectionId: MegaMenuSectionId) => {
    if (sectionId === 'sidebar') {
      if (!layout.showSidebar) return null;
      return (
        <aside
          key="sidebar"
          style={{
            width:
              forcedViewport === 'tablet'
                ? '195px'
                : previewMode
                ? `min(${layout.sidebarWidthPx}px, 24%)`
                : `${layout.sidebarWidthPx}px`,
            backgroundColor: appearance.sidebarBgColor,
          }}
          className="shrink-0 border-r border-slate-100 flex flex-col justify-between p-2"
          aria-label="Category quick switcher"
        >
          <div className="mega-menu-scroll overflow-y-auto pr-1 space-y-0.5 max-h-[430px]">
            {layout.showAllCategoriesEntry && (
              <button
                type="button"
                onMouseEnter={() => setSelectedSidebarKey('__all__')}
                onFocus={() => setSelectedSidebarKey('__all__')}
                onClick={() => setSelectedSidebarKey('__all__')}
                style={
                  selectedSidebarKey === '__all__'
                    ? {
                        backgroundColor: appearance.activeBgColor,
                        color: appearance.activeTextColor,
                      }
                    : undefined
                }
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                  selectedSidebarKey === '__all__' ? '' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className="w-6 h-6 rounded-md bg-[#16A34A] text-white flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{layout.allCategoriesLabel || 'All Categories'}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-75" />
              </button>
            )}

            {sidebarEntries.length === 0 ? (
              <p className="px-3 py-4 text-xs opacity-60">No categories published yet.</p>
            ) : (
              sidebarEntries.map((entry) => {
                const isActive = selectedSidebarKey === entry.key;
                return (
                  <NavLinkElement
                    key={entry.key}
                    url={entry.url}
                    onClick={handleLinkClick}
                    onMouseEnter={() => setSelectedSidebarKey(entry.key)}
                    onFocus={() => setSelectedSidebarKey(entry.key)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-colors`}
                    style={
                      isActive
                        ? {
                            backgroundColor: appearance.activeBgColor,
                            color: appearance.activeTextColor,
                            fontWeight: 600,
                          }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0 flex-1">
                      {entry.imageUrl && menu.menuType === 'image_based_mega_menu' ? (
                        <SafeImage
                          src={entry.imageUrl}
                          alt=""
                          className="w-5 h-5 rounded object-cover shrink-0"
                        />
                      ) : (
                        <NavIconRenderer
                          iconType={entry.iconType}
                          iconName={entry.iconName}
                          iconColor={isActive ? appearance.activeTextColor : '#64748B'}
                          sizePx={16}
                        />
                      )}
                      <span className="truncate">{entry.label}</span>
                      {entry.badgeText && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold shrink-0">
                          {entry.badgeText}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  </NavLinkElement>
                );
              })
            )}
          </div>

          {layout.showHelpCard && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-[#ECFDF5] border border-emerald-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white text-[#16A34A] shadow-xs flex items-center justify-center shrink-0">
                <Headset className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-900 leading-tight">
                  {layout.helpCardTitle || 'Need Help?'}
                </p>
                <p className="text-[11px] font-semibold text-[#15803D] truncate tabular-nums">
                  Call Us: {layout.helpCardPhone || fallbackPhone}
                </p>
              </div>
            </div>
          )}
        </aside>
      );
    }

    if (sectionId === 'grid') {
      if (!layout.showGrid) return null;

      // Determine grid content based on selectedSidebarKey & menuType
      const renderMiddleContent = () => {
        // Featured Product Mega Menu special view when categoryMode is manual & no custom items
        if (
          menu.menuType === 'featured_product_mega_menu' &&
          menu.resolvedGroups?.featuredProducts?.length &&
          customItems.length === 0
        ) {
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#16A34A]" />
                  <span>Featured Products</span>
                </h4>
                <Link
                  to="/shop?featured=true"
                  onClick={handleLinkClick}
                  className="text-xs font-bold text-[#16A34A] hover:underline flex items-center gap-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {menu.resolvedGroups.featuredProducts.map(renderProductMiniCard)}
              </div>
            </div>
          );
        }

        // Focused single category selected from sidebar
        if (focusedEntry?.category) {
          const cat = focusedEntry.category;
          const restCats = categories.filter((c) => c._id !== cat._id).slice(0, 3);
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span
                    style={{
                      backgroundColor: cat.iconBgColor || '#DCFCE7',
                      color: cat.iconColor || '#16A34A',
                    }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <NavIconRenderer
                      iconType="lucide"
                      iconName={cat.iconName || 'LayoutGrid'}
                      iconColor={cat.iconColor || '#16A34A'}
                      sizePx={19}
                    />
                  </span>
                  <div>
                    <h4 className="text-base font-extrabold">{cat.name}</h4>
                    {cat.nameBn && <p className="text-[11px] opacity-65">{cat.nameBn}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {layout.showAllCategoriesEntry && (
                    <button
                      type="button"
                      onClick={() => setSelectedSidebarKey('__all__')}
                      className="text-xs font-semibold opacity-70 hover:opacity-100"
                    >
                      All Categories
                    </button>
                  )}
                  <Link
                    to={`/category/${cat.slug}`}
                    onClick={handleLinkClick}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-[#15803D] text-xs font-bold hover:bg-emerald-100"
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {cat.subcategories.length > 0 ? (
                <div className={`grid ${gridColsClass} gap-3`}>
                  {cat.subcategories.map((sub) => (
                    <Link
                      key={sub._id}
                      to={`/category/${sub.slug}`}
                      onClick={handleLinkClick}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChevronRight className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                        <span className="text-xs font-semibold group-hover:text-[#15803D] truncate">
                          {sub.name}
                        </span>
                      </span>
                      {sub.imageUrl && (
                        <SafeImage
                          src={sub.imageUrl}
                          alt={sub.name}
                          className="w-7 h-7 rounded object-cover shrink-0"
                        />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs opacity-70 py-2">
                  Browse all items inside {cat.name}.
                </p>
              )}

              {cat.featuredProducts && cat.featuredProducts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    Popular in {cat.name}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.featuredProducts.map(renderProductMiniCard)}
                  </div>
                </div>
              )}

              {restCats.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-55 mb-2">
                    Related Departments
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {restCats.map(renderCategoryGroupCard)}
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (focusedEntry?.item) {
          return (
            <div className="grid grid-cols-1 gap-4">
              {renderCustomItemGroupCard(focusedEntry.item)}
            </div>
          );
        }

        // Default "All Categories" multi-column grid view (reference screenshot!)
        if (menu.categoryMode !== 'manual' && categories.length > 0) {
          return (
            <div className="space-y-3">
              <div className={`grid ${gridColsClass} gap-x-5 gap-y-3`}>
                {categories.map(renderCategoryGroupCard)}
              </div>
              {customItems.length > 0 && (
                <div className={`grid ${gridColsClass} gap-x-5 gap-y-3 pt-2.5 border-t border-slate-100`}>
                  {customItems.map(renderCustomItemGroupCard)}
                </div>
              )}
            </div>
          );
        }

        if (customItems.length > 0) {
          return (
            <div className={`grid ${gridColsClass} gap-x-6 gap-y-4`}>
              {customItems.map(renderCustomItemGroupCard)}
            </div>
          );
        }

        return (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold">No categories or menu items configured</p>
            <p className="text-xs opacity-70">
              Add categories or menu items from the Admin Navigation Manager.
            </p>
          </div>
        );
      };

      return (
        <div
          key="grid"
          style={
            layout.gridWidthMode === 'custom'
              ? { width: `${layout.gridWidthPx}px` }
              : undefined
          }
          className={`${
            layout.gridWidthMode === 'flex' ? 'flex-1 min-w-0' : 'shrink-0'
          } mega-menu-scroll overflow-y-auto px-4 py-3`}
        >
          {renderMiddleContent()}
        </div>
      );
    }

    if (sectionId === 'slider') {
      if (!hasSlidesToShow) return null;
      return (
        <div
          key="slider"
          style={{
            width:
              forcedViewport === 'tablet'
                ? '250px'
                : previewMode
                ? `min(${layout.sliderWidthPx}px, 31%)`
                : `${layout.sliderWidthPx}px`,
          }}
          className="shrink-0 p-2"
        >
          <MegaMenuPromoSlider
            slides={slides}
            sliderSettings={menu.sliderSettings}
            onNavigate={handleLinkClick}
          />
        </div>
      );
    }

    return null;
  };

  const orderedSections = (layout.sectionOrder?.length
    ? layout.sectionOrder
    : ['sidebar', 'grid', 'slider']) as MegaMenuSectionId[];

  const maxH = Math.min(720, Math.max(300, appearance.maxHeightPx || 560));

  return (
    <div
      role="region"
      aria-label={menu.name}
      style={
        {
          backgroundColor: appearance.backgroundColor,
          borderColor: appearance.borderColor,
          borderRadius: `${appearance.borderRadiusPx}px`,
          color: appearance.textColor,
          fontFamily: appearance.fontFamily,
          fontSize: `${appearance.textSizePx}px`,
          maxHeight: previewMode ? `${maxH}px` : `min(${maxH}px, calc(100vh - 150px))`,
          padding: `${Math.max(4, Math.min(20, appearance.paddingPx / 2))}px`,
          gap: `${Math.max(4, Math.min(24, appearance.gapPx / 2))}px`,
          '--mm-dur': `${appearance.animationDurationMs}ms`,
        } as CSSProperties
      }
      className={`border ${shadowClass} ${animClass} flex items-stretch overflow-hidden w-full`}
    >
      {orderedSections.map(renderSection)}
    </div>
  );
}
