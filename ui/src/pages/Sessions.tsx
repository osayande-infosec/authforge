import { motion } from 'framer-motion';
import { MonitorSmartphone, Globe, Clock, Trash2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { sessionsApi, Session } from '../store';
import toast from 'react-hot-toast';

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await sessionsApi.list();
      setSessions(data.sessions);
      setCurrentSessionId(data.currentSessionId);
    } catch (error) {
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;

    try {
      await sessionsApi.revoke(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      toast.success('Session revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke session');
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('This will sign you out of all other devices. Continue?')) return;

    try {
      await sessionsApi.revokeAll();
      setSessions(sessions.filter(s => s.isCurrent));
      toast.success('All other sessions revoked');
    } catch (error) {
      toast.error('Failed to revoke sessions');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-dark-400">Manage your active sessions across devices</p>
        </div>
        {sessions.length > 1 && (
          <button onClick={handleRevokeAll} className="btn-danger">
            <AlertCircle className="w-5 h-5" />
            Revoke All Others
          </button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Active Sessions</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <MonitorSmartphone className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-white font-medium">No sessions found</h3>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 rounded-xl border ${
                  session.isCurrent
                    ? 'bg-primary-500/5 border-primary-500/20'
                    : 'bg-dark-800/50 border-dark-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      session.isCurrent ? 'bg-primary-500/20' : 'bg-dark-700'
                    }`}>
                      <MonitorSmartphone className={`w-5 h-5 ${session.isCurrent ? 'text-primary-400' : 'text-dark-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {session.browser} on {session.os}
                        </span>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-dark-400">
                        <span className="flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          {session.ipAddress}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(session.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevoke(session.id)}
                      className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Revoke session"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
