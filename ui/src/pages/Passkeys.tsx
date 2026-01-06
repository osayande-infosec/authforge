import { motion } from 'framer-motion';
import { Key, Plus, Fingerprint, Trash2, Shield, Smartphone } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../store';

interface Passkey {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function Passkeys() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [_isLoading, setIsLoading] = useState(true);

  const fetchPasskeys = async () => {
    try {
      const data = await api<{ passkeys: Passkey[] }>('/passkeys');
      setPasskeys(data.passkeys);
    } catch (error) {
      console.error('Failed to fetch passkeys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      // Start registration - get challenge from server
      const startData = await api<{ challengeId: string; options: any }>('/passkeys/register/start', {
        method: 'POST'
      });

      console.log('WebAuthn options:', startData.options);

      // Prompt user to create passkey using browser API
      // The options object should be passed directly, not wrapped in optionsJSON
      const credential = await startRegistration(startData.options);

      // Complete registration on server
      const name = prompt('Give this passkey a name:', `Passkey ${new Date().toLocaleDateString()}`);
      
      await api('/passkeys/register/complete', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: startData.challengeId,
          credential,
          name: name || undefined
        })
      });

      toast.success('Passkey registered successfully!');
      fetchPasskeys();
    } catch (error: any) {
      console.error('Passkey error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Passkey registration was cancelled');
      } else if (error.name === 'InvalidStateError') {
        toast.error('This passkey is already registered');
      } else {
        toast.error(error.message || 'Failed to register passkey');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await api(`/passkeys/${id}`, { method: 'DELETE' });
      toast.success('Passkey deleted');
      setPasskeys(passkeys.filter(p => p.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete passkey');
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Passkeys</h1>
          <p className="text-dark-400">Manage your passwordless authentication credentials</p>
        </div>
        <button
          onClick={handleRegister}
          disabled={isRegistering}
          className="btn-primary"
        >
          {isRegistering ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Add Passkey
            </>
          )}
        </button>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/20"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <Fingerprint className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">What are Passkeys?</h3>
            <p className="text-dark-300 text-sm">
              Passkeys are a more secure and convenient replacement for passwords. 
              They use your device's biometrics (fingerprint or face) or a hardware security key 
              to authenticate you without typing a password.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Passkeys List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Your Passkeys</h2>
        
        {passkeys.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-white font-medium mb-2">No passkeys yet</h3>
            <p className="text-dark-400 text-sm mb-4">
              Add a passkey to enable passwordless sign-in
            </p>
            <button onClick={handleRegister} disabled={isRegistering} className="btn-primary">
              <Plus className="w-5 h-5" />
              Register Passkey
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    {passkey.deviceType === 'platform' ? (
                      <Smartphone className="w-5 h-5 text-primary-400" />
                    ) : (
                      <Shield className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{passkey.name}</h4>
                    <p className="text-dark-400 text-sm">
                      Added {new Date(passkey.createdAt).toLocaleDateString()}
                      {passkey.lastUsedAt && ` • Last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(passkey.id, passkey.name)}
                  className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
