import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Search, Tag, User } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { sanitizeHref } from '../../shared/security.ts';
import { SafeImage } from '../components/ui/SafeImage.tsx';
import { SeoHead } from '../components/ui/SeoHead.tsx';
import { apiRequest, ApiError } from '../lib/api.ts';
import type { BlogPost, StoreSettings } from '../types/domain.ts';

export function BlogPage({ storeSettings }: { storeSettings?: StoreSettings | null }) {
  const { slug } = useParams<{ slug?: string }>();
  const storeName = storeSettings?.storeName || 'NOVARA COMMERCE';

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dbOffline, setDbOffline] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setDbOffline(false);

    if (slug) {
      apiRequest<{ post: BlogPost }>(`/api/cms/public/blog/${encodeURIComponent(slug)}`)
        .then((res) => {
          setSelectedPost(res.post);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true);
          } else if (err instanceof ApiError && err.status === 503) {
            setDbOffline(true);
          } else {
            setNotFound(true);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setSelectedPost(null);
      apiRequest<{ posts: BlogPost[] }>('/api/cms/public/blog')
        .then((res) => {
          setPosts(res.posts || []);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 503) {
            setDbOffline(true);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [slug]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(posts.map((p) => p.category).filter(Boolean)));
    return ['All', ...unique];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (selectedCategory !== 'All' && post.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q)
      );
    });
  }, [posts, selectedCategory, search]);

  if (slug) {
    if (loading) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-4">
          <div className="h-8 w-40 rounded-lg bg-slate-200 animate-pulse" />
          <div className="h-12 w-3/4 rounded-lg bg-slate-200 animate-pulse" />
          <div className="h-72 w-full rounded-2xl bg-slate-200 animate-pulse" />
        </div>
      );
    }

    if (notFound || dbOffline || !selectedPost) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <SeoHead title={`Article Unavailable | ${storeName}`} noindex />
          <h1 className="text-2xl font-extrabold text-slate-900">
            {dbOffline ? 'Blog Temporarily Offline' : 'Article Not Found'}
          </h1>
          <p className="text-sm text-slate-600">
            {dbOffline
              ? 'Database connection is currently unavailable. Please try again later.'
              : 'The requested article does not exist or has not been published yet.'}
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Articles</span>
          </Link>
        </div>
      );
    }

    const safeImg = sanitizeHref(selectedPost.featuredImageUrl);
    const displayDate = selectedPost.publishedAt || selectedPost.createdAt;

    return (
      <article className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
        <SeoHead
          title={`${selectedPost.seoTitle || selectedPost.title} | ${storeName}`}
          description={selectedPost.seoDescription || selectedPost.excerpt}
          ogImage={safeImg || undefined}
        />

        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Journal</span>
        </Link>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700">
              <Tag className="w-3.5 h-3.5" />
              <span>{selectedPost.category || 'Editorial'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span>{selectedPost.authorName || 'NOVARA Editorial'}</span>
            </span>
            {displayDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(displayDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {selectedPost.title}
          </h1>

          {selectedPost.excerpt && (
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              {selectedPost.excerpt}
            </p>
          )}
        </header>

        {safeImg && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-[460px]">
            <SafeImage
              src={safeImg}
              alt={selectedPost.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 space-y-5 text-slate-700 leading-relaxed text-[15px] sm:text-base whitespace-pre-line">
          {selectedPost.content}
        </div>
      </article>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14 space-y-8">
      <SeoHead
        title={`Journal & Shopping Guides | ${storeName}`}
        description={`Read buying guides, product care tips, and Bangladesh e-commerce stories from ${storeName}.`}
      />

      <div className="bg-gradient-to-r from-[#0B1A2B] to-[#0E2F23] rounded-2xl p-7 sm:p-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            NOVARA Journal
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Guides, Reviews & Stories
          </h1>
          <p className="text-sm text-slate-300">
            Practical buying guides, gadget comparisons, and lifestyle reads curated for shoppers across Bangladesh.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles..."
            aria-label="Search blog articles"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            {dbOffline ? 'Articles Unavailable Offline' : 'No Published Articles Yet'}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {dbOffline
              ? 'Connect MongoDB in the server configuration to view published blog posts.'
              : 'New shopping guides and stories published in the Content Manager will appear here automatically.'}
          </p>
          <Link
            to="/shop"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#16A34A] text-white text-sm font-semibold"
          >
            Explore Storefront
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => {
            const img = sanitizeHref(post.featuredImageUrl);
            const dateStr = post.publishedAt || post.createdAt;
            return (
              <Link
                key={post._id}
                to={`/blog/${post.slug}`}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
              >
                <div className="h-48 bg-slate-100 overflow-hidden">
                  {img ? (
                    <SafeImage
                      src={img}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-700 font-bold text-sm">
                      {post.category || 'NOVARA Journal'}
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-emerald-700">{post.category || 'Guide'}</span>
                      {dateStr && (
                        <span>{new Date(dateStr).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-slate-600 line-clamp-3">{post.excerpt}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>By {post.authorName || 'NOVARA Team'}</span>
                    <span className="text-emerald-700">Read Article →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
