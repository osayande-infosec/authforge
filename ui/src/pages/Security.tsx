import { motion } from 'framer-motion';
import { Smartphone, Key, AlertTriangle, Check } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore, authApi } from '../store';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function Security() {
  const { user, setUser } = useAuthStore();
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string; otpauthUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup2FA = async () => {
    setIsLoading(true);
    try {
      const data = await authApi.setup2FA();
      setSetupData(data);
      setShowSetup2FA(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to setup 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const { backupCodes } = await authApi.verify2FASetup(verifyCode);
      setBackupCodes(backupCodes);
      if (user) {
        setUser({ ...user, has2FA: true });
      }
      toast.success('2FA enabled successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = prompt('Enter your 2FA code to disable:');
    if (!code) return;

    setIsLoading(true);
    try {
      await authApi.disable2FA(code);
      if (user) {
        setUser({ ...user, has2FA: false });
      }
      setShowSetup2FA(false);
      setSetupData(null);
      setBackupCodes(null);
      toast.success('2FA disabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Security</h1>
        <p className="text-dark-400">Manage your account security settings</p>
      </motion.div>

      {/* 2FA Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
              <p className="text-dark-400 text-sm mt-1">
                Add an extra layer of security using an authenticator app
              </p>
              <div className={`inline-flex items-center gap-1.5 mt-3 text-sm ${user?.has2FA ? 'text-green-400' : 'text-amber-400'}`}>
                {user?.has2FA ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {user?.has2FA ? 'Enabled' : 'Not enabled'}
              </div>
            </div>
          </div>
          
          {user?.has2FA ? (
            <button
              onClick={handleDisable2FA}
              disabled={isLoading}
              className="btn-danger"
            >
              Disable
            </button>
          ) : (
            <button
              onClick={handleSetup2FA}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Enable'
              )}
            </button>
          )}
        </div>

        {/* Setup Flow */}
        {showSetup2FA && setupData && !backupCodes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 pt-6 border-t border-dark-700"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-medium mb-3">1. Scan QR Code</h3>
                <p className="text-dark-400 text-sm mb-4">
                  Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code.
                </p>
                <div className="bg-white p-4 rounded-xl inline-block">
                  <QRCodeSVG value={setupData.otpauthUrl} size={180} />
                </div>
                <p className="text-dark-500 text-xs mt-3">
                  Manual entry: <code className="bg-dark-800 px-2 py-1 rounded">{setupData.secret}</code>
                </p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-3">2. Verify Code</h3>
                <p className="text-dark-400 text-sm mb-4">
                  Enter the 6-digit code from your authenticator app to verify setup.
                </p>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input text-center text-2xl tracking-[0.5em] font-mono mb-4"
                  placeholder="000000"
                  maxLength={6}
                />
                <button
                  onClick={handleVerify2FA}
                  disabled={isLoading || verifyCode.length !== 6}
                  className="btn-primary w-full"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify & Enable'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Backup Codes */}
        {backupCodes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 pt-6 border-t border-dark-700"
          >
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-amber-400 font-medium">Save your backup codes!</h4>
                  <p className="text-amber-400/80 text-sm mt-1">
                    Store these codes somewhere safe. You can use them to access your account if you lose your authenticator.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {backupCodes.map((code, i) => (
                <code key={i} className="bg-dark-800 px-3 py-2 rounded-lg text-center font-mono text-sm text-white">
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(backupCodes.join('\n'));
                toast.success('Backup codes copied!');
              }}
              className="btn-secondary mt-4"
            >
              Copy All Codes
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Other security options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Key className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Password</h2>
            <p className="text-dark-400 text-sm mt-1">
              {user?.hasPassword ? 'Change your password' : 'Set a password for your account'}
            </p>
          </div>
          <button className="btn-secondary">
            {user?.hasPassword ? 'Change' : 'Set Password'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
