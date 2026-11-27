import { useEffect, useState } from 'react';
import { BookOpen, FileText, HelpCircle, Menu, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.ts';
import { CloudinaryUploadField } from '../../components/ui/CloudinaryUploadField.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type { BlogPost, FaqItem, StaticPage } from '../../types/domain.ts';

export type AdminContentTab = 'pages' | 'faqs' | 'blog';

export function AdminContentPage({ initialTab = 'pages' }: { initialTab?: AdminContentTab }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminContentTab>(initialTab);

  const [pages, setPages] = useState<StaticPage[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: string; id: string; label: string } | null>(null);

  // Page modal
  const [pageOpen, setPageOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);
  const [pageForm, setPageForm] = useState({
    title: '',
    slug: '',
    content: '',
    pageType: 'custom' as StaticPage['pageType'],
    seoTitle: '',
    seoDescription: '',
    isPublished: true,
    showInFooter: true,
  });

  // FAQ modal
  const [faqOpen, setFaqOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'General',
    displayOrder: 0,
    isPublished: true,
  });

  // Blog modal
  const [blogOpen, setBlogOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'Guides',
    featuredImageUrl: '',
    featuredImagePublicId: '',
    authorName: 'NOVARA Editorial',
    status: 'published' as BlogPost['status'],
  });

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadAll = () => {
    Promise.all([
      apiRequest<{ pages: StaticPage[] }>('/api/cms/admin/pages').catch(() => ({ pages: [] })),
      apiRequest<{ faqs: FaqItem[] }>('/api/cms/admin/faqs').catch(() => ({ faqs: [] })),
      apiRequest<{ posts: BlogPost[] }>('/api/cms/admin/blog').catch(() => ({ posts: [] })),
    ]).then(([pRes, fRes, bRes]) => {
      setPages(pRes.pages || []);
      setFaqs(fRes.faqs || []);
      setPosts(bRes.posts || []);
    });
  };

  useEffect(() => {
    loadAll();
  }, []);

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingPage ? `/api/cms/admin/pages/${editingPage._id}` : '/api/cms/admin/pages';
      await apiRequest(url, { method: editingPage ? 'PATCH' : 'POST', body: JSON.stringify(pageForm) });
      setPageOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Static page saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingFaq ? `/api/cms/admin/faqs/${editingFaq._id}` : '/api/cms/admin/faqs';
      await apiRequest(url, { method: editingFaq ? 'PATCH' : 'POST', body: JSON.stringify(faqForm) });
      setFaqOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'FAQ saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const saveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingBlog ? `/api/cms/admin/blog/${editingBlog._id}` : '/api/cms/admin/blog';
      await apiRequest(url, { method: editingBlog ? 'PATCH' : 'POST', body: JSON.stringify(blogForm) });
      setBlogOpen(false);
      dispatch(pushToast({ variant: 'success', message: 'Blog article saved.' }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/cms/admin/${deleteTarget.kind}/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      dispatch(pushToast({ variant: 'info', message: `${deleteTarget.label} deleted.` }));
      loadAll();
    } catch (err) {
      dispatch(pushToast({ variant: 'error', message: err instanceof Error ? err.message : 'Delete failed.' }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['pages', 'Static Pages', FileText],
              ['faqs', 'FAQs Manager', HelpCircle],
              ['blog', 'Blog Posts', BookOpen],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold ${
                tab === id
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/admin/cms/navigation')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-emerald-300"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Navigation Menu</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/cms/footer')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:border-emerald-300"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Footer Management</span>
          </button>
        </div>

        {tab === 'pages' && (
          <button
            type="button"
            onClick={() => {
              setEditingPage(null);
              setPageForm({
                title: '',
                slug: '',
                content: '',
                pageType: 'custom',
                seoTitle: '',
                seoDescription: '',
                isPublished: true,
                showInFooter: true,
              });
              setPageOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> New Static Page
          </button>
        )}
        {tab === 'faqs' && (
          <button
            type="button"
            onClick={() => {
              setEditingFaq(null);
              setFaqForm({
                question: '',
                answer: '',
                category: 'General',
                displayOrder: faqs.length,
                isPublished: true,
              });
              setFaqOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Add FAQ
          </button>
        )}
        {tab === 'blog' && (
          <button
            type="button"
            onClick={() => {
              setEditingBlog(null);
              setBlogForm({
                title: '',
                slug: '',
                excerpt: '',
                content: '',
                category: 'Guides',
                featuredImageUrl: '',
                featuredImagePublicId: '',
                authorName: 'NOVARA Editorial',
                status: 'published',
              });
              setBlogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Write Article
          </button>
        )}
      </div>

      {/* Static Pages */}
      {tab === 'pages' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Title &amp; Slug</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-center px-4 py-3 font-semibold">Footer Link</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No custom static pages created yet (/page/your-slug).
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p._id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{p.title}</p>
                      <p className="font-mono text-[11px] text-slate-400">/page/{p.slug}</p>
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-600">{p.pageType}</td>
                    <td className="px-4 py-3 text-center">{p.showInFooter ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPage(p);
                          setPageForm({
                            title: p.title,
                            slug: p.slug,
                            content: p.content,
                            pageType: p.pageType,
                            seoTitle: p.seoTitle || '',
                            seoDescription: p.seoDescription || '',
                            isPublished: p.isPublished,
                            showInFooter: p.showInFooter,
                          });
                          setPageOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind: 'pages', id: p._id, label: p.title })}
                        className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* FAQs */}
      {tab === 'faqs' && (
        <div className="space-y-3">
          {faqs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
              No FAQs published yet. Entries added here appear on the storefront /faq page.
            </div>
          ) : (
            faqs.map((f) => (
              <div key={f._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {f.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{f.question}</h3>
                  <p className="text-xs text-slate-600 mt-1">{f.answer}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFaq(f);
                      setFaqForm({
                        question: f.question,
                        answer: f.answer,
                        category: f.category,
                        displayOrder: f.displayOrder,
                        isPublished: f.isPublished,
                      });
                      setFaqOpen(true);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                    aria-label="Edit FAQ"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ kind: 'faqs', id: f._id, label: f.question })}
                    className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                    aria-label="Delete FAQ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Blog */}
      {tab === 'blog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
              No blog posts written yet. Publish buying guides and announcements for /blog.
            </div>
          ) : (
            posts.map((b) => (
              <div key={b._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-700">{b.category} · {b.status}</span>
                    <h3 className="text-sm font-extrabold text-slate-900">{b.title}</h3>
                    <p className="text-[11px] font-mono text-slate-400">/blog/{b.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlog(b);
                        setBlogForm({
                          title: b.title,
                          slug: b.slug,
                          excerpt: b.excerpt || '',
                          content: b.content,
                          category: b.category,
                          featuredImageUrl: b.featuredImageUrl || '',
                          featuredImagePublicId: b.featuredImagePublicId || '',
                          authorName: b.authorName,
                          status: b.status,
                        });
                        setBlogOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                      aria-label={`Edit ${b.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ kind: 'blog', id: b._id, label: b.title })}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-600"
                      aria-label={`Delete ${b.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{b.excerpt || b.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Static Page Modal */}
      <Modal open={pageOpen} onClose={() => setPageOpen(false)} title={editingPage ? 'Edit Page' : 'Create Page'} maxWidthClass="max-w-2xl">
        <form onSubmit={savePage} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Page Title"
              value={pageForm.title}
              onChange={(e) =>
                setPageForm((f) => ({
                  ...f,
                  title: e.target.value,
                  slug: editingPage ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }))
              }
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              required
              placeholder="slug"
              value={pageForm.slug}
              onChange={(e) => setPageForm((f) => ({ ...f, slug: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
            />
            <select
              aria-label="Page Type"
              value={pageForm.pageType}
              onChange={(e) =>
                setPageForm((f) => ({ ...f, pageType: e.target.value as StaticPage['pageType'] }))
              }
              className="h-10 px-2.5 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="custom">Custom Page</option>
              <option value="policy">Policy Page</option>
            </select>
          </div>
          <textarea
            rows={7}
            required
            placeholder="Page body content..."
            value={pageForm.content}
            onChange={(e) => setPageForm((f) => ({ ...f, content: e.target.value }))}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              maxLength={120}
              placeholder="SEO Title (optional)"
              value={pageForm.seoTitle}
              onChange={(e) => setPageForm((f) => ({ ...f, seoTitle: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              maxLength={240}
              placeholder="SEO Description (optional)"
              value={pageForm.seoDescription}
              onChange={(e) => setPageForm((f) => ({ ...f, seoDescription: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={pageForm.isPublished}
                onChange={(e) => setPageForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              <span>Published</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={pageForm.showInFooter}
                onChange={(e) => setPageForm((f) => ({ ...f, showInFooter: e.target.checked }))}
              />
              <span>Link in Footer</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPageOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save Page'}
            </button>
          </div>
        </form>
      </Modal>

      {/* FAQ Modal */}
      <Modal open={faqOpen} onClose={() => setFaqOpen(false)} title={editingFaq ? 'Edit FAQ' : 'Add FAQ'}>
        <form onSubmit={saveFaq} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Question"
            value={faqForm.question}
            onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
          />
          <textarea
            rows={4}
            required
            placeholder="Answer"
            value={faqForm.answer}
            onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Category (Shipping, Orders...)"
              value={faqForm.category}
              onChange={(e) => setFaqForm((f) => ({ ...f, category: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="number"
              min={0}
              placeholder="Order"
              value={faqForm.displayOrder}
              onChange={(e) => setFaqForm((f) => ({ ...f, displayOrder: Number(e.target.value) || 0 }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFaqOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Save FAQ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Blog Modal */}
      <Modal open={blogOpen} onClose={() => setBlogOpen(false)} title={editingBlog ? 'Edit Article' : 'New Blog Post'} maxWidthClass="max-w-2xl">
        <form onSubmit={saveBlog} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Article Title"
              value={blogForm.title}
              onChange={(e) =>
                setBlogForm((f) => ({
                  ...f,
                  title: e.target.value,
                  slug: editingBlog ? f.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }))
              }
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              required
              placeholder="slug"
              value={blogForm.slug}
              onChange={(e) => setBlogForm((f) => ({ ...f, slug: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Category"
              value={blogForm.category}
              onChange={(e) => setBlogForm((f) => ({ ...f, category: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <input
              type="text"
              placeholder="Author"
              value={blogForm.authorName}
              onChange={(e) => setBlogForm((f) => ({ ...f, authorName: e.target.value }))}
              className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
            <select
              value={blogForm.status}
              onChange={(e) => setBlogForm((f) => ({ ...f, status: e.target.value as BlogPost['status'] }))}
              className="h-10 px-2 rounded-lg border border-slate-200 text-xs bg-white"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Short excerpt..."
            value={blogForm.excerpt}
            onChange={(e) => setBlogForm((f) => ({ ...f, excerpt: e.target.value }))}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
          />
          <textarea
            rows={6}
            required
            placeholder="Article content..."
            value={blogForm.content}
            onChange={(e) => setBlogForm((f) => ({ ...f, content: e.target.value }))}
            className="w-full p-3 rounded-lg border border-slate-200 text-sm"
          />
          <CloudinaryUploadField
            folder="cms"
            label="Featured Cover Image"
            onUploaded={(asset) =>
              setBlogForm((f) => ({ ...f, featuredImageUrl: asset.url, featuredImagePublicId: asset.publicId }))
            }
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBlogOpen(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">
              {saving ? 'Saving...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message={`Remove "${deleteTarget?.label || ''}"?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
