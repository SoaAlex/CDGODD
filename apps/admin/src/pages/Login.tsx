import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const [token, setToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(token.trim());
    if (ok) navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <LockClosedIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            CDGODD Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Collez votre token admin pour accéder au panneau
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700"
              >
                Token admin
              </label>
              <input
                id="token"
                name="token"
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input-field mt-1"
                placeholder="Bearer token"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || token.trim() === ''}
              className="btn-primary w-full"
            >
              {isLoading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
