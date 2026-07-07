import { useState } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { API, authHeaders, imageUrl } from '../lib/api';
import type { AdminItem, Category, ItemStatus } from '../types';

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
  const [categoryKey, setCategoryKey] = useState(item.category_key ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          categoryKey: categoryKey || null,
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
              <label className="btn-secondary cursor-pointer">
                {file ? 'Changer' : 'Remplacer'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
            </div>
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

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <select
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className="input-field"
            >
              <option value="">(aucune)</option>
              {categories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.name}
                </option>
              ))}
            </select>
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
