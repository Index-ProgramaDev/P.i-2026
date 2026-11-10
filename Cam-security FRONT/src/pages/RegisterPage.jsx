import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AtSign,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  User,
  X,
} from "lucide-react";
import { api } from "../api";
import { AuthToast, Field, TacticalPanel, delay } from "../components/AuthShell";

function PasswordChecklist({ password, confirmPassword }) {
  const rules = [
    { label: "Mínimo de 6 caracteres", ok: password.length >= 6 },
    { label: "Pelo menos um número", ok: /\d/.test(password) },
    {
      label: "As senhas coincidem",
      ok: password.length > 0 && password === confirmPassword,
    },
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      {rules.map(({ label, ok }) => (
        <div
          key={label}
          className={`flex items-center gap-2 text-[12px] transition-colors duration-300 ${
            ok ? "text-emerald-400" : "text-slate-500"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300 ${
              ok ? "bg-emerald-500/15" : "bg-white/[0.04]"
            }`}
          >
            {ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (type, message) => setToast({ type, message });

  const hasMinLen = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!fullName.trim()) return notify("error", "Informe seu nome completo.");
    if (!hasMinLen) return notify("error", "A senha deve possuir pelo menos 6 caracteres.");
    if (!hasNumber) return notify("error", "A senha deve conter pelo menos um número.");
    if (!passwordsMatch) return notify("error", "As senhas informadas não coincidem.");

    const cleanUsername =
      username.trim() || email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");

    setLoading(true);
    try {
      const res = await api.register(cleanUsername, email.trim(), password);
      if (res && res.success) {
        notify("success", "Conta criada com sucesso! Redirecionando para o login...");
        setTimeout(() => navigate("/login"), 1400);
      } else {
        notify("error", res?.detail || "Falha ao criar conta.");
      }
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

  const eyeButton = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      tabIndex={-1}
      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#090A0F]">
      <AuthToast toast={toast} onDismiss={() => setToast(null)} />
      <TacticalPanel />

      <main className="relative flex flex-1 items-center justify-center overflow-y-auto px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 40% at 70% 20%, rgba(225,29,72,0.05), transparent 60%)" }}
        />

        <div className="login-scale-in relative z-10 my-auto w-full max-w-[440px]">
          <div className="login-fade-up mb-8 flex items-center gap-3 lg:hidden" style={delay(0.05)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E11D48] shadow-[0_0_24px_-6px_rgba(225,29,72,0.6)]">
              <Shield size={19} color="#FFFFFF" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-slate-100">CamSecurity</span>
          </div>

          <header className="login-fade-up" style={delay(0.12)}>
            <p className="login-eyebrow mb-3 text-[11px] font-semibold uppercase text-rose-500/90">
              Onboarding
            </p>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-100">Crie sua conta</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
              Já possui acesso?{" "}
              <Link to="/login" className="font-semibold text-rose-400 transition-colors hover:text-rose-300">
                Faça login
              </Link>
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="login-fade-up mt-8 flex flex-col gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] backdrop-blur-sm sm:p-8"
            style={delay(0.2)}
          >
            <Field id="reg-name" label="Nome completo" icon={User}>
              <input
                id="reg-name"
                type="text"
                placeholder="Ex: Carlos Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                autoComplete="name"
                className="login-input"
              />
            </Field>

            <Field id="reg-username" label="Nome de usuário" icon={AtSign}>
              <input
                id="reg-username"
                type="text"
                placeholder="Ex: carlossilva"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                className="login-input"
              />
            </Field>

            <Field id="reg-email" label="E-mail" icon={Mail}>
              <input
                id="reg-email"
                type="email"
                placeholder="operador@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                className="login-input"
              />
            </Field>

            <Field id="reg-pass" label="Senha" icon={Lock}>
              <input
                id="reg-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                className="login-input login-input-pwd"
              />
              {eyeButton}
            </Field>

            <Field id="reg-confirm" label="Confirmar senha" icon={Lock}>
              <input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                className="login-input login-input-pwd"
              />
              {eyeButton}
            </Field>

            {password.length > 0 && (
              <div className="login-fade-up" style={delay(0.05)}>
                <PasswordChecklist password={password} confirmPassword={confirmPassword} />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="login-btn login-btn-shimmer flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[#E11D48] text-[14px] font-semibold text-white shadow-[0_6px_24px_-8px_rgba(225,29,72,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="login-fade-up mt-8 border-t border-white/[0.06] pt-6 text-center text-[13px] text-slate-500" style={delay(0.3)}>
            Contas criadas possuem perfil de operador. Privilégios administrativos são
            configurados via painel de sistema.
          </p>
        </div>
      </main>
    </div>
  );
}
