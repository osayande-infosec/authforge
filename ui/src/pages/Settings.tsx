import { motion } from 'framer-motion';
import { User, Mail, Camera, Save, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthStore, userApi } from '../store';
import toast from 'react-hot-toast';

interface ProfileForm {
  name: string;
  email: string;
}

export default function Settings() {
  const { user, setUser, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { register, handleSubmit, formState: { isDirty } } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || ''
    }
  });

  const onSubmit = async (data: ProfileForm) => {
    setIsLoading(true);
    try {
      await userApi.updateProfile({ name: data.name });
      if (user) {
        setUser({ ...user, name: data.name });
      }
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const password = prompt('Enter your password to confirm:');
    if (!password) return;

    try {
      await userApi.deleteAccount(password, 'DELETE MY ACCOUNT');
      logout();
      toast.success('Account deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-dark-400">Manage your account settings and preferences</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <h2 className="text-lg font-semibold text-white mb-6">Profile</h2>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-3xl font-semibold text-white">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg flex items-center justify-center transition-colors">
              <Camera className="w-4 h-4 text-dark-300" />
            </button>
          </div>
          <div>
            <h3 className="text-white font-medium">{user?.name || 'No name set'}</h3>
            <p className="text-dark-400 text-sm">{user?.email}</p>
            <p className="text-dark-500 text-xs mt-1">
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="label">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                {...register('name')}
                type="text"
                className="input pl-12"
                placeholder="John Doe"
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                {...register('email')}
                type="email"
                className="input pl-12"
                disabled
              />
            </div>
            <p className="text-dark-500 text-xs mt-1">
              Contact support to change your email address
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isDirty}
            className="btn-primary"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card border-red-500/20"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
            <p className="text-dark-400 text-sm mt-1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-danger mt-4"
            >
              <Trash2 className="w-5 h-5" />
              Delete Account
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-w-md w-full"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Delete Account?</h3>
              <p className="text-dark-400 mb-6">
                This will permanently delete your account, all passkeys, vault items, and session data.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="btn-danger flex-1"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
