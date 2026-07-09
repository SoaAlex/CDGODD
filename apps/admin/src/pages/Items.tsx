import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API, apiGet, authHeaders, imageUrl } from '../lib/api';
import { ItemEditModal } from '../components/ItemEditModal';
import { CategoryPicker } from '../components/CategoryPicker';
import type { AdminItem, Category, ItemStatus } from '../types';

type Filter = 'all' | ItemStatus;
type VoteField = 'votes_left' | 'votes_right';
const TABS: Filter[] = ['all', 'pending', 'approved', 'rejected'];
const TAB_LABELS: Record<Filter, string> = {
  all: 'Tous',
  pending: 'En attente',
  approved: 'Approuvés',
  rejected: 'Rejetés',
};
const STATUS_STYLES: Record<ItemStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  rejected: 'bg-red-100 text-red-800',
};

// The API aggregates an item's category keys into one CSV column.
type RawItem = Omit<AdminItem, 'category_keys'> & {
  category_keys: string | null;
};
const parseItem = (r: RawItem): AdminItem => ({
  ...r,
  category_keys: r.category_keys ? r.category_keys.split(',') : [],
});

/**
 * Click-to-edit cell: renders the value as a button; a click swaps in an
 * input. Enter/blur commits (via onSave), Escape cancels. The input stays
 * open when onSave reports failure so the draft isn't lost.
 */
function InlineText({
  value,
  display,
  inputType = 'text',
  inputClass = 'w-40',
  onSave,
}: {
  value: string;
  /** Collapsed rendering; defaults to the raw value. */
  display?: ReactNode;
  inputType?: 'text' | 'number';
  inputClass?: string;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  async function commit() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const ok = await onSave(draft);
    setBusy(false);
    setEditing(!ok);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="-mx-1 cursor-text rounded px-1 py-0.5 text-left transition-colors hover:bg-blue-50"
        title="Cliquer pour modifier"
      >
        {display ?? value}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type={inputType}
      min={inputType === 'number' ? 0 : undefined}
      maxLength={80}
      value={draft}
      disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur(); // commit via onBlur
        } else if (e.key === 'Escape') {
          setDraft(value); // a late blur then commits a no-op
          setEditing(false);
        }
      }}
      className={`input-field !px-2 !py-1 text-sm ${inputClass}`}
    />
  );
}

