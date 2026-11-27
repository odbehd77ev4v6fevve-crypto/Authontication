import mongoose, { Schema, type Document } from 'mongoose';

export interface ICloudinaryAsset {
  publicId: string;
  url: string;
  width?: number;
  height?: number;
  format?: string;
  alt?: string;
}

const CloudinaryAssetSchema = new Schema<ICloudinaryAsset>(
  {
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
    alt: { type: String },
  },
  { _id: false }
);

export interface ICategory extends Document {
  name: string;
  nameBn?: string;
  slug: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId | null;
  image?: ICloudinaryAsset;
  displayOrder: number;
  isActive: boolean;
  attributeTemplate: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: string[];
  }>;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameBn: { type: String, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    image: { type: CloudinaryAssetSchema },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    attributeTemplate: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'select'], default: 'text' },
        options: [{ type: String }],
      },
    ],
    seoTitle: { type: String, maxlength: 120 },
    seoDescription: { type: String, maxlength: 240 },
  },
  { timestamps: true }
);

CategorySchema.index({ isActive: 1, name: 1 });

export const CategoryModel =
  mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export interface IBrand extends Document {
  name: string;
  slug: string;
  description?: string;
  logo?: ICloudinaryAsset;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 400 },
    logo: { type: CloudinaryAssetSchema },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

BrandSchema.index({ isActive: 1, name: 1 });

export const BrandModel = mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);

