import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Key, Fingerprint, Mail, Lock, Github, ArrowRight, Check } from 'lucide-react';

const features = [
  {
    icon: Fingerprint,
    title: 'Passkeys',
    description: 'Passwordless authentication using biometrics and hardware security keys'
  },
  {
    icon: Key,
    title: 'OAuth2 SSO',
    description: 'Sign in with Google, GitHub, and more identity providers'
  },
  {
    icon: Mail,
    title: 'Magic Links',
    description: 'Passwordless email-based authentication flow'
  },
  {
    icon: Shield,
    title: 'TOTP 2FA',
    description: 'Time-based one-time passwords for extra security'
  },
  {
    icon: Lock,
    title: 'Encrypted Vault',
    description: 'Store passwords and secrets with end-to-end encryption'
  },
  {
    icon: Github,
    title: 'Open Source',
    description: 'Self-host on Cloudflare Workers. Your data, your control.'
  }
];

const benefits = [
  'Zero-knowledge encryption',
  'No vendor lock-in',
  'GDPR compliant',
  'SOC 2 ready',
  'Free tier friendly',
  'Edge deployment'
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-dark-950 overflow-hidden">
      {/* Hero section */}
      <div className="relative">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-mesh" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary-500/20 rounded-full blur-[128px] -translate-y-1/2" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-purple-500/20 rounded-full blur-[100px]" />
        
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 lg:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-white">AuthForge</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 px-6 lg:px-8 pt-20 pb-32 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              Self-hosted Auth0 Alternative
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
              <span className="text-white">Modern </span>
              <span className="text-gradient">Authentication</span>
              <br />
              <span className="text-white">for Modern Apps</span>
            </h1>
            
            <p className="text-xl text-dark-300 max-w-2xl mx-auto mb-12">
              Open-source authentication platform with Passkeys, OAuth, Magic Links, and an encrypted vault. 
              Deploy on Cloudflare Workers in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="btn-primary px-8 py-3 text-base">
                Start for Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="https://github.com/osayande-infosec/authforge" 
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-8 py-3 text-base"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
            </div>

            {/* Benefits */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-16">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-dark-300">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features section */}
      <div className="relative py-24 bg-dark-900/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need for authentication
            </h2>
            <p className="text-lg text-dark-300 max-w-2xl mx-auto">
              Built with security-first principles and modern standards. No compromises.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card hover:border-dark-700 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-dark-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA section */}
      <div className="relative py-24">
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to secure your app?
            </h2>
            <p className="text-lg text-dark-300 mb-8">
              Get started in under 5 minutes. No credit card required.
            </p>
            <Link to="/register" className="btn-primary px-8 py-3 text-base">
              Create Your Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-white">AuthForge</span>
            </div>
            <p className="text-dark-400 text-sm">
              © {new Date().getFullYear()} AuthForge. Open source under MIT license.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
