import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API, authHeaders } from '../lib/api';
import { CategoryPicker } from '../components/CategoryPicker';
import { ImagePicker, type ImageChoice } from '../components/ImagePicker';
import type { Category, ItemTranslation } from '../types';

const MAX_BYTES = 10 * 1024 * 1024;
const VALID_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export function AddItem() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Bulk mode: stay on the page after a create, keep categories,
  // clear label + image so the next item can be typed immediately.
  const [bulkMode, setBulkMode] = useState(false);
  const [label, setLabel] = useState('');
  const [categoryKeys, setCategoryKeys] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  // Extra labels sent with the create call (fr is the main field above).
  const [translations, setTranslations] = useState<ItemTranslation[]>([]);
  const [newLang, setNewLang] = useState('');
  const [newTransLabel, setNewTransLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Free-license candidate or AI generation, applied after the create call.
  const [imageChoice, setImageChoice] = useState<ImageChoice | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/categories?lang=fr`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, []);

  function selectFile(f: File) {
    if (!VALID_TYPES.includes(f.type)) {
      setError('Fichier image requis (JPEG, PNG, GIF, WebP)');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('Image trop lourde (max 10 Mo)');
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setImageChoice(null); // upload replaces a picked candidate
  }

  function removeFile() {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addTranslation() {
    const lang = newLang.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(lang) || lang === 'fr') {
      setError('Langue : code ISO à 2 lettres (en, es…), fr est géré au-dessus');
      return;
    }
    if (!newTransLabel.trim()) {
      setError('Label traduit requis');
      return;
    }
    setError(null);
    const value = newTransLabel.trim();
    setTranslations((list) =>
      list.some((t) => t.lang === lang)
        ? list.map((t) => (t.lang === lang ? { lang, label: value } : t))
        : [...list, { lang, label: value }],
    );
    setNewLang('');
    setNewTransLabel('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim() === '') {
      setError('Label requis');
      return;
    }
    if (translations.some((t) => t.label.trim() === '')) {
      setError('Label traduit vide — complétez ou supprimez la ligne');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.set('label', label.trim());
    form.set('lang', 'fr');
    if (translations.length > 0) {
      form.set(
        'translations',
        JSON.stringify(
          Object.fromEntries(translations.map((t) => [t.lang, t.label.trim()])),
        ),
      );
    }
    for (const key of categoryKeys) form.append('categoryKeys', key);
    if (file) form.set('image', file);

    try {
      const res = await fetch(`${API}/admin/items`, {
        method: 'POST',
        headers: authHeaders(token),
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        itemId?: number;
        error?: string;
      };
      if (!data.ok || data.itemId === undefined) {
        setError(data.error ?? `API ${res.status}`);
        return;
      }

      // Picked candidate / AI generation: apply now that the item exists.
      if (imageChoice) {
        const applied = await applyImageChoice(data.itemId, imageChoice);
        if (!applied) {
          // Item exists — send the admin to the list to fix it, not resubmit.
          setError(
            `Item #${data.itemId} créé, mais image non appliquée — utilisez Modifier.`,
          );
          if (bulkMode) resetForNextItem();
          else setTimeout(() => navigate('/items'), 2500);
          return;
        }
      }

      if (bulkMode) {
        setSuccess(`Item « ${label.trim()} » créé — au suivant.`);
        resetForNextItem();
      } else {
        setSuccess('Item créé (publié directement).');
        setTimeout(() => navigate('/items'), 1200);
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  /** Bulk mode: clear per-item fields, keep categories for the next one. */
  function resetForNextItem() {
    setLabel('');
    setTranslations([]);
    setNewLang('');
    setNewTransLabel('');
    removeFile();
    setImageChoice(null);
    setShowPicker(false);
    labelInputRef.current?.focus();
  }

  /** POST the deferred picker choice onto the freshly created item. */
  async function applyImageChoice(
    itemId: number,
    choice: ImageChoice,
  ): Promise<boolean> {
    try {
      const url =
        choice.kind === 'ai'
          ? `${API}/admin/items/${itemId}/ai-image`
          : `${API}/admin/items/${itemId}/image-from-source`;
      const body =
        choice.kind === 'ai'
          ? {}
          : {
              fullUrl: choice.candidate.fullUrl,
              source: choice.candidate.source,
              author: choice.candidate.author,
              license: choice.candidate.license,
              sourcePageUrl: choice.candidate.sourcePageUrl,
            };
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean };
      return data.ok === true;
    } catch {
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Créer un item</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajouter un item avec un label et une image. Publié immédiatement.
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (fr) *
            </label>
            <input
              ref={labelInputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              required
              className="input-field"
              placeholder="Ex. : Impôt sur la fortune"
            />
          </div>

          {/* Other translations — sent together with the create call. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Autres traductions
            </label>
            <div className="space-y-2">
              {translations.map((tr) => (
                <div key={tr.lang} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-center text-xs font-semibold uppercase text-gray-500">
                    {tr.lang}
                  </span>
                  <input
                    type="text"
                    value={tr.label}
                    maxLength={80}
                    onChange={(e) =>
                      setTranslations((list) =>
                        list.map((t) =>
                          t.lang === tr.lang
                            ? { ...t, label: e.target.value }
                            : t,
                        ),
                      )
                    }
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTranslations((list) =>
                        list.filter((t) => t.lang !== tr.lang),
                      )
                    }
                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors"
                    title="Supprimer la traduction"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
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
                  value={newTransLabel}
                  onChange={(e) => setNewTransLabel(e.target.value)}
                  maxLength={80}
                  placeholder="Label traduit"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={addTranslation}
                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors"
                  title="Ajouter une traduction"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégories
            </label>
            <CategoryPicker
              categories={categories}
              selected={categoryKeys}
              onToggle={(key) =>
                setCategoryKeys((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              token={token}
              onError={setError}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image
            </label>
            {imageChoice?.kind === 'candidate' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={imageChoice.candidate.thumbUrl}
                    alt="Aperçu"
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Image libre sélectionnée
                    </p>
                    <p className="text-sm text-gray-500">
                      {imageChoice.candidate.source === 'wikimedia'
                        ? 'Wikimedia'
                        : 'Pixabay'}{' '}
                      · {imageChoice.candidate.license}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageChoice(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : imageChoice?.kind === 'ai' ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <SparklesIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Image générée par IA
                    </p>
                    <p className="text-sm text-gray-500">
                      Générée à la création, d’après le label
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageChoice(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : !file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                  isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) selectFile(dropped);
                }}
              >
                <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    <ArrowUpTrayIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    Glissez-déposez une image ou cliquez pour choisir
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    PNG, JPG, GIF, WebP — 10 Mo max
                  </span>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) selectFile(chosen);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={previewUrl ?? ''}
                    alt="Aperçu"
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} Mo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="btn-secondary mt-3 flex items-center gap-1"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Chercher une image libre
            </button>
            {showPicker && (
              <div className="mt-3">
                <ImagePicker
                  initialQuery={label}
                  token={token}
                  onError={setError}
                  onSelect={(choice) => {
                    removeFile(); // picker choice replaces an upload
                    setImageChoice(choice);
                    setShowPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Mode rapide — rester sur la page après création
            </label>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/items')}
                className="btn-secondary"
                disabled={loading}
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Création…' : 'Créer l’item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
