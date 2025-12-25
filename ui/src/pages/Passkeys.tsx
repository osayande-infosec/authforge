import { motion } from 'framer-motion';
import { Key, Plus, Trash2, Fingerprint } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Passkeys() {
  const [passkeys] = useState([]);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      // TODO: Implement WebAuthn registration
      toast.error('Passkey registration coming soon!');
    } catch (error) {
      toast.error('Failed to register passkey');
    } finally {
      setIsRegistering(false);
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
            <button onClick={handleRegister} className="btn-primary">
              <Plus className="w-5 h-5" />
              Register Passkey
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Passkey items would go here */}
          </div>
        )}
      </motion.div>
    </div>
  );
}
