import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, MessageCircleQuestion, Send, Trash2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.ts';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { ProductQuestionItem } from '../../types/domain.ts';

export function AdminQaPage() {
  const dispatch = useAppDispatch();
  const [questions, setQuestions] = useState<ProductQuestionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadQuestions = useCallback(() => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    apiRequest<{ questions: ProductQuestionItem[] }>(`/api/qa/admin/list${qs}`)
      .then((res) => {
        const list = res.questions || [];
        setQuestions(list);
        setAnswerDrafts((prev) => {
          const next = { ...prev };
          for (const q of list) {
            if (next[q._id] === undefined) {
              next[q._id] = q.answer || '';
            }
          }
          return next;
        });
      })
      .catch((err) => {
        dispatch(
          pushToast({
            variant: 'error',
            message: err instanceof Error ? err.message : 'Unable to load product questions.',
          })
        );
      })
      .finally(() => setLoading(false));
  }, [statusFilter, dispatch]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleUpdate = async (
    id: string,
    payload: { answer?: string; status?: 'pending' | 'approved' | 'rejected'; isPublished?: boolean }
  ) => {
    setSavingId(id);
    try {
      await apiRequest(`/api/qa/admin/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      dispatch(pushToast({ variant: 'success', message: 'Product Q&A updated.' }));
      loadQuestions();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Update failed.',
        })
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setSavingId(id);
    try {
      await apiRequest(`/api/qa/admin/${id}`, { method: 'DELETE' });
      dispatch(pushToast({ variant: 'success', message: 'Question deleted.' }));
      loadQuestions();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Delete failed.',
        })
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            ['', 'All Questions'],
            ['pending', 'Pending Review'],
            ['unanswered', 'Unanswered'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                statusFilter === key
                  ? 'bg-[#16A34A] text-white border-[#16A34A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
          Loading customer questions...
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2">
          <MessageCircleQuestion className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No product questions in this queue</p>
          <p className="text-xs text-slate-500">
            Questions asked by customers on product pages will appear here for moderation and response.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((item) => {
            const productObj =
              item.productId && typeof item.productId === 'object' ? item.productId : null;
            const draft = answerDrafts[item._id] ?? item.answer ?? '';
            const busy = savingId === item._id;

            return (
              <div
                key={item._id}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {productObj ? (
                        <Link
                          to={`/product/${productObj.slug}`}
                          target="_blank"
                          className="text-xs font-bold text-emerald-700 hover:underline"
                        >
                          {productObj.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-bold text-slate-600">Product</span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.isPublished
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.isPublished ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1.5">
                      Q: {item.question}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Asked by {item.askedByName} on {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(item._id)}
                    className="p-2 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Official Store Answer
                  </label>
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) =>
                      setAnswerDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))
                    }
                    placeholder="Write an accurate answer for customers..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleUpdate(item._id, {
                          answer: draft,
                          status: 'approved',
                          isPublished: true,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Save Answer & Publish</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleUpdate(item._id, {
                          answer: draft,
                          status: 'approved',
                          isPublished: !item.isPublished,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      {item.isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleUpdate(item._id, { status: 'approved', answer: draft })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleUpdate(item._id, { status: 'rejected', isPublished: false })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
