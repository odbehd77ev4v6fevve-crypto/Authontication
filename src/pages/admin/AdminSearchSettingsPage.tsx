import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  Edit3,
  Eye,
  GripVertical,
  Languages,
  Monitor,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_PLACEHOLDER_ANIMATION_CONFIG,
  DEFAULT_RELEVANCE_WEIGHTS,
  DEFAULT_SEARCH_ENGINE_CONFIG,
  DEFAULT_SUGGESTIONS_UI_CONFIG,
} from '../../../shared/searchHelpers.ts';
import { useAppDispatch } from '../../app/hooks.ts';
import { AnimatedSearchInput } from '../../components/search/AnimatedSearchInput.tsx';
import { pushToast } from '../../features/toast/toastSlice.ts';
import { apiRequest } from '../../lib/api.ts';
import type {
  DeviceScope,
  PublicSearchConfig,
  QueryLanguage,
  SearchAnalyticsReport,
  SearchEngineConfig,
  SearchPlaceholderAnimationConfig,
  SearchPlaceholderMessageItem,
  SearchSuggestionsUiConfig,
  SearchSynonymEntry,
} from '../../types/domain.ts';

type AdminSearchTab = 'placeholders' | 'animation' | 'engine' | 'synonyms' | 'analytics';

export function AdminSearchSettingsPage() {
  const dispatch = useAppDispatch();

  const [tab, setTab] = useState<AdminSearchTab>('placeholders');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [engine, setEngine] = useState<SearchEngineConfig>(DEFAULT_SEARCH_ENGINE_CONFIG);
  const [placeholderAnimation, setPlaceholderAnimation] = useState<SearchPlaceholderAnimationConfig>(
    DEFAULT_PLACEHOLDER_ANIMATION_CONFIG
  );
  const [suggestionsUi, setSuggestionsUi] = useState<SearchSuggestionsUiConfig>(
    DEFAULT_SUGGESTIONS_UI_CONFIG
  );
  const [placeholders, setPlaceholders] = useState<SearchPlaceholderMessageItem[]>([]);
  const [synonyms, setSynonyms] = useState<SearchSynonymEntry[]>([]);
  const [analytics, setAnalytics] = useState<SearchAnalyticsReport | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Live Preview Controls
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewQuery, setPreviewQuery] = useState('');
  const [previewSingleMessage, setPreviewSingleMessage] = useState<string | null>(null);

  // Placeholder form & inline edit state
  const [newPlText, setNewPlText] = useState('');
  const [newPlLang, setNewPlLang] = useState<QueryLanguage>('mixed');
  const [newPlScope, setNewPlScope] = useState<DeviceScope>('all');
  const [newPlNotes, setNewPlNotes] = useState('');
  const [creatingPl, setCreatingPl] = useState(false);
  const [editingPlId, setEditingPlId] = useState<string | null>(null);
  const [editPlDraft, setEditPlDraft] = useState<{
    text: string;
    language: QueryLanguage;
    deviceScope: DeviceScope;
    notes: string;
  }>({ text: '', language: 'mixed', deviceScope: 'all', notes: '' });
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Synonym form & filter state
  const [synFilter, setSynFilter] = useState('');
  const [synPrimary, setSynPrimary] = useState('');
  const [synAliasesText, setSynAliasesText] = useState('');
  const [synCategoryHint, setSynCategoryHint] = useState('');
  const [synPriority, setSynPriority] = useState(90);
  const [editingSynId, setEditingSynId] = useState<string | null>(null);
  const [savingSyn, setSavingSyn] = useState(false);

  const notifyStorefrontConfigChanged = () => {
    window.dispatchEvent(new Event('novara:search-config-updated'));
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, plRes, synRes] = await Promise.all([
        apiRequest<{
          settings: {
            engine: SearchEngineConfig;
            placeholderAnimation: SearchPlaceholderAnimationConfig;
            suggestionsUi: SearchSuggestionsUiConfig;
          };
        }>('/api/search/admin/settings'),
        apiRequest<{ placeholders: SearchPlaceholderMessageItem[] }>('/api/search/admin/placeholders'),
        apiRequest<{ synonyms: SearchSynonymEntry[] }>('/api/search/admin/synonyms'),
      ]);

      if (settingsRes.settings) {
        setEngine(settingsRes.settings.engine);
        setPlaceholderAnimation(settingsRes.settings.placeholderAnimation);
        setSuggestionsUi(settingsRes.settings.suggestionsUi);
      }
      setPlaceholders(plRes.placeholders || []);
      setSynonyms(synRes.synonyms || []);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to load search settings.',
        })
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await apiRequest<SearchAnalyticsReport>('/api/search/admin/analytics');
      setAnalytics(res);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Unable to load search analytics.',
        })
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'analytics' && !analytics) {
      void loadAnalytics();
    }
  }, [tab, analytics, loadAnalytics]);

  const livePreviewConfig = useMemo<PublicSearchConfig>(
    () => ({
      engine,
      placeholderAnimation,
      suggestionsUi,
      placeholders,
    }),
    [engine, placeholderAnimation, suggestionsUi, placeholders]
  );

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await apiRequest<{
        settings: {
          engine: SearchEngineConfig;
          placeholderAnimation: SearchPlaceholderAnimationConfig;
          suggestionsUi: SearchSuggestionsUiConfig;
        };
      }>('/api/search/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ engine, placeholderAnimation, suggestionsUi }),
      });
      setEngine(res.settings.engine);
      setPlaceholderAnimation(res.settings.placeholderAnimation);
      setSuggestionsUi(res.settings.suggestionsUi);
      notifyStorefrontConfigChanged();
      dispatch(pushToast({ variant: 'success', message: 'Search configuration saved.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save search settings.',
        })
      );
    } finally {
      setSavingConfig(false);
    }
  };

  // Placeholder CRUD & Reordering
  const handleCreatePlaceholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlText.trim()) return;
    setCreatingPl(true);
    try {
      const res = await apiRequest<{ placeholder: SearchPlaceholderMessageItem }>(
        '/api/search/admin/placeholders',
        {
          method: 'POST',
          body: JSON.stringify({
            text: newPlText.trim(),
            language: newPlLang,
            deviceScope: newPlScope,
            notes: newPlNotes.trim(),
            isEnabled: true,
          }),
        }
      );
      setPlaceholders((prev) => [...prev, res.placeholder]);
      setNewPlText('');
      setNewPlNotes('');
      notifyStorefrontConfigChanged();
      dispatch(pushToast({ variant: 'success', message: 'Placeholder message added.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to create placeholder.',
        })
      );
    } finally {
      setCreatingPl(false);
    }
  };

  const handleTogglePlaceholder = async (item: SearchPlaceholderMessageItem) => {
    if (!item._id) return;
    try {
      const res = await apiRequest<{ placeholder: SearchPlaceholderMessageItem }>(
        `/api/search/admin/placeholders/${item._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isEnabled: !item.isEnabled }),
        }
      );
      setPlaceholders((prev) =>
        prev.map((p) => (p._id === item._id ? res.placeholder : p))
      );
      notifyStorefrontConfigChanged();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to toggle placeholder.',
        })
      );
    }
  };

  const handleSavePlaceholderEdit = async (id: string) => {
    if (!editPlDraft.text.trim()) return;
    try {
      const res = await apiRequest<{ placeholder: SearchPlaceholderMessageItem }>(
        `/api/search/admin/placeholders/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(editPlDraft),
        }
      );
      setPlaceholders((prev) => prev.map((p) => (p._id === id ? res.placeholder : p)));
      setEditingPlId(null);
      notifyStorefrontConfigChanged();
      dispatch(pushToast({ variant: 'success', message: 'Placeholder updated.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to update placeholder.',
        })
      );
    }
  };

  const handleDeletePlaceholder = async (id: string) => {
    try {
      await apiRequest(`/api/search/admin/placeholders/${id}`, { method: 'DELETE' });
      setPlaceholders((prev) => prev.filter((p) => p._id !== id));
      notifyStorefrontConfigChanged();
      dispatch(pushToast({ variant: 'info', message: 'Placeholder deleted.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to delete placeholder.',
        })
      );
    }
  };

  const commitPlaceholderOrder = async (nextList: SearchPlaceholderMessageItem[]) => {
    const withOrder = nextList.map((item, idx) => ({ ...item, displayOrder: idx }));
    setPlaceholders(withOrder);
    const orderedIds = withOrder.map((p) => p._id).filter((id): id is string => Boolean(id));
    if (orderedIds.length === 0) return;
    try {
      await apiRequest('/api/search/admin/placeholders/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      });
      notifyStorefrontConfigChanged();
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save placeholder order.',
        })
      );
    }
  };

  const movePlaceholder = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= placeholders.length) return;
    const copy = [...placeholders];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    void commitPlaceholderOrder(copy);
  };

  // Synonym CRUD
  const handleSubmitSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryTerm = synPrimary.trim();
    const aliases = synAliasesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!primaryTerm || aliases.length === 0) {
      dispatch(
        pushToast({
          variant: 'warning',
          message: 'Provide a primary term and at least one comma-separated alias.',
        })
      );
      return;
    }

    setSavingSyn(true);
    try {
      if (editingSynId) {
        const res = await apiRequest<{ synonym: SearchSynonymEntry }>(
          `/api/search/admin/synonyms/${editingSynId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              primaryTerm,
              aliases,
              categoryHint: synCategoryHint.trim(),
              priority: synPriority,
            }),
          }
        );
        setSynonyms((prev) =>
          prev.map((s) => (s._id === editingSynId ? res.synonym : s))
        );
        dispatch(pushToast({ variant: 'success', message: 'Synonym group updated.' }));
      } else {
        const res = await apiRequest<{ synonym: SearchSynonymEntry }>(
          '/api/search/admin/synonyms',
          {
            method: 'POST',
            body: JSON.stringify({
              primaryTerm,
              aliases,
              categoryHint: synCategoryHint.trim(),
              priority: synPriority,
              isActive: true,
              languagePair: 'bn-en',
            }),
          }
        );
        setSynonyms((prev) => [res.synonym, ...prev]);
        dispatch(pushToast({ variant: 'success', message: 'Synonym group created.' }));
      }
      setEditingSynId(null);
      setSynPrimary('');
      setSynAliasesText('');
      setSynCategoryHint('');
      setSynPriority(90);
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to save synonym group.',
        })
      );
    } finally {
      setSavingSyn(false);
    }
  };

  const handleToggleSynonym = async (entry: SearchSynonymEntry) => {
    if (!entry._id) return;
    try {
      const res = await apiRequest<{ synonym: SearchSynonymEntry }>(
        `/api/search/admin/synonyms/${entry._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !entry.isActive }),
        }
      );
      setSynonyms((prev) =>
        prev.map((s) => (s._id === entry._id ? res.synonym : s))
      );
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to toggle synonym status.',
        })
      );
    }
  };

  const handleDeleteSynonym = async (id: string) => {
    try {
      await apiRequest(`/api/search/admin/synonyms/${id}`, { method: 'DELETE' });
      setSynonyms((prev) => prev.filter((s) => s._id !== id));
      dispatch(pushToast({ variant: 'info', message: 'Synonym group deleted.' }));
    } catch (err) {
      dispatch(
        pushToast({
          variant: 'error',
          message: err instanceof Error ? err.message : 'Failed to delete synonym group.',
        })
      );
    }
  };

  const filteredSynonyms = useMemo(() => {
    const q = synFilter.trim().toLowerCase();
    if (!q) return synonyms;
    return synonyms.filter(
      (s) =>
        s.primaryTerm.toLowerCase().includes(q) ||
        (s.categoryHint || '').toLowerCase().includes(q) ||
        (s.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  }, [synonyms, synFilter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#16A34A] text-[11px] font-bold mb-2">
            <Languages className="w-3.5 h-3.5" />
            <span>Bilingual Smart Search &amp; Animated Placeholder</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Search Settings &amp; Cross-Language Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control Bengali–English smart search relevance, synonym mappings, search analytics, and live animated storefront search placeholders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSaveSettings()}
            disabled={savingConfig}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{savingConfig ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'placeholders', label: 'Search Placeholder', icon: Sparkles },
            { id: 'animation', label: 'Animation Config', icon: Activity },
            { id: 'engine', label: 'Search Engine & Suggestions', icon: Sliders },
            { id: 'synonyms', label: 'Synonyms & Aliases', icon: Languages },
            { id: 'analytics', label: 'Search Analytics', icon: BarChart3 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                active
                  ? 'bg-[#16A34A] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Live Preview Panel (Placeholders & Animation Tabs) */}
      {(tab === 'placeholders' || tab === 'animation') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#16A34A]" />
                <span>Interactive Live Storefront Search Preview</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tests the real storefront component with your current placeholder list and timing settings. Type into the box to verify non-interference.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {previewSingleMessage && (
                <button
                  type="button"
                  onClick={() => setPreviewSingleMessage(null)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <span>Single Msg Mode</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    previewDevice === 'desktop'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                    previewDevice === 'mobile'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B1A2B] p-4 sm:p-6 flex justify-center">
            <div
              className={`w-full transition-all ${
                previewDevice === 'mobile' ? 'max-w-[340px]' : 'max-w-xl'
              }`}
            >
              <div className="flex items-center rounded-full border border-slate-200 bg-white overflow-hidden shadow-md">
                <AnimatedSearchInput
                  value={previewQuery}
                  onChange={setPreviewQuery}
                  onClear={() => setPreviewQuery('')}
                  device={previewDevice}
                  config={livePreviewConfig}
                  previewMessageText={previewSingleMessage}
                  ariaLabel="Live animated placeholder preview"
                  inputClassName={
                    previewDevice === 'mobile'
                      ? 'w-full h-9 pl-3.5 pr-7 bg-transparent text-xs text-slate-900 focus:outline-none'
                      : 'w-full h-10 pl-4 pr-8 bg-transparent text-sm text-slate-900 focus:outline-none'
                  }
                />
                <button
                  type="button"
                  aria-label="Preview search button"
                  className={`${
                    previewDevice === 'mobile' ? 'h-9 px-4' : 'h-10 px-5'
                  } rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0`}
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 mt-2 text-center">
                {placeholderAnimation.enabled
                  ? `Mode: ${placeholderAnimation.transitionBehavior.replace(/_/g, ' ')} · Typing ${placeholderAnimation.typingSpeedMs}ms · Erasing ${placeholderAnimation.erasingSpeedMs}ms`
                  : 'Animation disabled — showing static fallback placeholder'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: SEARCH PLACEHOLDERS */}
      {tab === 'placeholders' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Add Placeholder Form */}
          <form
            onSubmit={handleCreatePlaceholder}
            className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#16A34A]" />
              <span>Add Placeholder Message</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Placeholder Text (Bengali / English)
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={newPlText}
                onChange={(e) => setNewPlText(e.target.value)}
                placeholder="e.g. মোবাইল, ল্যাপটপ বা জুতা খুঁজুন..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Language</label>
                <select
                  value={newPlLang}
                  onChange={(e) => setNewPlLang(e.target.value as QueryLanguage)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="mixed">Mixed (BN + EN)</option>
                  <option value="bn">Bengali (বাংলা)</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Device Scope</label>
                <select
                  value={newPlScope}
                  onChange={(e) => setNewPlScope(e.target.value as DeviceScope)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="all">All Devices</option>
                  <option value="desktop">Desktop Only</option>
                  <option value="mobile">Mobile Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Internal Note (Optional)</label>
              <input
                type="text"
                maxLength={200}
                value={newPlNotes}
                onChange={(e) => setNewPlNotes(e.target.value)}
                placeholder="e.g. Eid Electronics Campaign"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={creatingPl || !newPlText.trim()}
              className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{creatingPl ? 'Adding...' : 'Add Placeholder'}</span>
            </button>
          </form>

          {/* Placeholder Sequence Table / Cards */}
          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Sequential Rotation Messages ({placeholders.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Drag rows or use arrow buttons to reorder playback sequence.
                </p>
              </div>
            </div>

            {placeholders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                No custom placeholders yet. Add your first Bengali or English search prompt on the left.
              </div>
            ) : (
              <div className="space-y-2.5">
                {placeholders.map((item, idx) => {
                  const isEditing = editingPlId === item._id;
                  return (
                    <div
                      key={item._id || idx}
                      draggable={!isEditing}
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex === null || dragIndex === idx) return;
                        const copy = [...placeholders];
                        const [moved] = copy.splice(dragIndex, 1);
                        copy.splice(idx, 0, moved);
                        setDragIndex(null);
                        void commitPlaceholderOrder(copy);
                      }}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        item.isEnabled
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200 bg-slate-50/70 opacity-75'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editPlDraft.text}
                            onChange={(e) =>
                              setEditPlDraft((d) => ({ ...d, text: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={editPlDraft.language}
                              onChange={(e) =>
                                setEditPlDraft((d) => ({
                                  ...d,
                                  language: e.target.value as QueryLanguage,
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                            >
                              <option value="mixed">Mixed</option>
                              <option value="bn">Bengali</option>
                              <option value="en">English</option>
                            </select>
                            <select
                              value={editPlDraft.deviceScope}
                              onChange={(e) =>
                                setEditPlDraft((d) => ({
                                  ...d,
                                  deviceScope: e.target.value as DeviceScope,
                                }))
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                            >
                              <option value="all">All Devices</option>
                              <option value="desktop">Desktop</option>
                              <option value="mobile">Mobile</option>
                            </select>
                            <input
                              type="text"
                              value={editPlDraft.notes}
                              onChange={(e) =>
                                setEditPlDraft((d) => ({ ...d, notes: e.target.value }))
                              }
                              placeholder="Note"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPlId(null)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => item._id && void handleSavePlaceholderEdit(item._id)}
                              className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className="mt-0.5 text-slate-400 cursor-grab shrink-0"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 break-words">
                                {item.text}
                              </p>
                              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  #{idx + 1}
                                </span>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                  {item.language === 'bn'
                                    ? 'বাংলা'
                                    : item.language === 'en'
                                    ? 'EN'
                                    : 'BN + EN'}
                                </span>
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {item.deviceScope}
                                </span>
                                {item.notes && (
                                  <span className="text-[11px] text-slate-400 truncate">
                                    · {item.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setPreviewSingleMessage(item.text)}
                              title="Preview this message"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#16A34A] hover:border-emerald-300"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => movePlaceholder(idx, -1)}
                              aria-label="Move placeholder up"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === placeholders.length - 1}
                              onClick={() => movePlaceholder(idx, 1)}
                              aria-label="Move placeholder down"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleTogglePlaceholder(item)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                item.isEnabled
                                  ? 'bg-emerald-50 text-[#16A34A]'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {item.isEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlId(item._id || null);
                                setEditPlDraft({
                                  text: item.text,
                                  language: item.language,
                                  deviceScope: item.deviceScope,
                                  notes: item.notes || '',
                                });
                              }}
                              aria-label="Edit placeholder"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => item._id && void handleDeletePlaceholder(item._id)}
                              aria-label="Delete placeholder"
                              className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANIMATION CONFIGURATION */}
      {tab === 'animation' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Placeholder Typing &amp; Erasing Behavior
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure timing, cursor blinking, device activation, and focus/blur responsiveness.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlaceholderAnimation(DEFAULT_PLACEHOLDER_ANIMATION_CONFIG)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Enable Animated Placeholder</p>
                <p className="text-[11px] text-slate-500">Master switch for dynamic rotation</p>
              </div>
              <input
                type="checkbox"
                checked={placeholderAnimation.enabled}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, enabled: e.target.checked }))
                }
                className="w-4 h-4 accent-[#16A34A]"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Desktop Header Bar</p>
                <p className="text-[11px] text-slate-500">Animate on desktop screens</p>
              </div>
              <input
                type="checkbox"
                checked={placeholderAnimation.desktopEnabled}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, desktopEnabled: e.target.checked }))
                }
                className="w-4 h-4 accent-[#16A34A]"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Mobile Search &amp; Drawer</p>
                <p className="text-[11px] text-slate-500">Animate on mobile viewports</p>
              </div>
              <input
                type="checkbox"
                checked={placeholderAnimation.mobileEnabled}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, mobileEnabled: e.target.checked }))
                }
                className="w-4 h-4 accent-[#16A34A]"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Transition Style
              </label>
              <select
                value={placeholderAnimation.transitionBehavior}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    transitionBehavior: e.target.value as SearchPlaceholderAnimationConfig['transitionBehavior'],
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs bg-white"
              >
                <option value="type_and_erase">Sequential Type &amp; Erase</option>
                <option value="fade_cycle">Smooth Fade Cycle</option>
                <option value="instant_cycle">Instant Cycle</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Typing Speed (ms / char)
              </label>
              <input
                type="number"
                min={15}
                max={300}
                value={placeholderAnimation.typingSpeedMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    typingSpeedMs: Number(e.target.value || 65),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Erasing Speed (ms / char)
              </label>
              <input
                type="number"
                min={10}
                max={250}
                value={placeholderAnimation.erasingSpeedMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    erasingSpeedMs: Number(e.target.value || 36),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pause After Typing (ms)
              </label>
              <input
                type="number"
                min={300}
                max={8000}
                value={placeholderAnimation.pauseAfterCompleteMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    pauseAfterCompleteMs: Number(e.target.value || 1800),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Delay Before Next (ms)
              </label>
              <input
                type="number"
                min={100}
                max={4000}
                value={placeholderAnimation.delayBeforeNextMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    delayBeforeNextMs: Number(e.target.value || 360),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Initial Start Delay (ms)
              </label>
              <input
                type="number"
                min={0}
                max={3000}
                value={placeholderAnimation.startDelayMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    startDelayMs: Number(e.target.value || 250),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cursor Character
              </label>
              <input
                type="text"
                maxLength={2}
                value={placeholderAnimation.cursorChar}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    cursorChar: e.target.value || '|',
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cursor Blink Speed (ms)
              </label>
              <input
                type="number"
                min={200}
                max={1500}
                value={placeholderAnimation.cursorBlinkSpeedMs}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({
                    ...p,
                    cursorBlinkSpeedMs: Number(e.target.value || 530),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={placeholderAnimation.loop}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, loop: e.target.checked }))
                }
                className="accent-[#16A34A]"
              />
              <span>Loop continuously</span>
            </label>

            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={placeholderAnimation.showCursor}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, showCursor: e.target.checked }))
                }
                className="accent-[#16A34A]"
              />
              <span>Show blinking cursor</span>
            </label>

            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={placeholderAnimation.pauseOnFocus}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, pauseOnFocus: e.target.checked }))
                }
                className="accent-[#16A34A]"
              />
              <span>Pause when input focused</span>
            </label>

            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={placeholderAnimation.resumeOnBlur}
                onChange={(e) =>
                  setPlaceholderAnimation((p) => ({ ...p, resumeOnBlur: e.target.checked }))
                }
                className="accent-[#16A34A]"
              />
              <span>Resume when blurred</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Static Fallback Placeholder (used when animation disabled or reduced-motion active)
            </label>
            <input
              type="text"
              maxLength={140}
              value={placeholderAnimation.fallbackStaticText}
              onChange={(e) =>
                setPlaceholderAnimation((p) => ({
                  ...p,
                  fallbackStaticText: e.target.value,
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingConfig ? 'Saving...' : 'Save Animation Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: SEARCH ENGINE & SUGGESTIONS */}
      {tab === 'engine' && (
        <form
          onSubmit={handleSaveSettings}
          className="space-y-6"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Cross-Language Engine &amp; Dropdown Behavior
                </h2>
                <p className="text-xs text-slate-500">
                  Tune Bengali–English matching, debouncing, dropdown sizing, and stock visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEngine(DEFAULT_SEARCH_ENGINE_CONFIG);
                  setSuggestionsUi(DEFAULT_SUGGESTIONS_UI_CONFIG);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(
                [
                  ['smartSearchEnabled', 'Smart Relevance Engine'],
                  ['crossLanguageEnabled', 'Bengali ↔ English Matching'],
                  ['synonymMatchingEnabled', 'Synonym & Alias Expansion'],
                  ['transliterationEnabled', 'Phonetic & Transliteration'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer"
                >
                  <span className="text-xs font-bold text-slate-800">{label}</span>
                  <input
                    type="checkbox"
                    checked={engine[key]}
                    onChange={(e) =>
                      setEngine((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#16A34A]"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Min Query Length
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={engine.minQueryLength}
                  onChange={(e) =>
                    setEngine((prev) => ({
                      ...prev,
                      minQueryLength: Number(e.target.value || 1),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Debounce (ms)
                </label>
                <input
                  type="number"
                  min={80}
                  max={1000}
                  value={engine.debounceMs}
                  onChange={(e) =>
                    setEngine((prev) => ({
                      ...prev,
                      debounceMs: Number(e.target.value || 220),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Max Suggestions
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={engine.maxSuggestions}
                  onChange={(e) =>
                    setEngine((prev) => ({
                      ...prev,
                      maxSuggestions: Number(e.target.value || 8),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Dropdown Max Height (px)
                </label>
                <input
                  type="number"
                  min={200}
                  max={720}
                  value={engine.dropdownMaxHeightPx}
                  onChange={(e) =>
                    setEngine((prev) => ({
                      ...prev,
                      dropdownMaxHeightPx: Number(e.target.value || 420),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Out-of-Stock Policy
                </label>
                <select
                  value={engine.outOfStockBehavior}
                  onChange={(e) =>
                    setEngine((prev) => ({
                      ...prev,
                      outOfStockBehavior: e.target.value as SearchEngineConfig['outOfStockBehavior'],
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  <option value="demote">Demote Below In-Stock</option>
                  <option value="show">Show Normally</option>
                  <option value="hide">Hide Out-of-Stock</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-extrabold text-slate-800 mb-3">
                Suggestion Dropdown Display Options
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ['showThumbnails', 'Product Thumbnails'],
                    ['showBrand', 'Brand Label'],
                    ['showCategory', 'Category Label'],
                    ['showPrice', 'BDT Price & Discount'],
                    ['showStockStatus', 'Stock Status Badge'],
                    ['highlightMatches', 'Keyword Highlighting'],
                    ['showMatchedFieldHint', 'Match Source Badge'],
                    ['showPopularWhenEmpty', 'Popular Searches'],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={suggestionsUi[key]}
                      onChange={(e) =>
                        setSuggestionsUi((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="accent-[#16A34A]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  9-Tier Relevance Scoring Weights
                </h3>
                <p className="text-xs text-slate-500">
                  Higher numbers grant stronger ranking priority when products match a customer query.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEngine((prev) => ({
                    ...prev,
                    relevanceWeights: { ...DEFAULT_RELEVANCE_WEIGHTS },
                  }))
                }
                className="text-xs font-bold text-[#16A34A] hover:underline"
              >
                Restore Recommended Weights
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {(
                [
                  ['exactTitle', '1. Exact Title'],
                  ['exactSku', '2. Exact SKU / Barcode'],
                  ['titleKeyword', '3. Title Keywords'],
                  ['brand', '4. Brand Match'],
                  ['category', '5. Category Match'],
                  ['tags', '6. Tags & Keywords'],
                  ['attribute', '7. Attributes & Variants'],
                  ['description', '8. Description'],
                  ['synonymTranslit', '9. Synonym / Translit'],
                ] as const
              ).map(([fieldKey, label]) => (
                <div key={fieldKey}>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3000}
                    value={engine.relevanceWeights[fieldKey]}
                    onChange={(e) =>
                      setEngine((prev) => ({
                        ...prev,
                        relevanceWeights: {
                          ...prev.relevanceWeights,
                          [fieldKey]: Number(e.target.value || DEFAULT_RELEVANCE_WEIGHTS[fieldKey]),
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono tabular-nums"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{savingConfig ? 'Saving...' : 'Save Engine & Weights'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: SYNONYMS & ALIASES */}
      {tab === 'synonyms' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmitSynonym}
            className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">
                {editingSynId ? 'Edit Synonym Group' : 'Create Cross-Language Synonym'}
              </h2>
              {editingSynId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSynId(null);
                    setSynPrimary('');
                    setSynAliasesText('');
                    setSynCategoryHint('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Primary Term
              </label>
              <input
                type="text"
                required
                value={synPrimary}
                onChange={(e) => setSynPrimary(e.target.value)}
                placeholder="e.g. mobile or মোবাইল"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Equivalent Aliases (comma-separated BN &amp; EN)
              </label>
              <textarea
                rows={4}
                required
                value={synAliasesText}
                onChange={(e) => setSynAliasesText(e.target.value)}
                placeholder="মোবাইল, ফোন, স্মার্টফোন, smartphone, phone, handset"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Category Hint
                </label>
                <input
                  type="text"
                  value={synCategoryHint}
                  onChange={(e) => setSynCategoryHint(e.target.value)}
                  placeholder="Smartphones"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Priority
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={synPriority}
                  onChange={(e) => setSynPriority(Number(e.target.value || 80))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSyn}
              className="w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold"
            >
              {savingSyn
                ? 'Saving...'
                : editingSynId
                ? 'Update Synonym Group'
                : 'Add Synonym Group'}
            </button>
          </form>

          <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Bilingual Synonym Dictionary ({filteredSynonyms.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Bidirectional Bengali &amp; English mappings persisted in MongoDB.
                </p>
              </div>
              <input
                type="search"
                value={synFilter}
                onChange={(e) => setSynFilter(e.target.value)}
                placeholder="Filter synonyms..."
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-56"
              />
            </div>

            <div className="space-y-2.5 max-h-[540px] overflow-y-auto mega-menu-scroll pr-1">
              {filteredSynonyms.map((syn) => (
                <div
                  key={syn._id || syn.primaryTerm}
                  className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    syn.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'
                  }`}
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900">
                        {syn.primaryTerm}
                      </span>
                      {syn.categoryHint && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {syn.categoryHint}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        P{syn.priority ?? 80}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(syn.aliases || []).map((alias) => (
                        <span
                          key={alias}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 font-medium"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleSynonym(syn)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        syn.isActive
                          ? 'bg-emerald-50 text-[#16A34A]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {syn.isActive ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSynId(syn._id || null);
                        setSynPrimary(syn.primaryTerm);
                        setSynAliasesText((syn.aliases || []).join(', '));
                        setSynCategoryHint(syn.categoryHint || '');
                        setSynPriority(syn.priority ?? 80);
                      }}
                      aria-label="Edit synonym"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => syn._id && void handleDeleteSynonym(syn._id)}
                      aria-label="Delete synonym"
                      className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SEARCH ANALYTICS */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Customer Search Insights &amp; Zero-Result Diagnostics
              </h2>
              <p className="text-xs text-slate-500">
                Track popular queries, Bengali vs English usage, CTR, conversions, and zero-result gaps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalytics()}
              disabled={analyticsLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
              <span>Reload Analytics</span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Total Searches</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                {analytics?.summary.totalSearches ?? 0}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Click-Through Rate</p>
              <p className="text-2xl font-extrabold text-[#16A34A] mt-1 tabular-nums">
                {analytics?.summary.ctrPercent ?? 0}%
              </p>
              <p className="text-[11px] text-slate-400 tabular-nums">
                {analytics?.summary.totalClicks ?? 0} clicks
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Search Conversions</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                {analytics?.summary.totalConversions ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 tabular-nums">
                {analytics?.summary.conversionPercent ?? 0}% of clicks
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Zero-Result Hits</p>
              <p className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">
                {analytics?.summary.totalZeroResults ?? 0}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Language Split</p>
              <div className="flex items-center gap-2 mt-2 text-xs font-bold tabular-nums">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  BN {analytics?.languageBreakdown.bn ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  EN {analytics?.languageBreakdown.en ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  Mix {analytics?.languageBreakdown.mixed ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Popular Searches */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                Top Search Queries
              </h3>
              {!analytics || analytics.topQueries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No search queries recorded yet. Run searches on the storefront to populate analytics.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                        <th className="py-2 pr-3">Query</th>
                        <th className="py-2 px-2">Lang</th>
                        <th className="py-2 px-2 text-right">Searches</th>
                        <th className="py-2 px-2 text-right">Clicks</th>
                        <th className="py-2 pl-2 text-right">Results</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.topQueries.map((row) => (
                        <tr key={row._id}>
                          <td className="py-2.5 pr-3 font-semibold text-slate-900">{row.query}</td>
                          <td className="py-2.5 px-2 uppercase text-[10px] font-bold text-slate-500">
                            {row.language}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                            {row.searchCount}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#16A34A]">
                            {row.clickCount}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono tabular-nums">
                            {row.resultCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Zero-Result Queries */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Zero-Result Queries (Synonym Opportunities)</span>
              </h3>
              {!analytics || analytics.zeroResultQueries.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No zero-result searches recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.zeroResultQueries.map((row) => (
                    <div
                      key={row._id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/40"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{row.query}</p>
                        <p className="text-[11px] text-slate-500 tabular-nums">
                          {row.searchCount} searches · {row.zeroResultCount} zero-result hits · {row.language.toUpperCase()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSynPrimary(row.query);
                          setSynAliasesText(row.query);
                          setEditingSynId(null);
                          setTab('synonyms');
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#16A34A] text-[11px] font-bold text-[#16A34A]"
                      >
                        + Map Synonym
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
