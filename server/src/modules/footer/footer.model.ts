import mongoose, { Schema, type Document } from 'mongoose';
import {
  DEFAULT_FOOTER_CONFIG,
  cloneFooterConfig,
  type FooterConfigPayload,
} from '../../../../shared/footerHelpers.ts';

export interface IFooterConfig extends Document {
  key: 'primary';
  draft: FooterConfigPayload;
  published: FooterConfigPayload | null;
  status: 'draft' | 'published';
  version: number;
  publishedAt?: Date | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FooterConfigSchema = new Schema<IFooterConfig>(
  {
    key: { type: String, default: 'primary', unique: true, index: true },
    draft: {
      type: Schema.Types.Mixed,
      default: () => cloneFooterConfig(DEFAULT_FOOTER_CONFIG),
    },
    published: {
      type: Schema.Types.Mixed,
      default: () => cloneFooterConfig(DEFAULT_FOOTER_CONFIG),
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
      index: true,
    },
    version: { type: Number, default: 1, min: 1 },
    publishedAt: { type: Date, default: () => new Date() },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: 'System' },
  },
  { timestamps: true }
);

export const FooterConfigModel =
  mongoose.models.FooterConfig ||
  mongoose.model<IFooterConfig>('FooterConfig', FooterConfigSchema);
