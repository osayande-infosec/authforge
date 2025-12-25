import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowRight, Fingerprint } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, authApi } from '../store';

interface LoginForm {
  email: string;
  password: string;
}

interface TwoFAForm {
  code: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const { register: register2FA, handleSubmit: handleSubmit2FA, formState: { errors: errors2FA } } = useForm<TwoFAForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data.email, data.password);
      
      if (response.requires2FA) {
        setTempToken(response.tempToken!);
        setShow2FA(true);
        toast.success('Please enter your 2FA code');
      } else {
        setUser(response.user!);
        setToken(response.token!);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit2FA = async (data: TwoFAForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.verify2FA(tempToken, data.code);
      setUser(response.user);
      setToken(response.token);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    toast.error('Passkey login coming soon!');
    // TODO: Implement passkey login
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 bg-gradient-mesh">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Shield className="w-7 h-7 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-dark-400 mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card">
          {!show2FA ? (
            <>
              {/* Passkey button */}
              <button
                onClick={handlePasskeyLogin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-xl text-white font-medium transition-all mb-6"
              >
                <Fingerprint className="w-5 h-5 text-primary-400" />
                Sign in with Passkey
              </button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dark-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-dark-900/50 text-dark-400">or continue with email</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                      })}
                      type="email"
                      className={`input pl-12 ${errors.email ? 'input-error' : ''}`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                      {...register('password', { required: 'Password is required' })}
                      type={showPassword ? 'text' : 'password'}
                      className={`input pl-12 pr-12 ${errors.password ? 'input-error' : ''}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded bg-dark-800 border-dark-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-dark-950" />
                    <span className="text-dark-300">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-primary-400 hover:text-primary-300">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-3"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* 2FA Form */
            <form onSubmit={handleSubmit2FA(onSubmit2FA)} className="space-y-5">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-primary-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
                <p className="text-dark-400 text-sm mt-1">Enter the code from your authenticator app</p>
              </div>

              <div>
                <input
                  {...register2FA('code', { 
                    required: 'Code is required',
                    pattern: { value: /^\d{6}$/, message: 'Must be 6 digits' }
                  })}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={`input text-center text-2xl tracking-[0.5em] font-mono ${errors2FA.code ? 'input-error' : ''}`}
                  placeholder="000000"
                />
                {errors2FA.code && (
                  <p className="text-red-400 text-sm mt-1 text-center">{errors2FA.code.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Verify'
                )}
              </button>

              <button
                type="button"
                onClick={() => setShow2FA(false)}
                className="btn-ghost w-full"
              >
                Use a different method
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-dark-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
