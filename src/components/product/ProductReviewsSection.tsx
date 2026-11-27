import { useState } from 'react';
import {
  CheckCircle2,
  Flag,
  Pencil,
  Quote,
  Star,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { computeReviewDistributionPercentages } from '../../../shared/productDetailHelpers.ts';
import { getUserInitials } from '../../../shared/security.ts';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAuthModal } from '../../features/auth/authSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { ReviewItem } from '../../types/domain.ts';
import { SafeImage } from '../ui/SafeImage.tsx';
import { WriteReviewModal } from './WriteReviewModal.tsx';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  reviews: ReviewItem[];
  reviewTotal: number;
  averageRating: number;
  distribution: Record<number, number>;
  reviewSort: 'newest' | 'highest' | 'lowest';
  onSortChange: (sort: 'newest' | 'highest' | 'lowest') => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onReloadReviews: () => void;
}

export function ProductReviewsSection({
  productId,
  productName,
  reviews,
  reviewTotal,
  averageRating,
  distribution,
  reviewSort,
  onSortChange,
  page,
  totalPages,
  onPageChange,
  onReloadReviews,
}: ProductReviewsSectionProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);

  const percentages = computeReviewDistributionPercentages(distribution, reviewTotal);

  const handleDeleteOwnReview = async (reviewId: string) => {
    try {
      await apiRequest(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      dispatch(pushToast({ variant: 'success', message: 'Your review has been deleted.' }));
      onReloadReviews();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to delete review.',
        })
      );
    }
  };

  return (
    <section
      id="reviews"
      className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 space-y-6 shadow-2xs"
    >
      {/* Header matching visual reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center shrink-0 mt-0.5">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Customer Reviews</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real feedback from verified NOVARA COMMERCE customers
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {reviewTotal > 0 && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 pr-2 border-r border-slate-200">
              <span className="tabular-nums">Based on {reviewTotal} reviews</span>
              <div className="flex items-center text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < Math.round(averageRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="font-bold text-slate-900 tabular-nums">
                {averageRating.toFixed(1)}
              </span>
            </div>
          )}

          <select
            aria-label="Sort reviews"
            value={reviewSort}
            onChange={(e) => onSortChange(e.target.value as 'newest' | 'highest' | 'lowest')}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <option value="newest">Most Recent</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setEditingReview(null);
              setWriteModalOpen(true);
            }}
            className="h-9 px-4 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold transition-colors"
          >
            Write a Review
          </button>
        </div>
      </div>

      {/* Breakdown Summary + Review Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Rating Summary + Star Percentage Bars */}
        <div className="lg:col-span-4 rounded-xl bg-slate-50/90 border border-slate-200/80 p-5 flex items-center gap-5">
          <div className="text-center pr-4 border-r border-slate-200 shrink-0">
            <p className="text-4xl font-extrabold text-slate-900 tabular-nums leading-none">
              {reviewTotal > 0 ? averageRating.toFixed(1) : '—'}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-1">out of 5</p>
            <div className="flex items-center justify-center gap-0.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    reviewTotal > 0 && i < Math.round(averageRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 min-w-0">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const pct = percentages[star];
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-9 text-slate-600 font-medium whitespace-nowrap tabular-nums">
                    {star} Star
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-slate-500 font-medium tabular-nums">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Cards Grid */}
        <div className="lg:col-span-8">
          {reviews.length === 0 ? (
            <div className="h-full min-h-[170px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-6 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No approved reviews yet</p>
              <p className="text-xs text-slate-500 max-w-md">
                Customers who have received a delivered order for {productName} can share their verified review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
              {reviews.map((r) => {
                const reviewOwnerId =
                  typeof r.userId === 'object' && r.userId ? r.userId._id : r.userId;
                const isOwnReview = Boolean(user && reviewOwnerId && user.id === reviewOwnerId);
                const reviewerName = (r.userName || '').trim() || 'Verified Customer';
                const initials = getUserInitials(reviewerName);

                return (
                  <article
                    key={r._id}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {r.userAvatar ? (
                            <SafeImage
                              src={r.userAvatar}
                              alt={reviewerName}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-[#15803D] font-bold text-xs flex items-center justify-center shrink-0">
                              {initials || 'NC'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {reviewerName}
                            </p>
                            {r.verifiedPurchase && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#15803D] bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Verified Purchase</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <Quote className="w-4 h-4 text-slate-300 shrink-0" />
                      </div>

                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>

                      {r.title && (
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{r.title}</p>
                      )}
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">
                        {r.comment}
                      </p>

                      {r.images && r.images.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {r.images.slice(0, 3).map((img, idx) => (
                            <SafeImage
                              key={`${img.publicId}-${idx}`}
                              src={img.url}
                              alt={img.alt || `${r.userName} review photo`}
                              className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            apiRequest(`/api/reviews/${r._id}/helpful`, { method: 'POST' })
                              .then(() => onReloadReviews())
                              .catch(() => dispatch(openAuthModal({ mode: 'login' })))
                          }
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-[#15803D]"
                          title="Mark helpful"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span className="tabular-nums">{r.helpfulVoterIds?.length || 0}</span>
                        </button>

                        {isOwnReview ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReview(r);
                                setWriteModalOpen(true);
                              }}
                              aria-label="Edit your review"
                              className="text-slate-500 hover:text-emerald-700"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteOwnReview(r._id)}
                              aria-label="Delete your review"
                              className="text-slate-500 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              apiRequest(`/api/reviews/${r._id}/report`, {
                                method: 'POST',
                                body: JSON.stringify({ reason: 'Inappropriate or misleading content' }),
                              })
                                .then(() =>
                                  dispatch(
                                    pushToast({
                                      variant: 'info',
                                      message: 'Review reported to moderators.',
                                    })
                                  )
                                )
                                .catch(() => dispatch(openAuthModal({ mode: 'login' })))
                            }
                            aria-label="Report review"
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <WriteReviewModal
        open={writeModalOpen}
        onClose={() => setWriteModalOpen(false)}
        productId={productId}
        productName={productName}
        editingReview={editingReview}
        onSubmitted={onReloadReviews}
      />
    </section>
  );
}
