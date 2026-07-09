import { useState } from 'react';
import { MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { API, apiGet, authHeaders } from '../lib/api';
import type { ImageCandidate } from '../types';

interface Props {
  itemId: number;
  /** Prefills the search field (usually the item's fr label). */
  initialQuery: string;
  token: string;
  onError: (message: string | null) => void;
  /** Called with the new image key + license once the server applied it. */
  onImageSet: (imageKey: string, license: string) => void;
}

/**
 * Free-license image finder: searches Wikimedia Commons + Pixabay via the
 * API, shows a candidate grid (source + license badge), one click copies
 * the image to R2 with its attribution. "Générer par IA" is the fallback
 * for items with no good match. Both apply immediately, like translations.
 */
export function ImagePicker({
  itemId,
  initialQuery,
  token,
  onError,
  onImageSet,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  // fullUrl of the candidate being applied (per-tile spinner).
  const [applyingUrl, setApplyingUrl] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const busy = searching || applyingUrl !== null || aiBusy;

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    onError(null);
    try {
      const data = await apiGet<{ candidates: ImageCandidate[] }>(
        `/admin/image-candidates?q=${encodeURIComponent(q)}`,
        token,
      );
      setCandidates(data.candidates);
      setSearched(true);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSearching(false);
    }
  }

  async function pick(candidate: ImageCandidate) {
    setApplyingUrl(candidate.fullUrl);
    onError(null);
    try {
      const res = await fetch(
        `${API}/admin/items/${itemId}/image-from-source`,
        {
          method: 'POST',
          headers: { ...authHeaders(token), 'content-type': 'application/json' },
          body: JSON.stringify({
            fullUrl: candidate.fullUrl,
            source: candidate.source,
            author: candidate.author,
            license: candidate.license,
            sourcePageUrl: candidate.sourcePageUrl,
          }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; imageKey?: string; error?: string };
      if (!data.ok || !data.imageKey) {
        throw new Error(data.error ?? `API ${res.status}`);
      }
      onImageSet(data.imageKey, candidate.license);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setApplyingUrl(null);
    }
  }

  async function generateAi() {
    setAiBusy(true);
    onError(null);
    try {
      const res = await fetch(`${API}/admin/items/${itemId}/ai-image`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { ok?: boolean; imageKey?: string; error?: string };
      if (!data.ok || !data.imageKey) {
        throw new Error(data.error ?? `API ${res.status}`);
      }
      onImageSet(data.imageKey, 'ai-generated');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          maxLength={100}
          placeholder="Rechercher une image libre…"
          className="input-field flex-1 !py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={busy || !query.trim()}
          className="flex items-center gap-1 rounded bg-blue-50 p-2 text-sm text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-900 disabled:opacity-40"
          title="Chercher (Wikimedia + Pixabay)"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          {searching ? 'Recherche…' : 'Chercher'}
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {candidates.map((cand) => (
            <button
              key={cand.fullUrl}
              type="button"
              onClick={() => void pick(cand)}
              disabled={busy}
              className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-white transition-shadow hover:ring-2 hover:ring-blue-400 disabled:opacity-60"
              title={`${cand.source} · ${cand.license}${cand.author ? ` · ${cand.author}` : ''}`}
            >
              <img
                src={cand.thumbUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[10px] text-white">
                {applyingUrl === cand.fullUrl
                  ? 'Application…'
                  : `${cand.source === 'wikimedia' ? 'Wikimedia' : 'Pixabay'} · ${cand.license}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {searched && !searching && candidates.length === 0 && (
        <p className="text-sm text-gray-400">
          Aucune image libre trouvée — essayez un autre terme ou l’IA.
        </p>
      )}

      <button
        type="button"
        onClick={() => void generateAi()}
        disabled={busy}
        className="flex items-center gap-1 rounded bg-purple-50 px-3 py-1.5 text-sm text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-40"
        title="Générer une image avec Workers AI (flux-1-schnell)"
      >
        <SparklesIcon className="h-4 w-4" />
        {aiBusy ? 'Génération…' : 'Générer par IA'}
      </button>
    </div>
  );
}
