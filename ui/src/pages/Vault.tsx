import { motion } from 'framer-motion';
import { Lock, Plus, Search, Folder, Key, CreditCard, FileText, User } from 'lucide-react';
import { useState } from 'react';

const itemTypes = [
  { type: 'login', icon: Key, label: 'Login', color: 'text-primary-400' },
  { type: 'card', icon: CreditCard, label: 'Card', color: 'text-green-400' },
  { type: 'note', icon: FileText, label: 'Note', color: 'text-amber-400' },
  { type: 'identity', icon: User, label: 'Identity', color: 'text-purple-400' },
];

export default function Vault() {
  const [items] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Vault</h1>
          <p className="text-dark-400">Securely store passwords, cards, and notes</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search vault..."
          className="input pl-12"
        />
      </motion.div>

      {/* Item type filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-2"
      >
        <button className="px-4 py-2 bg-primary-500/10 text-primary-400 rounded-lg text-sm font-medium">
          All Items
        </button>
        {itemTypes.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            className="px-4 py-2 bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Icon className={`w-4 h-4 ${color}`} />
            {label}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card"
      >
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-dark-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Your vault is empty</h3>
            <p className="text-dark-400 max-w-sm mx-auto mb-6">
              Start adding passwords, credit cards, secure notes, and identities to your encrypted vault.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {itemTypes.map(({ type, icon: Icon, label, color }) => (
                <button
                  key={type}
                  className="btn-secondary"
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  Add {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Items would be listed here */}
          </div>
        )}
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-dark-800/30 border border-dark-700 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-white font-medium">End-to-end encrypted</h4>
            <p className="text-dark-400 text-sm mt-1">
              All vault items are encrypted with your master key before being stored. 
              Only you can decrypt your data - we never see your passwords.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
