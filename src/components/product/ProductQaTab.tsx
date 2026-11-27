import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, MessageCircleQuestion, Send, ShieldCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks.ts';
import { openAuthModal } from '../../features/auth/authSlice.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { ProductQuestionItem } from '../../types/domain.ts';

interface ProductQaTabProps {
  productId: string;
  onCountUpdated?: (count: number) => void;
}

export function ProductQaTab({ productId, onCountUpdated }: ProductQaTabProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const [questions, setQuestions] = useState<ProductQuestionItem[]>([]);
  const [myPending, setMyPending] = useState<ProductQuestionItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        questions: ProductQuestionItem[];
        myPending: ProductQuestionItem[];
        total: number;
        totalPages: number;
      }>(`/api/qa/product/${productId}?page=${page}&limit=8`);
      setQuestions(res.questions || []);
      setMyPending(res.myPending || []);
      setTotalPages(Math.max(1, res.totalPages || 1));
      onCountUpdated?.(res.total || 0);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [productId, page, onCountUpdated]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      dispatch(openAuthModal({ mode: 'login' }));
      return;
    }
    if (newQuestion.trim().length < 6) {
      dispatch(pushToast({ variant: 'warning', message: 'Please write at least 6 characters.' }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/qa', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          question: newQuestion.trim(),
        }),
      });
      setNewQuestion('');
      dispatch(pushToast({ variant: 'success', message: res.message }));
      void loadQuestions();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to submit question.',
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Ask Question Form */}
      <div className="lg:col-span-4 space-y-3">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageCircleQuestion className="w-4 h-4 text-[#16A34A]" />
            <span>Ask a Question</span>
          </div>
          <p className="text-xs text-slate-500">
            Have a question about specifications, compatibility, or delivery? Our product team will answer it.
          </p>
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <textarea
              rows={3}
              minLength={6}
              maxLength={600}
              required
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask anything about this product..."
              className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : user ? 'Submit Question' : 'Sign in to Ask'}</span>
            </button>
          </form>
        </div>

        {myPending.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
            <p className="text-xs font-bold text-amber-900">Your Pending Questions</p>
            <div className="space-y-2">
              {myPending.map((pq) => (
                <div key={pq._id} className="text-xs text-amber-950 bg-white/80 p-2.5 rounded-lg border border-amber-200/70">
                  <p className="font-semibold">Q: {pq.question}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    {pq.status === 'rejected' ? 'Not Approved' : 'Awaiting Answer'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Published Q&A List */}
      <div className="lg:col-span-8 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-1.5">
            <HelpCircle className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No answered questions yet</p>
            <p className="text-xs text-slate-500">
              Be the first to ask a question about this product using the form.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((item) => (
              <div
                key={item._id}
                className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0">
                      Q
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {item.askedByName}
                  </span>
                </div>

                {item.answer && (
                  <div className="flex items-start gap-2 pl-2 border-l-2 border-emerald-500 ml-2">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#15803D] text-[11px] font-bold shrink-0">
                      A
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm text-slate-700">{item.answer}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-[#16A34A]" />
                        <span>
                          {item.answeredByName || 'NOVARA Support'}
                          {item.answeredAt
                            ? ` · ${new Date(item.answeredAt).toLocaleDateString()}`
                            : ''}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
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
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
