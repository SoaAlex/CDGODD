import { useCallback, useEffect, useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API, apiGet, authHeaders } from '../lib/api';
import type { AdminCategory } from '../types';

/** JSON call with the admin bearer token; throws with the API error text. */
async function apiSend(
  path: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...authHeaders(token), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) throw new Error(data.error ?? `API ${res.status}`);
}

/** One category card: its key plus editable per-lang translations. */
function CategoryCard({
  category,
  token,
  onChanged,
  onError,
}: {
  category: AdminCategory;
  token: string;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(
    category.translations,
  );
  const [newLang, setNewLang] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  function saveTranslation(lang: string, name: string) {
    void run(() =>
      apiSend(`/admin/categories/${category.key}/translations/${lang}`, 'PUT', token, {
        name,
      }),
    );
  }

  function deleteTranslation(lang: string) {
    void run(() =>
      apiSend(
        `/admin/categories/${category.key}/translations/${lang}`,
        'DELETE',
        token,
      ),
    );
  }

  function addTranslation() {
    const lang = newLang.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(lang)) {
      onError('Langue : code ISO à 2 lettres (fr, en…)');
      return;
    }
    if (!newName.trim()) {
      onError('Nom requis');
      return;
    }
    setNewLang('');
    setNewName('');
    saveTranslation(lang, newName.trim());
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex px-2 py-1 text-sm font-mono font-semibold rounded bg-gray-100 text-gray-800">
          {category.key}
        </span>
        <span className="text-xs text-gray-400">
          {Object.keys(category.translations).length} traduction(s)
        </span>
      </div>

      <div className="space-y-2">
        {Object.entries(category.translations).map(([lang, original]) => (
          <div key={lang} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-center text-xs font-semibold uppercase text-gray-500">
              {lang}
            </span>
            <input
              type="text"
              value={names[lang] ?? original}
              maxLength={80}
              onChange={(e) =>
                setNames((n) => ({ ...n, [lang]: e.target.value }))
              }
              className="input-field flex-1"
            />
            <button
              onClick={() => saveTranslation(lang, names[lang] ?? original)}
              disabled={busy || (names[lang] ?? original).trim() === ''}
              className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-2 rounded transition-colors disabled:opacity-40"
              title="Enregistrer"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => deleteTranslation(lang)}
              disabled={busy}
              className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors disabled:opacity-40"
              title="Supprimer la traduction"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        {/* Add a translation */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <input
            type="text"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value)}
            maxLength={2}
            placeholder="en"
            className="input-field w-16 text-center"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            placeholder="Nom traduit"
            className="input-field flex-1"
          />
          <button
            onClick={addTranslation}
            disabled={busy}
            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors disabled:opacity-40"
            title="Ajouter la traduction"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Categories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState('');
  const [newFrName, setNewFrName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ categories: AdminCategory[] }>(
        '/admin/categories',
        token,
      );
      setCategories(data.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,50}$/.test(key)) {
      setError('Clé : minuscules, chiffres et tirets uniquement');
      return;
    }
    if (!newFrName.trim()) {
      setError('Nom (fr) requis');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await apiSend('/admin/categories', 'POST', token, {
        key,
        translations: { fr: newFrName.trim() },
      });
      setNewKey('');
      setNewFrName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
        <p className="mt-1 text-sm text-gray-500">
          Créer des catégories et gérer leurs traductions
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-800 font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Nouvelle catégorie
        </h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clé *
            </label>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              maxLength={50}
              placeholder="ex. : sport"
              className="input-field w-48"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom (fr) *
            </label>
            <input
              type="text"
              value={newFrName}
              onChange={(e) => setNewFrName(e.target.value)}
              maxLength={80}
              placeholder="ex. : Sport"
              className="input-field"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Création…' : 'Créer'}
          </button>
        </form>
      </div>

      {/* Category list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">Aucune catégorie.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.key}
              category={cat}
              token={token}
              onChanged={() => void load()}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
