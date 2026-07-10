import { useEffect, useState } from 'react';
import {
  XMarkIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { API, apiGet, authHeaders, imageUrl } from '../lib/api';
import { ITEM_FLAGS } from '../lib/flags';
import { CategoryPicker } from './CategoryPicker';
import { ImagePicker } from './ImagePicker';
import type { AdminItem, Category, ItemStatus, ItemTranslation } from '../types';

const STATUSES: ItemStatus[] = ['pending', 'approved', 'rejected'];
const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

interface Props {
  item: AdminItem;
  categories: Category[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ItemEditModal({
  item,
  categories,
  token,
  onClose,
  onSaved,
}: Props) {
  const [label, setLabel] = useState(item.label ?? '');
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [votesLeft, setVotesLeft] = useState(String(item.votes_left));
  const [votesRight, setVotesRight] = useState(String(item.votes_right));
  const [categoryKeys, setCategoryKeys] = useState<Set<string>>(
    () => new Set(item.category_keys),
  );
  const [flags, setFlags] = useState<Record<'not_mobile' | 'nsfw', boolean>>({
    not_mobile: item.not_mobile === 1,
    nsfw: item.nsfw === 1,
  });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Marks a self-uploaded replacement as AI-made (license = ai-generated).
  const [aiGenerated, setAiGenerated] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // License of the displayed image (updates when the picker applies one).
  const [imageLicense, setImageLicense] = useState(item.image_license);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Translations other than fr (fr is the main "Label" field above).
  const [translations, setTranslations] = useState<ItemTranslation[]>([]);
  const [newLang, setNewLang] = useState('');
  const [newTransLabel, setNewTransLabel] = useState('');
  const [transBusy, setTransBusy] = useState(false);

  useEffect(() => {
    apiGet<{ translations: ItemTranslation[] }>(
      `/admin/items/${item.id}/translations`,
      token,
    )
      .then((d) => setTranslations(d.translations.filter((t) => t.lang !== 'fr')))
      .catch(() => setTranslations([]));
  }, [item.id, token]);

  async function saveTranslation(
    lang: string,
    transLabel: string,
  ): Promise<boolean> {
    const value = transLabel.trim();
    if (!value) {
      setError(`Label ${lang} requis`);
      return false;
    }
    setTransBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/admin/items/${item.id}/translations/${lang}`,
        {
          method: 'PUT',
          headers: { ...authHeaders(token), 'content-type': 'application/json' },
          body: JSON.stringify({ label: value }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? `API ${res.status}`);
      setTranslations((list) =>
        list.some((t) => t.lang === lang)
          ? list.map((t) => (t.lang === lang ? { lang, label: value } : t))
          : [...list, { lang, label: value }],
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return false;
    } finally {
      setTransBusy(false);
    }
  }

  async function deleteTranslation(lang: string) {
    setTransBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/admin/items/${item.id}/translations/${lang}`,
        { method: 'DELETE', headers: authHeaders(token) },
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      setTranslations((list) => list.filter((t) => t.lang !== lang));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setTransBusy(false);
    }
  }

  function addTranslation() {
    const lang = newLang.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(lang) || lang === 'fr') {
      setError('Langue : code ISO à 2 lettres (en, es…), fr est géré au-dessus');
      return;
    }
    void saveTranslation(lang, newTransLabel).then((ok) => {
      if (ok) {
        setNewLang('');
        setNewTransLabel('');
      }
    });
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Fichier image requis');
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (label.trim() === '') {
      setError('Label requis');
      return;
    }
    const left = Number(votesLeft);
    const right = Number(votesRight);
    if (!Number.isInteger(left) || left < 0 || !Number.isInteger(right) || right < 0) {
      setError('Votes invalides (entier ≥ 0)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Replace the image first, if a new one was chosen.
      if (file) {
        const form = new FormData();
        form.set('image', file);
        if (aiGenerated) form.set('ai_generated', '1');
        const imgRes = await fetch(`${API}/admin/items/${item.id}/image`, {
          method: 'PATCH',
          headers: authHeaders(token),
          body: form,
        });
        if (!imgRes.ok) throw new Error(`Image ${imgRes.status}`);
      }

      const res = await fetch(`${API}/admin/items/${item.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          status,
          votes_left: left,
          votes_right: right,
          not_mobile: flags.not_mobile,
          nsfw: flags.nsfw,
          categoryKeys: [...categoryKeys],
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? `API ${res.status}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  const currentImage = previewUrl ?? (item.image_key ? imageUrl(item.image_key) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Modifier l’item #{item.id}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title="Fermer"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image
            </label>
            <div className="flex items-center gap-4">
              <div>
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt=""
                    className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400">
                    <PhotoIcon className="h-8 w-8" />
                  </div>
                )}
                {imageLicense && (
                  <p className="mt-1 max-w-20 truncate text-[10px] text-gray-400" title={imageLicense}>
                    {imageLicense}
                  </p>
                )}
              </div>
              <label className="btn-secondary cursor-pointer">
                {file ? 'Changer' : 'Remplacer'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="btn-secondary flex items-center gap-1"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                Chercher une image
              </button>
            </div>
            {file && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={aiGenerated}
                  onChange={(e) => setAiGenerated(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Image générée par IA
              </label>
            )}
            {showPicker && (
              <div className="mt-3">
                <ImagePicker
                  itemId={item.id}
                  initialQuery={label}
                  token={token}
                  onError={setError}
                  onImageSet={(imageKey, license) => {
                    // Applied server-side already; drop any pending upload
                    // so Save doesn't overwrite it.
                    setFile(null);
                    setPreviewUrl(imageUrl(imageKey));
                    setImageLicense(license);
                    setShowPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (fr) *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              className="input-field"
            />
          </div>

          {/* Other translations — saved immediately, independent of Save. */}
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
                    onClick={() => void saveTranslation(tr.lang, tr.label)}
                    disabled={transBusy}
                    className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-2 rounded transition-colors disabled:opacity-40"
                    title="Enregistrer la traduction"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTranslation(tr.lang)}
                    disabled={transBusy}
                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors disabled:opacity-40"
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
                  disabled={transBusy}
                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-2 rounded transition-colors disabled:opacity-40"
                  title="Ajouter une traduction"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Categories (multi-select) */}
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

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
              className="input-field"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Flags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drapeaux
            </label>
            <div className="space-y-2">
              {ITEM_FLAGS.map((flag) => (
                <label key={flag.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={flags[flag.key]}
                    onChange={(e) =>
                      setFlags((f) => ({ ...f, [flag.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{flag.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Votes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votes gauche
              </label>
              <input
                type="number"
                min={0}
                value={votesLeft}
                onChange={(e) => setVotesLeft(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votes droite
              </label>
              <input
                type="number"
                min={0}
                value={votesRight}
                onChange={(e) => setVotesRight(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Annuler
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
