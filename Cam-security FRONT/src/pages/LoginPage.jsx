import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Shield, User } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { AuthToast, Field, TacticalPanel, delay } from "../components/AuthShell";

const STORAGE_KEY = "camsec_user";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLogged, setKeepLogged] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (type, message) => setToast({ type, message });

  const persistUser = (user) => {
    const [keep, drop] = keepLogged ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    keep.setItem(STORAGE_KEY, JSON.stringify(user));
    drop.removeItem(STORAGE_KEY);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast(null);

    const username = identifier.trim();
    if (!username) return notify("error", "Informe seu usuário ou e-mail para continuar.");
    if (!password) return notify("error", "Informe sua senha de acesso.");

    setLoading(true);
    try {
      const res = await api.login(username, password);
      if (!res?.success || !res.user) {
        return notify("error", res?.detail || "Credenciais inválidas. Verifique seu usuário e senha.");
      }
      login(res.user);
      persistUser(res.user);
      notify("success", "Credenciais validadas. Redirecionando para o painel...");
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      const message = err.message || "";
      const isNetworkError = /fetch|network/i.test(message);
      notify(
        "error",
        isNetworkError
          ? "Não foi possível alcançar o servidor. Verifique sua conexão e tente novamente."
          : message || "Erro de conexão com o servidor."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#090A0F]">
      <AuthToast toast={toast} onDismiss={() => setToast(null)} />
      <TacticalPanel />

      <main className="relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 40% at 70% 20%, rgba(225,29,72,0.05), transparent 60%)" }}
        />

        <div className="login-scale-in relative z-10 my-auto w-full max-w-[420px]">
          <div className="login-fade-up mb-8 flex items-center gap-3 lg:hidden" style={delay(0.05)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E11D48] shadow-[0_0_24px_-6px_rgba(225,29,72,0.6)]">
              <Shield size={19} color="#FFFFFF" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-100">CamSecurity</span>
          </div>

          <header className="login-fade-up" style={delay(0.12)}>
            <p className="login-eyebrow mb-3 text-[11px] font-semibold uppercase text-rose-500/90">Acesso restrito</p>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-100">Bem-vindo de volta</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
              Autentique-se para acessar o centro de operações e o monitoramento em tempo real.
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="login-fade-up mt-8 flex flex-col gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:p-8"
            style={delay(0.2)}
          >
            <Field id="login-email" label="Usuário ou E-mail" icon={User}>
              <input
                id="login-email"
                type="text"
                placeholder="operador@empresa.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                autoComplete="username"
                className="login-input"
              />
            </Field>

            <Field
              id="login-password"
              label="Senha"
              icon={Lock}
              aside={
                <button
                  type="button"
                  onClick={() => notify("info", "Para recuperar a senha, contate o administrador do sistema.")}
                  className="text-[12px] font-medium text-slate-500 transition-colors hover:text-rose-400"
                >
                  Esqueceu a senha?
                </button>
              }
            >
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="login-input login-input-pwd"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </Field>

            <label className="group flex w-fit cursor-pointer select-none items-center gap-2.5">
              <input
                type="checkbox"
                checked={keepLogged}
                onChange={(e) => setKeepLogged(e.target.checked)}
                className="peer sr-only"
              />
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-slate-700 bg-[#0D0E12] transition-colors group-hover:border-slate-600 peer-checked:border-rose-500 peer-checked:bg-rose-500 peer-focus-visible:ring-2 peer-focus-visible:ring-rose-500/40">
                {keepLogged && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 5.5l2.5 2.5 4.5-5" />
                  </svg>
                )}
              </span>
              <span className="text-[12.5px] text-slate-400 transition-colors group-hover:text-slate-300">
                Manter sessão ativa
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="login-btn login-btn-shimmer flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[#E11D48] text-[14px] font-semibold text-white shadow-[0_6px_24px_-8px_rgba(225,29,72,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="login-fade-up mt-8 border-t border-white/[0.06] pt-6 text-center text-[13px] text-slate-500" style={delay(0.3)}>
            Não possui acesso?{" "}
            <Link to="/register" className="font-semibold text-rose-400 transition-colors hover:text-rose-300">
              Criar sua conta
            </Link>
          </p>

          <p className="login-fade-up mt-6 text-center text-[11px] text-slate-600" style={delay(0.36)}>
            Acesso restrito a pessoal autorizado. Todas as tentativas são registradas.
          </p>
        </div>
      </main>
    </div>
  );
}
