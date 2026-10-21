import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Shield, Lock, Mail, User, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(username, email, password);
        if (res.success) {
          setSuccess("Conta criada com sucesso! Você já pode entrar.");
          setIsRegister(false);
        } else {
          setError(res.detail || "Erro ao registrar usuário.");
        }
      } else {
        const res = await api.login(username, password);
        if (res.success && res.user) {
          login(res.user);
          navigate("/");
        } else {
          setError(res.detail || "Credenciais inválidas.");
        }
      }
    } catch (err) {
      setError("Erro ao conectar à API: " + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "75vh",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "36px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 0 20px rgba(59, 130, 246, 0.4)",
            }}
          >
            <Shield size={26} color="#fff" />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {isRegister ? "Criar Nova Conta" : "Acessar Sistema"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "4px" }}>
            {isRegister
              ? "Cadastre-se para isolamento de câmeras e alertas no Neon"
              : "Entre com suas credenciais para gerenciar suas câmeras"}
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
              {isRegister ? "Nome de Usuário" : "Usuário ou E-mail"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder={isRegister ? "ex: john_doe" : "admin ou usuario@email.com"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                E-mail
              </label>
              <input
                type="email"
                placeholder="usuario@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: "8px" }}>
            {loading ? "Processando..." : isRegister ? "Cadastrar Conta" : "Entrar no Sistema"}{" "}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {isRegister ? "Já possui uma conta?" : "Ainda não tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
              setSuccess("");
            }}
            style={{
              background: "transparent",
              color: "var(--accent)",
              fontWeight: 600,
              padding: 0,
            }}
          >
            {isRegister ? "Fazer Login" : "Registrar-se"}
          </button>
        </div>
      </div>
    </div>
  );
}