export function Items() {
  const { token } = useAuth();
  const [status, setStatus] = useState<Filter>('all');
  const [items, setItems] = useState<AdminItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  // Item whose category cell is expanded into a picker.
  const [catEditing, setCatEditing] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<ItemStatus, number> | null>(null);

  const loadCounts = useCallback(async () => {
    try {
      const { counts } = await apiGet<{
        counts: Record<ItemStatus, number>;
      }>('/admin/items/counts', token);
      setCounts(counts);
    } catch {
      setCounts(null);
    }
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (status === 'all') {
        // API has no "all" filter — merge the three status queues.
        const lists = await Promise.all(
          (['pending', 'approved', 'rejected'] as ItemStatus[]).map((s) =>
            apiGet<{ items: RawItem[] }>(`/admin/items?status=${s}`, token),
          ),
        );
        const merged = lists
          .flatMap((l) => l.items.map(parseItem))
          .sort((a, b) => b.created_at - a.created_at);
        setItems(merged);
      } else {
        const data = await apiGet<{ items: RawItem[] }>(
          `/admin/items?status=${status}`,
          token,
        );
        setItems(data.items.map(parseItem));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    fetch(`${API}/categories?lang=fr`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, []);

  /**
   * PATCH one item and, on success, merge `local` into the row in place —
   * no full reload, so the table doesn't flash. Rows whose status no longer
   * matches the active tab are dropped, mirroring what a reload would show.
   */
  async function patchItem(
    id: number,
    body: Record<string, unknown>,
    local: Partial<AdminItem>,
  ): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`${API}/admin/items/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? `API ${res.status}`);
      setItems((list) =>
        list
          .map((x) => (x.id === id ? { ...x, ...local } : x))
          .filter((x) => status === 'all' || x.status === status),
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return false;
    }
  }

  function setItemStatus(id: number, next: ItemStatus) {
    void patchItem(id, { status: next }, { status: next }).then((ok) => {
      if (ok) void loadCounts();
    });
  }

  async function saveLabel(it: AdminItem, raw: string): Promise<boolean> {
    const label = raw.trim();
    if (!label) {
      setError('Label requis');
      return false;
    }
    return patchItem(it.id, { label }, { label });
  }

  async function saveVotes(
    it: AdminItem,
    field: VoteField,
    raw: string,
  ): Promise<boolean> {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      setError('Votes invalides (entier ≥ 0)');
      return false;
    }
    return patchItem(it.id, { [field]: n }, { [field]: n });
  }

  function bumpVotes(it: AdminItem, field: VoteField, delta: number) {
    const next = Math.max(0, it[field] + delta);
    if (next === it[field]) return;
    void patchItem(it.id, { [field]: next }, { [field]: next });
  }

  function toggleCategory(it: AdminItem, key: string) {
    const next = new Set(it.category_keys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const keys = [...next];
    void patchItem(it.id, { categoryKeys: keys }, { category_keys: keys });
  }

  async function deleteItem(item: AdminItem) {
    const name = item.label ?? `item #${item.id}`;
    if (
      !window.confirm(
        `Supprimer définitivement « ${name} » ?\nVotes, signalements et image seront aussi supprimés. Action irréversible.`,
      )
    ) {
      return;
    }
    await fetch(`${API}/admin/items/${item.id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    void load();
    void loadCounts();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modération</h1>
          <p className="mt-1 text-sm text-gray-500">
            Approuver ou rejeter les items du jeu
          </p>
        </div>
        <div className="text-sm text-gray-500">{items.length} items</div>
      </div>

      {/* Status tabs */}
      <div className="card">
        <div className="flex gap-2">
          {TABS.map((s) => {
            const count = counts
              ? s === 'all'
                ? counts.pending + counts.approved + counts.rejected
                : counts[s]
              : null;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  s === status
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {TAB_LABELS[s]}
                {count !== null && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      s === status
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="card">
          <p className="text-red-600">Erreur : {error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Image</th>
                <th className="table-header-cell">Label</th>
                <th className="table-header-cell">Catégorie</th>
                <th className="table-header-cell">Statut</th>
                <th className="table-header-cell">Gauche</th>
                <th className="table-header-cell">Droite</th>
                <th className="table-header-cell">Signalements</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="table-cell">
                    {it.image_key ? (
                      <img
                        src={imageUrl(it.image_key)}
                        alt=""
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <InlineText
                      value={it.label ?? ''}
                      display={
                        it.label ?? (
                          <span className="text-gray-400">Sans label</span>
                        )
                      }
                      onSave={(v) => saveLabel(it, v)}
                    />
                  </td>
                  <td className="table-cell">
                    {catEditing === it.id ? (
                      <div className="w-72 space-y-1">
                        <CategoryPicker
                          categories={categories}
                          selected={new Set(it.category_keys)}
                          onToggle={(key) => toggleCategory(it, key)}
                          onCreated={(cat) =>
                            setCategories((list) => [...list, cat])
                          }
                          token={token}
                          onError={setError}
                        />
                        <button
                          type="button"
                          onClick={() => setCatEditing(null)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Fermer
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCatEditing(it.id)}
                        className="-mx-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-blue-50"
                        title="Cliquer pour modifier"
                      >
                        {it.category_keys.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {it.category_keys.map((key) => (
                              <span
                                key={key}
                                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800"
                              >
                                {categories.find((c) => c.key === key)?.name ??
                                  key}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="table-cell">
                    <select
                      value={it.status}
                      onChange={(e) =>
                        setItemStatus(it.id, e.target.value as ItemStatus)
                      }
                      className={`cursor-pointer appearance-none rounded-full border-0 px-2 py-1 text-xs font-semibold ${STATUS_STYLES[it.status]}`}
                      title="Cliquer pour modifier"
                    >
                      {(['pending', 'approved', 'rejected'] as ItemStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  {(['votes_left', 'votes_right'] as VoteField[]).map(
                    (field) => (
                      <td key={field} className="table-cell">
                        <div className="flex items-center gap-1">
                          <InlineText
                            value={String(it[field])}
                            inputType="number"
                            inputClass="w-16"
                            onSave={(v) => saveVotes(it, field, v)}
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => bumpVotes(it, field, 1)}
                              className="text-gray-400 transition-colors hover:text-blue-600"
                              title="+1 vote"
                            >
                              <ChevronUpIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => bumpVotes(it, field, -1)}
                              disabled={it[field] === 0}
                              className="text-gray-400 transition-colors hover:text-blue-600 disabled:opacity-30"
                              title="-1 vote"
                            >
                              <ChevronDownIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    ),
                  )}
                  <td className="table-cell">
                    {it.report_count > 0 ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {it.report_count}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditing(it)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1 rounded transition-colors"
                        title="Modifier"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      {it.status !== 'approved' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'approved')}
                          className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1 rounded transition-colors"
                          title="Approuver"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {it.status !== 'rejected' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'rejected')}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors"
                          title="Rejeter"
                        >
                          <XCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {it.status !== 'pending' && (
                        <button
                          onClick={() => setItemStatus(it.id, 'pending')}
                          className="text-gray-500 hover:text-gray-800 transition-colors"
                          title="Remettre en attente"
                        >
                          <ArrowUturnLeftIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => void deleteItem(it)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors"
                        title="Supprimer définitivement"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun item dans cette catégorie.</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>

      {editing && (
        <ItemEditModal
          item={editing}
          categories={categories}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
