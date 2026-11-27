import { useEffect, useState } from 'react';
import { ImagePlus, ShieldCheck, Star, Trash2, Upload } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAuthModal } from '../../features/auth/authSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { MediaAsset, ReviewItem } from '../../types/domain.ts';
import { Modal } from '../ui/Modal.tsx';
import { SafeImage } from '../ui/SafeImage.tsx';

interface WriteReviewModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  editingReview?: ReviewItem | null;
  onSubmitted: () => void;
}

interface EligibilityResponse {
  authenticated: boolean;
  canReview: boolean;
  hasDeliveredOrder: boolean;
  alreadyReviewed: boolean;
  existingReview: ReviewItem | null;
}

export function WriteReviewModal({
  open,
  onClose,
  productId,
  productName,
  editingReview,
  onSubmitted,
}: WriteReviewModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<Array<{ publicId: string; url: string; alt?: string }>>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingReview) {
      setRating(editingReview.rating);
      setTitle(editingReview.title || '');
      setComment(editingReview.comment);
      setImages(editingReview.images || []);
      setEligibility({
        authenticated: true,
        canReview: true,
        hasDeliveredOrder: true,
        alreadyReviewed: true,
        existingReview: editingReview,
      });
      return;
    }

    setRating(5);
    setTitle('');
    setComment('');
    setImages([]);

    if (!user) {
      setEligibility({
        authenticated: false,
        canReview: false,
        hasDeliveredOrder: false,
        alreadyReviewed: false,
        existingReview: null,
      });
      return;
    }

    setCheckingEligibility(true);
    apiRequest<EligibilityResponse>(`/api/reviews/product/${productId}/eligibility`)
      .then((res) => setEligibility(res))
      .catch(() => {
        setEligibility({
          authenticated: Boolean(user),
          canReview: false,
          hasDeliveredOrder: false,
          alreadyReviewed: false,
          existingReview: null,
        });
      })
      .finally(() => setCheckingEligibility(false));
  }, [open, productId, user, editingReview]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (images.length >= 4) {
      dispatch(pushToast({ variant: 'warning', message: 'You can attach up to 4 photos.' }));
      return;
    }

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('alt', `${productName} customer photo`);

      const json = await apiRequest<{ asset?: MediaAsset }>('/api/reviews/upload-image', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      if (!json.asset) {
        throw new Error('Photo upload failed.');
      }
      setImages((prev) => [
        ...prev,
        { publicId: json.asset!.publicId, url: json.asset!.url, alt: json.asset!.alt },
      ]);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to upload photo.',
        })
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      dispatch(openAuthModal({ mode: 'login' }));
      return;
    }
    setSubmitting(true);
    try {
      if (editingReview) {
        const res = await apiRequest<{ message: string }>(`/api/reviews/${editingReview._id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            rating,
            title: title.trim() || undefined,
            comment: comment.trim(),
            images,
          }),
        });
        dispatch(pushToast({ variant: 'success', message: res.message }));
      } else {
        const res = await apiRequest<{ message: string }>('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            productId,
            rating,
            title: title.trim() || undefined,
            comment: comment.trim(),
            images,
          }),
        });
        dispatch(pushToast({ variant: 'success', message: res.message }));
      }
      onSubmitted();
      onClose();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to submit review.',
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingReview ? 'Edit Your Review' : 'Write a Customer Review'}
      description={productName}
      maxWidthClass="max-w-lg"
    >
      {!user ? (
        <div className="py-4 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 text-[#16A34A] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">Sign in to review this product</p>
            <p className="text-xs text-slate-500">
              Reviews on NOVARA COMMERCE are verified against delivered customer orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              dispatch(openAuthModal({ mode: 'login' }));
            }}
            className="px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold"
          >
            Sign In / Register
          </button>
        </div>
      ) : checkingEligibility ? (
        <div className="py-10 text-center text-xs text-slate-500">
          Checking verified purchase eligibility...
        </div>
      ) : eligibility && !eligibility.canReview && !editingReview ? (
        <div className="py-4 space-y-3 text-center">
          <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-bold text-slate-900">
            {eligibility.alreadyReviewed
              ? 'You have already reviewed this product'
              : 'Verified Purchase Required'}
          </p>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            {eligibility.alreadyReviewed
              ? 'You can edit or remove your existing review directly from your review card or Account Dashboard.'
              : 'To maintain authentic ratings, only customers with a delivered order containing this product can submit a review.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Your Rating</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`Rate ${star} stars`}
                  onClick={() => setRating(star)}
                  className="p-1 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-bold text-slate-700 tabular-nums">
                {rating} / 5
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Headline <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your experience"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">Review Details</label>
            <textarea
              required
              minLength={10}
              maxLength={1500}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike? How was build quality and delivery?"
              className="w-full p-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImagePlus className="w-4 h-4 text-emerald-600" />
                <span>Add Photos (optional, max 4)</span>
              </label>
              {images.length < 4 && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={`${img.publicId}-${i}`} className="relative">
                    <SafeImage
                      src={img.url}
                      alt={img.alt || 'Review upload'}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove review photo"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto}
              className="px-5 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold disabled:opacity-60"
            >
              {submitting
                ? 'Submitting...'
                : editingReview
                ? 'Update Review'
                : 'Submit Review'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