export interface IProductVariant {
  _id: mongoose.Types.ObjectId;
  sku: string;
  title: string;
  options: Record<string, string>;
  price?: number | null;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold: number;
  image?: ICloudinaryAsset;
  isActive: boolean;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    options: { type: Map, of: String, default: {} },
    price: { type: Number, min: 0, default: null },
    stockOnHand: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    image: { type: CloudinaryAssetSchema },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

export interface IProduct extends Document {
  name: string;
  nameBn?: string;
  slug: string;
  sku: string;
  barcode?: string;
  brandId?: mongoose.Types.ObjectId | null;
  categoryId: mongoose.Types.ObjectId;
  subcategoryId?: mongoose.Types.ObjectId | null;
  categoryDomain: 'electronics' | 'beauty' | 'books' | 'home_lifestyle' | 'fashion' | 'general';
  shortDescription?: string;
  description: string;
  features: string[];
  attributes: Record<string, string>;
  specificationGroups: Array<{
    groupTitle: string;
    items: Array<{ label: string; value: string }>;
  }>;
  bilingualKeywords: string[];
  basePrice: number;
  purchasePrice?: number | null;
  costPrice?: number | null;
  salePrice?: number | null;
  flashSalePrice?: number | null;
  flashSaleStart?: Date | null;
  flashSaleEnd?: Date | null;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold: number;
  allowBackorders: boolean;
  maxOrderQuantity: number;
  variants: IProductVariant[];
  images: ICloudinaryAsset[];
  videoUrl?: string;
  videoThumbnail?: ICloudinaryAsset;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  warrantyInfo?: string;
  returnPolicyInfo?: string;
  shippingInfo?: string;
  deliveryNotes?: string;
  codEligible: boolean;
  relatedProductIds: mongoose.Types.ObjectId[];
  ratingAverage: number;
  ratingCount: number;
  salesCount: number;
  seoTitle?: string;
  seoDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  ogImage?: ICloudinaryAsset;
  backInStockSubscribers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameBn: { type: String, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    barcode: { type: String, trim: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    categoryDomain: {
      type: String,
      enum: ['electronics', 'beauty', 'books', 'home_lifestyle', 'fashion', 'general'],
      default: 'general',
    },
    shortDescription: { type: String, trim: true, maxlength: 320 },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    features: { type: [String], default: [] },
    attributes: { type: Map, of: String, default: {} },
    specificationGroups: [
      {
        _id: false,
        groupTitle: { type: String, required: true, trim: true, maxlength: 80 },
        items: [
          {
            _id: false,
            label: { type: String, required: true, trim: true, maxlength: 80 },
            value: { type: String, required: true, trim: true, maxlength: 300 },
          },
        ],
      },
    ],
    bilingualKeywords: { type: [String], default: [], index: true },
    basePrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, min: 0, default: null },
    costPrice: { type: Number, min: 0, default: null },
    salePrice: { type: Number, min: 0, default: null },
    flashSalePrice: { type: Number, min: 0, default: null },
    flashSaleStart: { type: Date, default: null },
    flashSaleEnd: { type: Date, default: null },
    stockOnHand: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    allowBackorders: { type: Boolean, default: false },
    maxOrderQuantity: { type: Number, min: 1, max: 50, default: 10 },
    variants: { type: [ProductVariantSchema], default: [] },
    images: { type: [CloudinaryAssetSchema], default: [] },
    videoUrl: { type: String, trim: true, maxlength: 500 },
    videoThumbnail: { type: CloudinaryAssetSchema },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    warrantyInfo: { type: String, trim: true, maxlength: 500 },
    returnPolicyInfo: { type: String, trim: true, maxlength: 500 },
    shippingInfo: { type: String, trim: true, maxlength: 1000 },
    deliveryNotes: { type: String, trim: true, maxlength: 500 },
    codEligible: { type: Boolean, default: true },
    relatedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    salesCount: { type: Number, default: 0, min: 0, index: true },
    seoTitle: { type: String, maxlength: 140 },
    seoDescription: { type: String, maxlength: 260 },
    metaKeywords: { type: [String], default: [] },
    canonicalUrl: { type: String, trim: true, maxlength: 300 },
    ogImage: { type: CloudinaryAssetSchema },
    backInStockSubscribers: { type: [String], default: [] },
  },
  { timestamps: true }
);

ProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
ProductSchema.index({ status: 1, categoryId: 1, basePrice: 1 });
ProductSchema.index({ status: 1, brandId: 1 });
ProductSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
ProductSchema.index({ status: 1, salesCount: -1 });
ProductSchema.index({ status: 1, sku: 1 });
ProductSchema.index({ status: 1, name: 1 });
ProductSchema.index({ status: 1, nameBn: 1 });
ProductSchema.index({ name: 'text', nameBn: 'text', description: 'text', bilingualKeywords: 'text', sku: 'text' });

export const ProductModel =
  mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export interface ICollection extends Document {
  title: string;
  slug: string;
  description?: string;
  image?: ICloudinaryAsset;
  productIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 400 },
    image: { type: CloudinaryAssetSchema },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CollectionModel =
  mongoose.models.Collection || mongoose.model<ICollection>('Collection', CollectionSchema);

export interface ISearchAnalytics extends Document {
  query: string;
  normalizedQuery: string;
  language: 'bn' | 'en' | 'mixed';
  resultCount: number;
  lastSearchedAt: Date;
  searchCount: number;
  zeroResultCount: number;
  clickCount: number;
  conversionCount: number;
  lastClickedProductId?: mongoose.Types.ObjectId | null;
}

const SearchAnalyticsSchema = new Schema<ISearchAnalytics>(
  {
    query: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedQuery: { type: String, required: true, unique: true, lowercase: true, index: true },
    language: { type: String, enum: ['bn', 'en', 'mixed'], default: 'en', index: true },
    resultCount: { type: Number, default: 0 },
    lastSearchedAt: { type: Date, default: Date.now },
    searchCount: { type: Number, default: 1, index: true },
    zeroResultCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    conversionCount: { type: Number, default: 0 },
    lastClickedProductId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { timestamps: true }
);

SearchAnalyticsSchema.index({ searchCount: -1 });
SearchAnalyticsSchema.index({ resultCount: 1, searchCount: -1 });
SearchAnalyticsSchema.index({ language: 1, searchCount: -1 });

export const SearchAnalyticsModel =
  mongoose.models.SearchAnalytics ||
  mongoose.model<ISearchAnalytics>('SearchAnalytics', SearchAnalyticsSchema);

export interface IAttributeDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'color';
  options: string[];
  isFilterable: boolean;
  isRequired: boolean;
}

export interface IAttributeGroup extends Document {
  name: string;
  slug: string;
  description?: string;
  attributes: IAttributeDefinition[];
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttributeGroupSchema = new Schema<IAttributeGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 300 },
    attributes: [
      {
        _id: false,
        key: { type: String, required: true, trim: true, maxlength: 60 },
        label: { type: String, required: true, trim: true, maxlength: 80 },
        type: { type: String, enum: ['text', 'number', 'select', 'color'], default: 'text' },
        options: { type: [String], default: [] },
        isFilterable: { type: Boolean, default: true },
        isRequired: { type: Boolean, default: false },
      },
    ],
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const AttributeGroupModel =
  mongoose.models.AttributeGroup ||
  mongoose.model<IAttributeGroup>('AttributeGroup', AttributeGroupSchema);

