import { motion } from 'framer-motion';
import { Shield, Key, MonitorSmartphone, Lock, ArrowRight, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { useEffect } from 'react';

const quickActions = [
  {
    title: 'Setup Passkeys',
    description: 'Add passwordless authentication',
    icon: Key,
    href: '/passkeys',
    color: 'primary'
  },
  {
    title: 'Enable 2FA',
    description: 'Add an extra layer of security',
    icon: Shield,
    href: '/security',
    color: 'purple'
  },
  {
    title: 'Manage Sessions',
    description: 'View and revoke active sessions',
    icon: MonitorSmartphone,
    href: '/sessions',
    color: 'green'
  },
  {
    title: 'Open Vault',
    description: 'Access your encrypted passwords',
    icon: Lock,
    href: '/vault',
    color: 'amber'
  }
];

const colorClasses = {
  primary: 'from-primary-500/20 to-primary-500/5 text-primary-400',
  purple: 'from-purple-500/20 to-purple-500/5 text-purple-400',
  green: 'from-green-500/20 to-green-500/5 text-green-400',
  amber: 'from-amber-500/20 to-amber-500/5 text-amber-400'
};

export default function Dashboard() {
  const { user, refreshUser } = useAuthStore();

  // Refresh user data on mount to get latest passkeys count, etc.
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const securityScore = calculateSecurityScore(user);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-dark-400">Here's an overview of your account security</p>
        </div>
        <Link to="/settings" className="btn-secondary">
          Account Settings
        </Link>
      </motion.div>

      {/* Security Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-shrink-0">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
              securityScore >= 80 ? 'bg-green-500/20' : 
              securityScore >= 50 ? 'bg-amber-500/20' : 'bg-red-500/20'
            }`}>
              <div className="text-center">
                <div className={`text-4xl font-bold ${
                  securityScore >= 80 ? 'text-green-400' : 
                  securityScore >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {securityScore}
                </div>
                <div className="text-sm text-dark-400">Security Score</div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-semibold text-white">Account Security</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SecurityItem 
                label="Email Verified" 
                status={user?.emailVerified || false}
                goodText="Verified"
                badText="Not verified"
              />
              <SecurityItem 
                label="Two-Factor Auth" 
                status={user?.has2FA || false}
                goodText="Enabled"
                badText="Disabled"
              />
              <SecurityItem 
                label="Password Set" 
                status={user?.hasPassword || false}
                goodText="Set"
                badText="Not set"
              />
              <SecurityItem 
                label="Passkeys" 
                status={(user?.authMethods?.passkeys || 0) > 0}
                goodText={`${user?.authMethods?.passkeys || 0} registered`}
                badText="None"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            <Link
              to={action.href}
              className="card h-full flex flex-col hover:border-dark-600 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[action.color as keyof typeof colorClasses]} flex items-center justify-center mb-4`}>
                <action.icon className="w-6 h-6" />
              </div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-primary-400 transition-colors">
                {action.title}
              </h3>
              <p className="text-dark-400 text-sm flex-1">{action.description}</p>
              <div className="flex items-center text-primary-400 text-sm font-medium mt-4 group-hover:gap-2 transition-all">
                Configure
                <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <p className="text-dark-400 text-sm">Your latest account events</p>
            </div>
          </div>
          <Link to="/settings" className="text-primary-400 text-sm hover:text-primary-300">
            View all
          </Link>
        </div>

        <div className="space-y-4">
          <ActivityItem 
            action="Login successful"
            time="Just now"
            icon={CheckCircle2}
            iconColor="text-green-400"
          />
          <ActivityItem 
            action="Account created"
            time={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            icon={CheckCircle2}
            iconColor="text-green-400"
          />
        </div>
      </motion.div>
    </div>
  );
}

function SecurityItem({ label, status, goodText, badText }: { 
  label: string; 
  status: boolean;
  goodText: string;
  badText: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl">
      <span className="text-dark-300 text-sm">{label}</span>
      <div className={`flex items-center gap-1.5 text-sm ${status ? 'text-green-400' : 'text-amber-400'}`}>
        {status ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {status ? goodText : badText}
      </div>
    </div>
  );
}

function ActivityItem({ action, time, icon: Icon, iconColor }: {
  action: string;
  time: string;
  icon: any;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-dark-800/30 rounded-xl">
      <div className={`w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="text-white text-sm">{action}</p>
        <p className="text-dark-400 text-xs">{time}</p>
      </div>
    </div>
  );
}

function calculateSecurityScore(user: any): number {
  if (!user) return 0;
  
  let score = 20; // Base score for having an account
  
  if (user.emailVerified) score += 20;
  if (user.has2FA) score += 25;
  if (user.hasPassword) score += 15;
  if (user.authMethods?.passkeys > 0) score += 20;
  if (user.authMethods?.oauth?.length > 0) score += 10;
  
  return Math.min(score, 100);
}
