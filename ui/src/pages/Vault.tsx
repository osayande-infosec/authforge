import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Plus, Search, Key, CreditCard, FileText, User, Trash2, Eye, EyeOff, Copy, X, Shield, Unlock } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api, useAuthStore } from '../store';
import {
  getStoredVaultKey,
  storeVaultKey,
  clearVaultKey,
  deriveKey,
  generateSalt,
  encryptVaultItem,
  decryptVaultItem,
  bufferToBase64,
  base64ToBuffer,
  hashMasterPassword,
  VaultItemData
} from '../lib/crypto';

const itemTypes = [
  { type: 'login', icon: Key, label: 'Login', color: 'text-primary-400' },
  { type: 'card', icon: CreditCard, label: 'Card', color: 'text-green-400' },
  { type: 'note', icon: FileText, label: 'Note', color: 'text-amber-400' },
  { type: 'identity', icon: User, label: 'Identity', color: 'text-purple-400' },
];

interface VaultItem {
  id: string;
  type: 'login' | 'note' | 'card' | 'identity';
  name: string;
  encryptedData?: string;
  iv?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DecryptedItem extends VaultItem {
  decryptedData?: VaultItemData;
}

export default function Vault() {
  const { user, setUser } = useAuthStore();
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [_isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  
  // Master password modals
  const [showSetupVault, setShowSetupVault] = useState(false);
  const [showUnlockVault, setShowUnlockVault] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // View item modal
  const [viewingItem, setViewingItem] = useState<DecryptedItem | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  // Form state
  const [itemName, setItemName] = useState('');
  const [itemData, setItemData] = useState<VaultItemData>({});

  // Check vault status on mount
  useEffect(() => {
    checkVaultStatus();
  }, []);

  const checkVaultStatus = async () => {
    // Check if vault key is in session
    const storedKey = await getStoredVaultKey();
    if (storedKey) {
      setVaultKey(storedKey);
    }
    
    // Check if user has vault set up
    if (user && !user.hasVault) {
      setShowSetupVault(true);
    } else if (user && user.hasVault && !storedKey) {
      setShowUnlockVault(true);
    }
    
    setIsLoading(false);
  };

  // Fetch items when vault is unlocked
  useEffect(() => {
    if (vaultKey) {
      fetchItems();
    }
  }, [vaultKey, filterType, searchQuery]);

  const fetchItems = async () => {
    if (!vaultKey) return;
    
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (searchQuery) params.append('search', searchQuery);
      
      const data = await api<{ items: VaultItem[] }>(`/vault/items?${params}`);
      setItems(data.items);
    } catch (error) {
      console.error('Failed to fetch vault items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupVault = async () => {
    if (masterPassword.length < 8) {
      toast.error('Master password must be at least 8 characters');
      return;
    }
    if (masterPassword !== confirmMasterPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsProcessing(true);
    try {
      // Generate salt and derive key
      const salt = generateSalt();
      const key = await deriveKey(masterPassword, salt);
      
      // Create verification hash
      const verificationHash = await hashMasterPassword(masterPassword, salt);
      
      // Store salt and verification hash on server
      await api('/vault/setup', {
        method: 'POST',
        body: JSON.stringify({
          salt: bufferToBase64(salt.buffer as ArrayBuffer),
          verificationHash
        })
      });
      
      // Store key in session
      await storeVaultKey(key, salt);
      setVaultKey(key);
      
      // Update user state
      if (user) {
        setUser({ ...user, hasVault: true });
      }
      
      setShowSetupVault(false);
      setMasterPassword('');
      setConfirmMasterPassword('');
      toast.success('Vault created! Your data is now encrypted.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup vault');
    } finally {
      setIsProcessing(false);
    }
  };

  const unlockVault = async () => {
    if (!masterPassword) {
      toast.error('Please enter your master password');
      return;
    }

    setIsProcessing(true);
    try {
      // Get salt from server
      const { salt: saltBase64, verificationHash: serverHash } = await api<{ salt: string; verificationHash: string }>('/vault/salt');
      
      const salt = new Uint8Array(base64ToBuffer(saltBase64));
      
      // Verify password
      const clientHash = await hashMasterPassword(masterPassword, salt);
      if (clientHash !== serverHash) {
        toast.error('Invalid master password');
        setIsProcessing(false);
        return;
      }
      
      // Derive key
      const key = await deriveKey(masterPassword, salt);
      
      // Store in session
      await storeVaultKey(key, salt);
      setVaultKey(key);
      
      setShowUnlockVault(false);
      setMasterPassword('');
      toast.success('Vault unlocked!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to unlock vault');
    } finally {
      setIsProcessing(false);
    }
  };

  const lockVault = () => {
    clearVaultKey();
    setVaultKey(null);
    setItems([]);
    setShowUnlockVault(true);
    toast.success('Vault locked');
  };

  const handleAddItem = async () => {
    if (!selectedType || !itemName || !vaultKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    try {
      // Encrypt the item data client-side
      const { encryptedData, iv } = await encryptVaultItem(itemData, vaultKey);
      
      await api('/vault/items', {
        method: 'POST',
        body: JSON.stringify({
          type: selectedType,
          name: itemName,
          encryptedData,
          iv
        })
      });

      toast.success('Item added to vault!');
      setShowAddModal(false);
      setSelectedType(null);
      setItemName('');
      setItemData({});
      fetchItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add item');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewItem = async (item: VaultItem) => {
    if (!vaultKey) {
      toast.error('Vault is locked. Please unlock first.');
      return;
    }
    
    try {
      // Fetch full item with encrypted data
      const { item: fullItem } = await api<{ item: VaultItem }>(`/vault/items/${item.id}`);
      console.log('Fetched item:', { id: fullItem.id, hasEncData: !!fullItem.encryptedData, hasIv: !!fullItem.iv });
      
      if (fullItem.encryptedData) {
        // Try to decrypt with AES-GCM first
        if (fullItem.iv) {
          try {
            const decryptedData = await decryptVaultItem(fullItem.encryptedData, fullItem.iv, vaultKey);
            console.log('Decrypted successfully:', decryptedData);
            setViewingItem({ ...fullItem, decryptedData });
            return;
          } catch (e) {
            console.error('AES decryption failed:', e);
            // Fall through to legacy handling
          }
        }
        
        // Handle legacy items stored with simple base64 encoding
        try {
          const legacyData = JSON.parse(atob(fullItem.encryptedData));
          console.log('Legacy data decoded:', legacyData);
          setViewingItem({ ...fullItem, decryptedData: legacyData });
          return;
        } catch (e) {
          console.error('Legacy base64 decode failed:', e);
        }
        
        // Show item anyway so user can at least delete it
        toast.error('Unable to decrypt item - you may need to re-enter your master password');
        setViewingItem({ ...fullItem, decryptedData: { error: 'Decryption failed' } });
      } else {
        setViewingItem(fullItem);
      }
    } catch (error: any) {
      console.error('Failed to load item:', error);
      toast.error('Failed to load item');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from vault?`)) return;
    
    try {
      await api(`/vault/items/${id}`, { method: 'DELETE' });
      toast.success('Item deleted');
      setItems(items.filter(i => i.id !== id));
      if (viewingItem?.id === id) setViewingItem(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getItemIcon = (type: string) => {
    const item = itemTypes.find(t => t.type === type);
    return item ? item.icon : Key;
  };

  const getItemColor = (type: string) => {
    const item = itemTypes.find(t => t.type === type);
    return item ? item.color : 'text-primary-400';
  };

  // Setup Vault Modal
  if (showSetupVault) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-dark-900 border border-dark-700 rounded-2xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Setup Your Vault</h2>
            <p className="text-dark-400">
              Create a master password to encrypt your vault. This password is never sent to our servers.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Master Password</label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="input"
                placeholder="••••••••••••"
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-2">Confirm Master Password</label>
              <input
                type="password"
                value={confirmMasterPassword}
                onChange={(e) => setConfirmMasterPassword(e.target.value)}
                className="input"
                placeholder="••••••••••••"
              />
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-400 text-sm">
                <strong>Important:</strong> This password cannot be recovered. If you forget it, you will lose access to all vault items.
              </p>
            </div>
            
            <button
              onClick={setupVault}
              disabled={isProcessing || !masterPassword || !confirmMasterPassword}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Create Encrypted Vault'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Unlock Vault Modal
  if (showUnlockVault && !vaultKey) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-dark-900 border border-dark-700 rounded-2xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Unlock Vault</h2>
            <p className="text-dark-400">
              Enter your master password to decrypt your vault.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-2">Master Password</label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && unlockVault()}
                className="input"
                placeholder="••••••••••••"
                autoFocus
              />
            </div>
            
            <button
              onClick={unlockVault}
              disabled={isProcessing || !masterPassword}
              className="btn-primary w-full"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Unlock className="w-5 h-5" />
                  Unlock Vault
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

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
        <div className="flex gap-2">
          <button onClick={lockVault} className="btn-secondary">
            <Lock className="w-5 h-5" />
            Lock
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
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
        <button 
          onClick={() => setFilterType(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            filterType === null 
              ? 'bg-primary-500/10 text-primary-400' 
              : 'bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700'
          }`}
        >
          All Items
        </button>
        {itemTypes.map(({ type, icon: Icon, label, color }) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              filterType === type 
                ? 'bg-primary-500/10 text-primary-400' 
                : 'bg-dark-800 text-dark-300 hover:text-white hover:bg-dark-700'
            }`}
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
                  onClick={() => { setSelectedType(type); setShowAddModal(true); }}
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
            {items.map((item) => {
              const Icon = getItemIcon(item.type);
              return (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl hover:bg-dark-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${getItemColor(item.type)}`} />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{item.name}</h4>
                      <p className="text-dark-400 text-sm capitalize">{item.type === 'login' ? 'Login' : item.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('View clicked for:', item.name);
                        handleViewItem(item);
                      }}
                      className="p-2 text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Delete clicked for:', item.name);
                        handleDelete(item.id, item.name);
                      }}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
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
          <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-white font-medium">End-to-end encrypted</h4>
            <p className="text-dark-400 text-sm mt-1">
              All vault items are encrypted with AES-256-GCM using your master password. 
              Encryption happens in your browser - the server never sees your plaintext data.
            </p>
          </div>
        </div>
      </motion.div>

      {/* View Item Modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getItemIcon(viewingItem.type);
                    return <Icon className={`w-6 h-6 ${getItemColor(viewingItem.type)}`} />;
                  })()}
                  <h3 className="text-xl font-semibold text-white">{viewingItem.name}</h3>
                </div>
                <button 
                  onClick={() => { setViewingItem(null); setShowPasswords({}); }}
                  className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>

              {viewingItem.decryptedData && viewingItem.decryptedData.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <p className="text-red-400 text-sm">
                    Unable to decrypt this item. The encryption key may have changed. 
                    Try locking and unlocking the vault with your master password.
                  </p>
                </div>
              )}

              {!viewingItem.decryptedData && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                  <p className="text-amber-400 text-sm">
                    This item has no data or couldn't be loaded. You may need to delete it and create a new one.
                  </p>
                </div>
              )}

              {viewingItem.decryptedData && !viewingItem.decryptedData.error && (
                <div className="space-y-4">
                  {/* Login/Password fields */}
                  {viewingItem.type === 'login' && (
                    <>
                      {viewingItem.decryptedData.username && (
                        <div className="bg-dark-800 rounded-xl p-4">
                          <label className="text-dark-400 text-sm">Username/Email</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-white">{viewingItem.decryptedData.username}</span>
                            <button
                              onClick={() => copyToClipboard(viewingItem.decryptedData!.username!, 'Username')}
                              className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                            >
                              <Copy className="w-4 h-4 text-dark-400" />
                            </button>
                          </div>
                        </div>
                      )}
                      {viewingItem.decryptedData.password && (
                        <div className="bg-dark-800 rounded-xl p-4">
                          <label className="text-dark-400 text-sm">Password</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-white font-mono">
                              {showPasswords['password'] ? viewingItem.decryptedData.password : '••••••••••••'}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => togglePasswordVisibility('password')}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                              >
                                {showPasswords['password'] ? (
                                  <EyeOff className="w-4 h-4 text-dark-400" />
                                ) : (
                                  <Eye className="w-4 h-4 text-dark-400" />
                                )}
                              </button>
                              <button
                                onClick={() => copyToClipboard(viewingItem.decryptedData!.password!, 'Password')}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                              >
                                <Copy className="w-4 h-4 text-dark-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {viewingItem.decryptedData.url && (
                        <div className="bg-dark-800 rounded-xl p-4">
                          <label className="text-dark-400 text-sm">Website</label>
                          <div className="flex items-center justify-between mt-1">
                            <a href={viewingItem.decryptedData.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                              {viewingItem.decryptedData.url}
                            </a>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Card fields */}
                  {viewingItem.type === 'card' && (
                    <>
                      {viewingItem.decryptedData.cardNumber && (
                        <div className="bg-dark-800 rounded-xl p-4">
                          <label className="text-dark-400 text-sm">Card Number</label>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-white font-mono">
                              {showPasswords['cardNumber'] ? viewingItem.decryptedData.cardNumber : '•••• •••• •••• ' + viewingItem.decryptedData.cardNumber.slice(-4)}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => togglePasswordVisibility('cardNumber')}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                              >
                                {showPasswords['cardNumber'] ? <EyeOff className="w-4 h-4 text-dark-400" /> : <Eye className="w-4 h-4 text-dark-400" />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(viewingItem.decryptedData!.cardNumber!, 'Card number')}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                              >
                                <Copy className="w-4 h-4 text-dark-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {viewingItem.decryptedData.expiry && (
                          <div className="bg-dark-800 rounded-xl p-4">
                            <label className="text-dark-400 text-sm">Expiry</label>
                            <p className="text-white mt-1">{viewingItem.decryptedData.expiry}</p>
                          </div>
                        )}
                        {viewingItem.decryptedData.cvv && (
                          <div className="bg-dark-800 rounded-xl p-4">
                            <label className="text-dark-400 text-sm">CVV</label>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-white font-mono">
                                {showPasswords['cvv'] ? viewingItem.decryptedData.cvv : '•••'}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility('cvv')}
                                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                              >
                                {showPasswords['cvv'] ? <EyeOff className="w-4 h-4 text-dark-400" /> : <Eye className="w-4 h-4 text-dark-400" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Note fields */}
                  {viewingItem.type === 'note' && viewingItem.decryptedData.content && (
                    <div className="bg-dark-800 rounded-xl p-4">
                      <label className="text-dark-400 text-sm">Note</label>
                      <p className="text-white mt-2 whitespace-pre-wrap">{viewingItem.decryptedData.content}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleDelete(viewingItem.id, viewingItem.name)}
                  className="btn-danger flex-1"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Add to Vault</h3>
              <button 
                onClick={() => { setShowAddModal(false); setSelectedType(null); setItemName(''); setItemData({}); }}
                className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-dark-400" />
              </button>
            </div>

            {!selectedType ? (
              <div className="grid grid-cols-2 gap-3">
                {itemTypes.map(({ type, icon: Icon, label, color }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left transition-colors"
                  >
                    <Icon className={`w-6 h-6 ${color} mb-2`} />
                    <span className="text-white font-medium">{label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-dark-300 text-sm mb-2">Name *</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="input"
                    placeholder={`${selectedType === 'login' ? 'Website name' : selectedType === 'card' ? 'Card name' : 'Item name'}`}
                  />
                </div>

                {selectedType === 'login' && (
                  <>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2">Username/Email</label>
                      <input
                        type="text"
                        value={itemData.username || ''}
                        onChange={(e) => setItemData({ ...itemData, username: e.target.value })}
                        className="input"
                        placeholder="username@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2">Password</label>
                      <input
                        type="password"
                        value={itemData.password || ''}
                        onChange={(e) => setItemData({ ...itemData, password: e.target.value })}
                        className="input"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2">Website URL</label>
                      <input
                        type="url"
                        value={itemData.url || ''}
                        onChange={(e) => setItemData({ ...itemData, url: e.target.value })}
                        className="input"
                        placeholder="https://example.com"
                      />
                    </div>
                  </>
                )}

                {selectedType === 'note' && (
                  <div>
                    <label className="block text-dark-300 text-sm mb-2">Note Content</label>
                    <textarea
                      value={itemData.content || ''}
                      onChange={(e) => setItemData({ ...itemData, content: e.target.value })}
                      className="input min-h-[120px]"
                      placeholder="Your secure note..."
                    />
                  </div>
                )}

                {selectedType === 'card' && (
                  <>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2">Card Number</label>
                      <input
                        type="text"
                        value={itemData.cardNumber || ''}
                        onChange={(e) => setItemData({ ...itemData, cardNumber: e.target.value })}
                        className="input"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-dark-300 text-sm mb-2">Expiry</label>
                        <input
                          type="text"
                          value={itemData.expiry || ''}
                          onChange={(e) => setItemData({ ...itemData, expiry: e.target.value })}
                          className="input"
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label className="block text-dark-300 text-sm mb-2">CVV</label>
                        <input
                          type="password"
                          value={itemData.cvv || ''}
                          onChange={(e) => setItemData({ ...itemData, cvv: e.target.value })}
                          className="input"
                          placeholder="•••"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setSelectedType(null); setItemData({}); }}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={!itemName || isProcessing}
                    className="btn-primary flex-1"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Add Item'
                    )}
                  </button>
                </div>
              </div>
            )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
