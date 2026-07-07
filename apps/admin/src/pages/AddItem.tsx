import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PhotoIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { API, authHeaders } from '../lib/api';
import type { Category } from '../types';

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

  const [label, setLabel] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  }

  function removeFile() {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim() === '') {
      setError('Label requis');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = new FormData();
    form.set('label', label.trim());
    form.set('lang', 'fr');
    if (categoryKey) form.set('categoryKey', categoryKey);
    if (file) form.set('image', file);

    try {
      const res = await fetch(`${API}/admin/items`, {
        method: 'POST',
        headers: authHeaders(token),
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setSuccess('Item créé (publié directement).');
        setTimeout(() => navigate('/items'), 1200);
      } else {
        setError(data.error ?? `API ${res.status}`);
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
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
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              required
              className="input-field"
              placeholder="Ex. : Impôt sur la fortune"
            />
          </div>

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
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image
            </label>
            {!file ? (
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
          </div>

          <div className="flex justify-end space-x-3">
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
        </form>
      </div>
    </div>
  );
}
