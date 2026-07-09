import { useState } from 'react';
import { CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { API, authHeaders } from '../lib/api';
import type { Category } from '../types';

/** name → url-safe key: strip accents, non [a-z0-9] to dashes, max 50. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

interface Props {
  categories: Category[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  /** Called with the new key after an inline create (already selected). */
  onCreated?: (category: Category) => void;
  token: string;
  onError: (message: string | null) => void;
}

/**
 * Category pill multi-select with an inline "+" that turns into a text
 * field to create a category on the spot (fr name, slugified key).
 */
export function CategoryPicker({
  categories,
  selected,
  onToggle,
  onCreated,
  token,
  onError,
}: Props) {
  // Categories created inline here, not yet in the parent `categories` prop.
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  // Skip inline-created ones the parent has since re-fetched.
  const all = [
    ...categories,
    ...extraCategories.filter(
      (extra) => !categories.some((cat) => cat.key === extra.key),
    ),
  ];

  async function createCategory() {
    const name = newName.trim();
    const key = slugify(name);
    if (!name || !key) {
      onError('Nom de catégorie invalide');
      return;
    }
    if (all.some((cat) => cat.key === key)) {
      onError('Catégorie déjà existante');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`${API}/admin/categories`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify({ key, translations: { fr: name } }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? `API ${res.status}`);
      const created: Category = { key, name };
      setExtraCategories((list) => [...list, created]);
      onToggle(key); // select it right away
      onCreated?.(created);
      setNewName('');
      setAdding(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {all.map((cat) => {
        const checked = selected.has(cat.key);
        return (
          <label
            key={cat.key}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
              checked
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(cat.key)}
              className="sr-only"
            />
            {cat.name}
          </label>
        );
      })}

      {/* Inline "add category": + button becomes a text field. */}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void createCategory();
              } else if (e.key === 'Escape') {
                setAdding(false);
                setNewName('');
              }
            }}
            maxLength={80}
            placeholder="Nouvelle catégorie"
            className="input-field w-44 !py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void createCategory()}
            disabled={busy}
            className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-2 rounded transition-colors disabled:opacity-40"
            title="Créer la catégorie"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewName('');
            }}
            disabled={busy}
            className="text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 p-2 rounded transition-colors disabled:opacity-40"
            title="Annuler"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-400 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          title="Ajouter une catégorie"
        >
          <PlusIcon className="h-4 w-4" />
          Catégorie
        </button>
      )}

      {all.length === 0 && (
        <span className="text-sm text-gray-400">Aucune catégorie</span>
      )}
    </div>
  );
}
