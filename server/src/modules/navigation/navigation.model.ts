import mongoose, { Schema, type Document } from 'mongoose';
import {
  DEFAULT_MEGA_MENU_APPEARANCE,
  DEFAULT_MEGA_MENU_LAYOUT,
  DEFAULT_RESPONSIVE_CONFIG,
  DEFAULT_SLIDER_SETTINGS,
  MENU_ITEM_TYPES,
  MENU_PLACEMENTS,
  MENU_STATUSES,
  MENU_TEMPLATES,
  MENU_TYPES,
  MENU_VISIBILITIES,
  type MegaMenuAppearanceConfig,
  type MegaMenuLayoutConfig,
  type MegaMenuResponsiveConfig,
  type MegaMenuSliderSettings,
  type NavigationItemType,
  type NavigationMenuStatus,
  type NavigationMenuType,
  type NavigationMenuVisibility,
  type NavigationPlacementKey,
  type StructuredContentBlock,
} from '../../../../shared/megaMenuHelpers.ts';

export interface INavigationPlacement extends Document {
  key: NavigationPlacementKey;
  label: string;
  description: string;
  allowMultipleActive: boolean;
  defaultMenuType: NavigationMenuType;
  createdAt: Date;
  updatedAt: Date;
}

const NavigationPlacementSchema = new Schema<INavigationPlacement>(
  {
    key: {
      type: String,
      enum: MENU_PLACEMENTS,
      required: true,
      unique: true,
      index: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 260, default: '' },
    allowMultipleActive: { type: Boolean, default: false },
    defaultMenuType: {
      type: String,
      enum: MENU_TYPES,
      default: 'mega_menu',
    },
  },
  { timestamps: true }
);

export const NavigationPlacementModel =
  mongoose.models.NavigationPlacement ||
  mongoose.model<INavigationPlacement>('NavigationPlacement', NavigationPlacementSchema);

export interface INavigationMenu extends Document {
  name: string;
  slug: string;
  menuType: NavigationMenuType;
  placement: NavigationPlacementKey;
  description: string;
  status: NavigationMenuStatus;
  visibility: NavigationMenuVisibility;
  displayOrder: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  targetPaths: string[];
  categoryMode: 'auto' | 'hybrid' | 'manual';
  includedCategoryIds: mongoose.Types.ObjectId[];
  excludedCategoryIds: mongoose.Types.ObjectId[];
  maxDepth: number;
  megaMenuConfig: MegaMenuLayoutConfig;
  appearanceConfig: MegaMenuAppearanceConfig;
  responsiveConfig: MegaMenuResponsiveConfig;
  sliderSettings: MegaMenuSliderSettings;
  createdBy?: mongoose.Types.ObjectId | null;
  createdByName: string;
  updatedBy?: mongoose.Types.ObjectId | null;
  updatedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const NavigationMenuSchema = new Schema<INavigationMenu>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    menuType: {
      type: String,
      enum: MENU_TYPES,
      default: 'category_mega_menu',
      index: true,
    },
    placement: {
      type: String,
      enum: MENU_PLACEMENTS,
      required: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 360, default: '' },
    status: {
      type: String,
      enum: MENU_STATUSES,
      default: 'draft',
      index: true,
    },
    visibility: {
      type: String,
      enum: MENU_VISIBILITIES,
      default: 'public',
    },
    displayOrder: { type: Number, default: 0, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    targetPaths: { type: [String], default: [] },
    categoryMode: {
      type: String,
      enum: ['auto', 'hybrid', 'manual'],
      default: 'auto',
    },
    includedCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    excludedCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    maxDepth: { type: Number, default: 4, min: 1, max: 5 },
    megaMenuConfig: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_MEGA_MENU_LAYOUT }),
    },
    appearanceConfig: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_MEGA_MENU_APPEARANCE }),
    },
    responsiveConfig: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_RESPONSIVE_CONFIG }),
    },
    sliderSettings: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_SLIDER_SETTINGS }),
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: 'System' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: 'System' },
  },
  { timestamps: true }
);

NavigationMenuSchema.index({ placement: 1, status: 1, displayOrder: 1 });
NavigationMenuSchema.index({ updatedAt: -1 });

export const NavigationMenuModel =
  mongoose.models.NavigationMenu ||
  mongoose.model<INavigationMenu>('NavigationMenu', NavigationMenuSchema);

