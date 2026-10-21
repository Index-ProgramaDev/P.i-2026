import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLogged, setKeepLogged] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const key = emailOrUsername.trim();
    if (!key) {
      setError("Informe seu usuário ou e-mail.");
      return;
    }
    if (!password) {
      setError("Informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(key, password);
      if (res && res.success && res.user) {
        setSuccess("Login autenticado com sucesso!");
        login(res.user);
        if (keepLogged) {
          localStorage.setItem("camsec_user", JSON.stringify(res.user));
        } else {
          sessionStorage.setItem("camsec_user", JSON.stringify(res.user));
        }
        setTimeout(() => {
          navigate("/dashboard");
        }, 400);
      } else {
        setError(res?.detail || "Credenciais inválidas. Verifique seu usuário e senha.");
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
          maxWidth: "400px",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Logo & Header */}
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
              Faça seu login!
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
              Entre com suas credenciais para acessar a plataforma operacional.
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
              htmlFor="login-email"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              E-mail ou Usuário
            </label>
            <input
              id="login-email"
              type="text"
              placeholder="seu_usuario ou email@empresa.com"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              style={{ display: "block", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}
            >
              Senha
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
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

          {/* Opções auxiliares */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "13px",
              marginTop: "2px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={keepLogged}
                onChange={(e) => setKeepLogged(e.target.checked)}
                style={{ width: "15px", height: "15px", accentColor: "var(--primary-red)" }}
              />
              Manter sessão
            </label>

            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
              onClick={() => alert("Para recuperar a senha de operador, contate o administrador do sistema ou consulte o arquivo de configuração.")}
            >
              Esqueceu a senha?
            </span>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", marginTop: "8px" }}
          >
            {loading ? "Autenticando..." : "Continuar"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Link para criação de conta */}
        <div
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "var(--text-secondary)",
            paddingTop: "6px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          Não possui acesso?{" "}
          <Link
            to="/register"
            style={{ color: "var(--primary-red)", fontWeight: 500, textDecoration: "none" }}
          >
            Criar sua conta
          </Link>
        </div>
      </div>
    </div>
  );
}
