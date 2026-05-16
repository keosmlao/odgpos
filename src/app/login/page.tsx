"use client";
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Lock, AlertCircle, Loader2, ShoppingBag, ArrowRight } from 'lucide-react';
import { loginAction } from '@/app/_actions/auth';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginAction(username, password);
      if (result.ok) {
        if (rememberMe) localStorage.setItem('pos_remember_user', username);
        else localStorage.removeItem('pos_remember_user');
        localStorage.setItem('pos_user', JSON.stringify(result.user));
        router.push('/pos');
      } else {
        setError(result.error === 'Invalid credentials'
          ? 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ'
          : result.error);
      }
    } catch (err) {
      setError(err.message || 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const rememberedUser = localStorage.getItem('pos_remember_user');
    if (rememberedUser) {
      setUsername(rememberedUser);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2E6AB3] via-[#2E6AB3]/95 to-[#2E6AB3]/90 flex items-center justify-center p-6 relative overflow-hidden font-['Noto_Sans_Lao']">

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl animate-pulse"
             style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl animate-pulse"
             style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Logo Section - Redesigned */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl shadow-black/20 mb-4 animate-in zoom-in duration-500">
            <ShoppingBag size={32} className="text-[#2E6AB3]" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white tracking-tight"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
              ODIEN
            </h1>
            <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
              <p className="text-xs text-white font-bold uppercase tracking-wider">Point of Sale</p>
            </div>
          </div>
        </div>

        {/* Login Card - Redesigned */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border-2 border-white/50 p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-500 delay-150">

          {/* Header */}
          <div className="text-center pb-3 border-b border-slate-100">
            <h2 className="text-2xl font-black text-[#2E6AB3]">ເຂົ້າສູ່ລະບົບ</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">ປ້ອນຂໍ້ມູນເພື່ອເຂົ້າໃຊ້ງານລະບົບ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Error - Redesigned */}
            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl animate-in fade-in slide-in-from-top-2">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-xs text-rose-700 font-bold">{error}</p>
              </div>
            )}

            {/* Username - Redesigned */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-[#2E6AB3] tracking-wider">ຊື່ຜູ້ໃຊ້</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#2E6AB3]/10 rounded-xl flex items-center justify-center group-focus-within:bg-[#2E6AB3]/20 transition-colors">
                  <User className="text-[#2E6AB3]" size={18} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 pl-14 pr-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-[#2E6AB3] focus:ring-2 focus:ring-[#2E6AB3]/20 focus:bg-white transition-all outline-none text-slate-900 font-medium text-sm"
                  placeholder="ປ້ອນຊື່ຜູ້ໃຊ້"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {/* Password - Redesigned */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase text-[#2E6AB3] tracking-wider">ລະຫັດຜ່ານ</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#2E6AB3]/10 rounded-xl flex items-center justify-center group-focus-within:bg-[#2E6AB3]/20 transition-colors">
                  <Lock className="text-[#2E6AB3]" size={18} strokeWidth={2.5} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-14 pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-[#2E6AB3] focus:ring-2 focus:ring-[#2E6AB3]/20 focus:bg-white transition-all outline-none text-slate-900 font-medium text-sm"
                  placeholder="ປ້ອນລະຫັດຜ່ານ"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#2E6AB3] hover:bg-[#2E6AB3]/10 rounded-lg transition-all"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                </button>
              </div>
            </div>

            {/* Remember Me - Redesigned */}
            <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-slate-300 text-[#2E6AB3] focus:ring-2 focus:ring-[#2E6AB3]/30 cursor-pointer"
                disabled={loading}
              />
              <span className="text-xs text-slate-700 font-bold group-hover:text-[#2E6AB3] transition-colors">ຈື່ຂ້ອຍໄວ້</span>
            </label>

            {/* Submit - Redesigned */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="relative w-full h-12 bg-gradient-to-r from-[#2E6AB3] to-[#2E6AB3] hover:from-[#2E6AB3]/90 hover:to-[#2E6AB3]/90 text-white font-black text-base rounded-xl shadow-lg shadow-[#2E6AB3]/30 hover:shadow-xl hover:shadow-[#2E6AB3]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 overflow-hidden group active:scale-98"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
                  <span>ກຳລັງເຂົ້າສູ່ລະບົບ...</span>
                </>
              ) : (
                <>
                  <span>ເຂົ້າສູ່ລະບົບ</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Footer - Redesigned */}
          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-bold">©2026 ODIEN POS</p>
          </div>
        </div>

        {/* Additional Footer Badge */}
        <div className="mt-4 text-center">
          <div className="inline-block px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
            <p className="text-[10px] text-white/80 font-bold">Secure Login</p>
          </div>
        </div>
      </div>
    </div>
  );
}
