import mongoose, { Schema, type Document } from 'mongoose';

export interface IProductQuestion extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  askedByName: string;
  question: string;
  answer?: string;
  answeredById?: mongoose.Types.ObjectId | null;
  answeredByName?: string;
  answeredAt?: Date | null;
  status: 'pending' | 'approved' | 'rejected';
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductQuestionSchema = new Schema<IProductQuestion>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    askedByName: { type: String, required: true, trim: true, maxlength: 100 },
    question: { type: String, required: true, trim: true, maxlength: 600 },
    answer: { type: String, trim: true, maxlength: 1500, default: '' },
    answeredById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    answeredByName: { type: String, trim: true, maxlength: 100, default: '' },
    answeredAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    isPublished: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

ProductQuestionSchema.index({ productId: 1, isPublished: 1, status: 1, createdAt: -1 });

export const ProductQuestionModel =
  mongoose.models.ProductQuestion ||
  mongoose.model<IProductQuestion>('ProductQuestion', ProductQuestionSchema);
