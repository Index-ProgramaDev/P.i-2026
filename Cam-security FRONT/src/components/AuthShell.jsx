import React from "react";
import { Shield, Activity, Camera, Radio, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

const STATS = [
  { icon: Camera, label: "Câmeras", value: "24/7" },
  { icon: Radio, label: "Alertas", value: "12.4k" },
  { icon: Activity, label: "Latência", value: "<180ms" },
];

const TOASTS = {
  error: {
    title: "Falha na autenticação",
    Icon: AlertTriangle,
    box: "border-rose-500/25 bg-[#14090c]/90 text-rose-200 shadow-[0_12px_40px_-12px_rgba(225,29,72,0.4)]",
    icon: "bg-rose-500/15 text-rose-400",
  },
  success: {
    title: "Sucesso",
    Icon: CheckCircle2,
    box: "border-emerald-500/25 bg-[#08130d]/90 text-emerald-200 shadow-[0_12px_40px_-12px_rgba(39,201,133,0.35)]",
    icon: "bg-emerald-500/15 text-emerald-400",
  },
  info: {
    title: "Informação",
    Icon: Info,
    box: "border-sky-500/25 bg-[#080f16]/90 text-sky-200 shadow-[0_12px_40px_-12px_rgba(56,189,248,0.3)]",
    icon: "bg-sky-500/15 text-sky-400",
  },
};

export const delay = (s) => ({ animationDelay: `${s}s` });

export function AuthToast({ toast, onDismiss }) {
  if (!toast) return null;
  const { title, Icon, box, icon } = TOASTS[toast.type] || TOASTS.info;

  return (
    <div
      role="alert"
      className={`login-toast fixed right-5 top-5 z-50 flex w-[calc(100%-2.5rem)] max-w-sm items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-xl ${box}`}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${icon}`}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 break-words text-[12px] leading-snug opacity-80">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar notificação"
        className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Field({ id, label, icon: Icon, aside, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-medium uppercase tracking-[0.08em] text-slate-500">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <Icon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        {children}
      </div>
    </div>
  );
}

export function TacticalPanel() {
  const gridLines = "rgba(148,163,184,0.05)";
  const gridMask = "radial-gradient(ellipse 90% 80% at 60% 40%, black 30%, transparent 100%)";

  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[#07080B] px-12 py-10 lg:flex lg:w-[55%] xl:w-[58%] xl:px-16">
      <div
        className="login-grid-pulse pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${gridLines} 1px, transparent 1px), linear-gradient(90deg, ${gridLines} 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
          maskImage: gridMask,
          WebkitMaskImage: gridMask,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 65% 35%, rgba(225,29,72,0.07), transparent 65%), radial-gradient(ellipse 80% 60% at 20% 90%, rgba(56,89,199,0.05), transparent 60%)",
        }}
      />

      <div className="pointer-events-none absolute -right-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-70">
        <div
          className="login-radar-sweep absolute inset-0 rounded-full"
          style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(225,29,72,0.10) 40deg, transparent 80deg)" }}
        />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-slate-700/40"
            style={{ inset: i * 64, borderColor: i === 0 ? "rgba(225,29,72,0.18)" : undefined }}
          />
        ))}
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-700/30" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-slate-700/30" />
      </div>

      <div
        className="login-scan-line pointer-events-none absolute left-0 h-24 w-full"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(225,29,72,0.05), transparent)" }}
      />

      <div className="login-fade-up relative z-10 flex items-center gap-3" style={delay(0.05)}>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10">
          <Shield size={19} className="text-rose-400" />
        </div>
        <div>
          <p className="text-[15px] font-bold tracking-tight text-slate-100">CamSecurity</p>
          <p className="login-eyebrow font-mono text-[10px] font-medium uppercase text-slate-500">Command Center</p>
        </div>
      </div>

      <div className="relative z-10 max-w-md">
        <div
          className="login-fade-up mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm"
          style={delay(0.15)}
        >
          <span className="pulse-dot online" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
            Sistemas Ativos: <span className="text-emerald-400">99.8%</span>
          </span>
        </div>

        <h2
          className="login-fade-up text-[clamp(30px,3.4vw,44px)] font-bold leading-[1.08] tracking-tight text-slate-100"
          style={delay(0.22)}
        >
          Vigilância em tempo real,{" "}
          <span className="bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent">
            sob seu controle.
          </span>
        </h2>

        <p className="login-fade-up mt-5 max-w-sm text-[14px] leading-relaxed text-slate-400" style={delay(0.3)}>
          Monitore câmeras, analise eventos e responda a incidentes em uma única plataforma operacional — com
          visibilidade total, do primeiro frame à decisão final.
        </p>

        <div className="login-fade-up mt-9 grid grid-cols-3 gap-6 border-t border-white/[0.07] pt-7" style={delay(0.38)}>
          {STATS.map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Icon size={12} />
                <span className="font-mono text-[10px] font-medium uppercase tracking-wider">{label}</span>
              </div>
              <p className="mt-1.5 text-lg font-bold text-slate-200">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="login-fade-up relative z-10 flex items-center justify-between font-mono text-[11px] text-slate-600" style={delay(0.46)}>
        <span className="login-eyebrow uppercase">SEC-OPS // v2.4</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
          Encrypted channel
        </span>
      </div>
    </aside>
  );
}