export interface INavigationItem extends Document {
  menuId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId | null;
  label: string;
  itemType: NavigationItemType;
  targetId?: string | null;
  targetSlug: string;
  url: string;
  openInNewTab: boolean;
  iconType: 'lucide' | 'svg' | 'image' | 'none';
  iconName: string;
  iconSvg: string;
  iconImageUrl: string;
  iconImagePublicId: string;
  iconColor: string;
  iconBgColor: string;
  imageUrl: string;
  imagePublicId: string;
  badgeText: string;
  badgeBgColor: string;
  badgeTextColor: string;
  description: string;
  structuredBlocks: StructuredContentBlock[];
  featuredGroupLimit: number;
  columnIndex: number;
  displayOrder: number;
  isVisible: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const NavigationItemSchema = new Schema<INavigationItem>(
  {
    menuId: { type: Schema.Types.ObjectId, ref: 'NavigationMenu', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'NavigationItem', default: null, index: true },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    itemType: {
      type: String,
      enum: MENU_ITEM_TYPES,
      default: 'internal_route',
    },
    targetId: { type: String, trim: true, default: null },
    targetSlug: { type: String, trim: true, default: '' },
    url: { type: String, trim: true, maxlength: 360, default: '/shop' },
    openInNewTab: { type: Boolean, default: false },
    iconType: {
      type: String,
      enum: ['lucide', 'svg', 'image', 'none'],
      default: 'lucide',
    },
    iconName: { type: String, trim: true, maxlength: 60, default: 'LayoutGrid' },
    iconSvg: { type: String, default: '', maxlength: 9000 },
    iconImageUrl: { type: String, trim: true, default: '' },
    iconImagePublicId: { type: String, trim: true, default: '' },
    iconColor: { type: String, trim: true, default: '#16A34A' },
    iconBgColor: { type: String, trim: true, default: '#DCFCE7' },
    imageUrl: { type: String, trim: true, default: '' },
    imagePublicId: { type: String, trim: true, default: '' },
    badgeText: { type: String, trim: true, maxlength: 30, default: '' },
    badgeBgColor: { type: String, trim: true, default: '#16A34A' },
    badgeTextColor: { type: String, trim: true, default: '#FFFFFF' },
    description: { type: String, trim: true, maxlength: 260, default: '' },
    structuredBlocks: { type: Schema.Types.Mixed, default: [] },
    featuredGroupLimit: { type: Number, default: 4, min: 1, max: 12 },
    columnIndex: { type: Number, default: 0, min: 0, max: 3 },
    displayOrder: { type: Number, default: 0, index: true },
    isVisible: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

NavigationItemSchema.index({ menuId: 1, displayOrder: 1 });
NavigationItemSchema.index({ menuId: 1, parentId: 1, displayOrder: 1 });

export const NavigationItemModel =
  mongoose.models.NavigationItem ||
  mongoose.model<INavigationItem>('NavigationItem', NavigationItemSchema);

export interface IMegaMenuSlide extends Document {
  menuIds: mongoose.Types.ObjectId[];
  internalName: string;
  badgeText: string;
  mainHeading: string;
  highlightText: string;
  discountText: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  openInNewTab: boolean;
  desktopImageUrl: string;
  desktopImagePublicId: string;
  mobileImageUrl: string;
  mobileImagePublicId: string;
  altText: string;
  imagePosition: 'bottom_right' | 'center' | 'cover' | 'right';
  textColor: string;
  highlightColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  textAlign: 'left' | 'center' | 'right';
  overlayColor: string;
  overlayOpacity: number;
  borderRadiusPx: number;
  customStyleCss: string;
  priority: number;
  displayOrder: number;
  isActive: boolean;
  status: NavigationMenuStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  productIds: mongoose.Types.ObjectId[];
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const MegaMenuSlideSchema = new Schema<IMegaMenuSlide>(
  {
    menuIds: [{ type: Schema.Types.ObjectId, ref: 'NavigationMenu', index: true }],
    internalName: { type: String, required: true, trim: true, maxlength: 120 },
    badgeText: { type: String, trim: true, maxlength: 50, default: 'Special Offer' },
    mainHeading: { type: String, required: true, trim: true, maxlength: 120 },
    highlightText: { type: String, trim: true, maxlength: 100, default: '' },
    discountText: { type: String, trim: true, maxlength: 90, default: '' },
    description: { type: String, trim: true, maxlength: 260, default: '' },
    ctaLabel: { type: String, trim: true, maxlength: 40, default: 'Shop Now' },
    ctaUrl: { type: String, trim: true, maxlength: 360, default: '/shop' },
    openInNewTab: { type: Boolean, default: false },
    desktopImageUrl: { type: String, trim: true, default: '' },
    desktopImagePublicId: { type: String, trim: true, default: '' },
    mobileImageUrl: { type: String, trim: true, default: '' },
    mobileImagePublicId: { type: String, trim: true, default: '' },
    altText: { type: String, trim: true, maxlength: 180, default: 'Mega Menu Promotional Slide' },
    imagePosition: {
      type: String,
      enum: ['bottom_right', 'center', 'cover', 'right'],
      default: 'bottom_right',
    },
    textColor: { type: String, trim: true, default: '#0F172A' },
    highlightColor: { type: String, trim: true, default: '#16A34A' },
    buttonBgColor: { type: String, trim: true, default: '#16A34A' },
    buttonTextColor: { type: String, trim: true, default: '#FFFFFF' },
    badgeBgColor: { type: String, trim: true, default: '#16A34A' },
    badgeTextColor: { type: String, trim: true, default: '#FFFFFF' },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    overlayColor: { type: String, trim: true, default: '#DCFCE7' },
    overlayOpacity: { type: Number, min: 0, max: 95, default: 0 },
    borderRadiusPx: { type: Number, min: 0, max: 32, default: 16 },
    customStyleCss: { type: String, trim: true, maxlength: 1000, default: '' },
    priority: { type: Number, default: 10, index: true },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: MENU_STATUSES,
      default: 'published',
      index: true,
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

MegaMenuSlideSchema.index({ isActive: 1, status: 1, priority: -1, displayOrder: 1 });

export const MegaMenuSlideModel =
  mongoose.models.MegaMenuSlide ||
  mongoose.model<IMegaMenuSlide>('MegaMenuSlide', MegaMenuSlideSchema);

export { MENU_TEMPLATES };
