import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, Check, X } from "lucide-react";
import { api } from "../api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const navigate = useNavigate();

  // Requisitos de senha
  const hasMinLen = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!hasMinLen) {
      setError("A senha deve possuir pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    // Se username não foi preenchido explicitamente, extrai do e-mail ou do nome
    const cleanUsername = username.trim() || email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");

    setLoading(true);
    try {
      const res = await api.register(cleanUsername, email.trim(), password);
      if (res && res.success) {
        setSuccess("Conta criada com sucesso! Redirecionando para login...");
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else {
        setError(res?.detail || "Falha ao criar conta.");
      }
    } catch (err) {
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fade-in"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-main)",
        padding: "24px 16px",
      }}
    >
      <div
        className="card-panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--primary-red)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={20} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em" }}>
              CamSecurity
            </span>
          </div>

          <div style={{ marginTop: "4px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text-main)" }}>
              Crie sua conta
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Já tem uma conta?{" "}
              <Link to="/login" style={{ color: "var(--primary-red)", textDecoration: "none" }}>
                Faça login.
              </Link>
            </p>
          </div>
        </div>

        {/* Feedback visual */}
        {error && (
          <div
            style={{
              backgroundColor: "rgba(240, 68, 82, 0.12)",
              border: "1px solid rgba(240, 68, 82, 0.25)",
              color: "var(--danger-red)",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              backgroundColor: "rgba(39, 201, 133, 0.12)",
              border: "1px solid rgba(39, 201, 133, 0.25)",
              color: "var(--success-green)",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              htmlFor="reg-name"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Nome completo
            </label>
            <input
              id="reg-name"
              type="text"
              placeholder="Ex: Carlos Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label
              htmlFor="reg-username"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Nome de usuário
            </label>
            <input
              id="reg-username"
              type="text"
              placeholder="Ex: carlossilva"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="reg-email"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              E-mail
            </label>
            <input
              id="reg-email"
              type="email"
              placeholder="operador@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label
              htmlFor="reg-pass"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="reg-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                style={{ paddingRight: "40px" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "4px",
                  top: "2px",
                  height: "36px",
                  width: "36px",
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-confirm"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Confirmação de senha
            </label>
            <input
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
              required
            />
          </div>

          {/* Indicador de requisitos de senha */}
          <div
            style={{
              backgroundColor: "var(--bg-surface-elevated)",
              padding: "10px 12px",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: hasMinLen ? "var(--success-green)" : "var(--text-secondary)",
              }}
            >
              {hasMinLen ? <Check size={14} /> : <X size={14} />} Pelo menos 6 caracteres
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: hasNumber ? "var(--success-green)" : "var(--text-secondary)",
              }}
            >
              {hasNumber ? <Check size={14} /> : <X size={14} />} Pelo menos um número
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: passwordsMatch ? "var(--success-green)" : "var(--text-secondary)",
              }}
            >
              {passwordsMatch ? <Check size={14} /> : <X size={14} />} As senhas coincidem
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", marginTop: "6px" }}
          >
            {loading ? "Registrando..." : "Criar sua conta!"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: "12px", color: "#555a66" }}>
          * Contas criadas possuem perfil de operador. Privilégios administrativos são configurados via painel de sistema.
        </div>
      </div>
    </div>
  );
}
