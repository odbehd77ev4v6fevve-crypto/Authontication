import mongoose, { Schema, type Document } from 'mongoose';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_RELEVANCE_WEIGHTS,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
  type DeviceScope,
  type QueryLanguage,
  type SearchEngineConfig,
  type SearchPlaceholderAnimationConfig,
  type SearchSuggestionsUiConfig,
} from '../../../../shared/searchHelpers.ts';

export interface ISearchConfig extends Document {
  key: 'primary';
  engine: SearchEngineConfig;
  placeholderAnimation: SearchPlaceholderAnimationConfig;
  suggestionsUi: SearchSuggestionsUiConfig;
  updatedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SearchConfigSchema = new Schema<ISearchConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'primary', enum: ['primary'] },
    engine: {
      smartSearchEnabled: { type: Boolean, default: DEFAULT_SEARCH_ENGINE_CONFIG.smartSearchEnabled },
      crossLanguageEnabled: { type: Boolean, default: DEFAULT_SEARCH_ENGINE_CONFIG.crossLanguageEnabled },
      synonymMatchingEnabled: { type: Boolean, default: DEFAULT_SEARCH_ENGINE_CONFIG.synonymMatchingEnabled },
      transliterationEnabled: { type: Boolean, default: DEFAULT_SEARCH_ENGINE_CONFIG.transliterationEnabled },
      minQueryLength: { type: Number, min: 1, max: 5, default: DEFAULT_SEARCH_ENGINE_CONFIG.minQueryLength },
      debounceMs: { type: Number, min: 80, max: 1000, default: DEFAULT_SEARCH_ENGINE_CONFIG.debounceMs },
      maxSuggestions: { type: Number, min: 1, max: 15, default: DEFAULT_SEARCH_ENGINE_CONFIG.maxSuggestions },
      dropdownMaxHeightPx: {
        type: Number,
        min: 200,
        max: 720,
        default: DEFAULT_SEARCH_ENGINE_CONFIG.dropdownMaxHeightPx,
      },
      outOfStockBehavior: {
        type: String,
        enum: ['show', 'demote', 'hide'],
        default: DEFAULT_SEARCH_ENGINE_CONFIG.outOfStockBehavior,
      },
      relevanceWeights: {
        exactTitle: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.exactTitle },
        exactSku: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.exactSku },
        titleKeyword: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.titleKeyword },
        brand: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.brand },
        category: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.category },
        tags: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.tags },
        attribute: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.attribute },
        description: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.description },
        synonymTranslit: { type: Number, default: DEFAULT_RELEVANCE_WEIGHTS.synonymTranslit },
      },
    },
    placeholderAnimation: {
      enabled: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.enabled },
      typingSpeedMs: { type: Number, min: 15, max: 300, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.typingSpeedMs },
      erasingSpeedMs: {
        type: Number,
        min: 10,
        max: 250,
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.erasingSpeedMs,
      },
      pauseAfterCompleteMs: {
        type: Number,
        min: 300,
        max: 8000,
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseAfterCompleteMs,
      },
      delayBeforeNextMs: {
        type: Number,
        min: 100,
        max: 4000,
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.delayBeforeNextMs,
      },
      startDelayMs: { type: Number, min: 0, max: 3000, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.startDelayMs },
      loop: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.loop },
      showCursor: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.showCursor },
      cursorChar: { type: String, maxlength: 2, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorChar },
      cursorBlinkSpeedMs: {
        type: Number,
        min: 200,
        max: 1500,
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.cursorBlinkSpeedMs,
      },
      transitionBehavior: {
        type: String,
        enum: ['type_and_erase', 'fade_cycle', 'instant_cycle'],
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.transitionBehavior,
      },
      pauseOnFocus: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.pauseOnFocus },
      resumeOnBlur: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.resumeOnBlur },
      desktopEnabled: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.desktopEnabled },
      mobileEnabled: { type: Boolean, default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.mobileEnabled },
      fallbackStaticText: {
        type: String,
        maxlength: 140,
        default: DEFAULT_PLACEHOLDER_ANIMATION_CONFIG.fallbackStaticText,
      },
    },
    suggestionsUi: {
      showThumbnails: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showThumbnails },
      showBrand: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showBrand },
      showCategory: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showCategory },
      showPrice: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showPrice },
      showStockStatus: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showStockStatus },
      showPopularWhenEmpty: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showPopularWhenEmpty },
      highlightMatches: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.highlightMatches },
      showMatchedFieldHint: { type: Boolean, default: DEFAULT_SUGGESTIONS_UI_CONFIG.showMatchedFieldHint },
    },
    updatedByName: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

export const SearchConfigModel =
  mongoose.models.SearchConfig || mongoose.model<ISearchConfig>('SearchConfig', SearchConfigSchema);

export interface ISearchPlaceholder extends Document {
  text: string;
  language: QueryLanguage;
  isEnabled: boolean;
  displayOrder: number;
  deviceScope: DeviceScope;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SearchPlaceholderSchema = new Schema<ISearchPlaceholder>(
  {
    text: { type: String, required: true, trim: true, maxlength: 140 },
    language: { type: String, enum: ['bn', 'en', 'mixed'], default: 'mixed' },
    isEnabled: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true },
    deviceScope: { type: String, enum: ['all', 'desktop', 'mobile'], default: 'all' },
    notes: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

SearchPlaceholderSchema.index({ isEnabled: 1, displayOrder: 1 });

export const SearchPlaceholderModel =
  mongoose.models.SearchPlaceholder ||
  mongoose.model<ISearchPlaceholder>('SearchPlaceholder', SearchPlaceholderSchema);

export interface ISearchSynonym extends Document {
  primaryTerm: string;
  normalizedPrimary: string;
  aliases: string[];
  languagePair: string;
  categoryHint?: string;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const SearchSynonymSchema = new Schema<ISearchSynonym>(
  {
    primaryTerm: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedPrimary: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    aliases: { type: [String], default: [] },
    languagePair: { type: String, trim: true, maxlength: 20, default: 'bn-en' },
    categoryHint: { type: String, trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 50, min: 0, max: 1000 },
  },
  { timestamps: true }
);

SearchSynonymSchema.index({ isActive: 1, priority: -1 });
SearchSynonymSchema.index({ aliases: 1 });

export const SearchSynonymModel =
  mongoose.models.SearchSynonym ||
  mongoose.model<ISearchSynonym>('SearchSynonym', SearchSynonymSchema);
