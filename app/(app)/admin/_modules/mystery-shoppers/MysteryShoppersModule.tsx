"use client";

import { useCallback, useEffect, useState } from "react";

type Shopper = {
  id: string;
  full_name: string | null;
  email: string | null;       // contact email (real)
  login_email: string | null; // generated ms-xxx@servicecontrol.io
  active: boolean | null;
  invited_at: string | null;
  access_expires_at: string | null;
  audit_count: number;
  is_expired: boolean;
};

function v(name: string, fallback: string) {
  return `var(${name}, ${fallback})`;
}

function cardStyle() {
  return {
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.10)")}`,
    borderRadius: 14,
    padding: 20,
    background: v("--sc-card-bg", "rgba(255,255,255,0.04)"),
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function MysteryShoppersModule({ hotelId }: { hotelId: string }) {
  const [shoppers, setShoppers] = useState<Shopper[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formDays, setFormDays] = useState(7);
  const [extendDays, setExtendDays] = useState(7);

  const fetchShoppers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mystery-shoppers");
      const data = await res.json();
      if (data.ok) setShoppers(data.shoppers ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShoppers();
  }, [fetchShoppers, hotelId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/mystery-shoppers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formEmail, full_name: formName, days_active: formDays }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al crear mystery shopper.");
      } else {
        setSuccess(`Mystery shopper creado. Se ha enviado el email con credenciales a ${formEmail}.`);
        setShowForm(false);
        setFormEmail("");
        setFormName("");
        setFormDays(7);
        fetchShoppers();
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/mystery-shoppers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al eliminar mystery shopper.");
      } else {
        setSuccess("Mystery shopper eliminado correctamente.");
        setConfirmDeleteId(null);
        fetchShoppers();
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExtend(id: string) {
    setExtendingId(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/mystery-shoppers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extra_days: extendDays }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Error al extender acceso.");
      } else {
        setSuccess(`Acceso extendido hasta ${formatDate(data.access_expires_at)}.`);
        fetchShoppers();
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setExtendingId(null);
    }
  }

  const inputStyle = {
    width: "100%",
    background: v("--sc-input-bg", "rgba(255,255,255,0.06)"),
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.12)")}`,
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const btnPrimary = {
    background: v("--sc-accent", "#0f172a"),
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 38,
  };

  const btnGhost = {
    background: "transparent",
    border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.12)")}`,
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    color: "inherit",
    minHeight: 38,
  };

  return (
    <div style={cardStyle()}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Mystery Shoppers</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>Usuarios de auditoría temporal con acceso a todas las áreas.</div>
        </div>
        <button style={btnPrimary} onClick={() => { setShowForm(true); setError(null); setSuccess(null); }}>
          + Nuevo mystery shopper
        </button>
      </div>

      {/* Feedback */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.22)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#22c55e", marginBottom: 14 }}>
          {success}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ background: v("--sc-panel-bg", "rgba(255,255,255,0.03)"), border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.10)")}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Nuevo mystery shopper</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, display: "block", marginBottom: 5 }}>Email *</label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="shopper@ejemplo.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, display: "block", marginBottom: 5 }}>Nombre (opcional)</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre completo"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, display: "block", marginBottom: 5 }}>Días de acceso</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min={1}
                max={365}
                value={formDays}
                onChange={(e) => setFormDays(Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
              />
              <span style={{ fontSize: 13, opacity: 0.65 }}>días (máx. 365)</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" style={btnPrimary} disabled={creating}>
              {creating ? "Creando..." : "Crear y enviar email"}
            </button>
            <button type="button" style={btnGhost} onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.55 }}>
            Se generará una contraseña temporal y se enviará un email al mystery shopper con sus credenciales.
          </div>
        </form>
      )}

      {/* Shoppers list */}
      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.55, padding: "20px 0" }}>Cargando...</div>
      ) : shoppers.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.55, padding: "20px 0", textAlign: "center" }}>
          No hay mystery shoppers creados aún.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {shoppers.map((s) => {
            const days = daysLeft(s.access_expires_at);
            const expired = s.is_expired;
            const badgeColor = expired ? "#ef4444" : days !== null && days <= 2 ? "#f59e0b" : "#22c55e";
            const badgeBg = expired ? "rgba(239,68,68,0.12)" : days !== null && days <= 2 ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.10)";
            const badgeLabel = expired ? "Expirado" : days !== null ? `${days}d restantes` : "Activo";
            const isExtending = extendingId === s.id;

            return (
              <div key={s.id} style={{ border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.08)")}`, borderRadius: 12, padding: 16, background: v("--sc-row-bg-soft", "rgba(255,255,255,0.02)") }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{s.full_name ?? s.email}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: badgeBg, color: badgeColor }}>
                        {badgeLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 3 }}>
                      {s.email && <span title="Email de contacto">{s.email}</span>}
                      {s.login_email && (
                        <span title="Email de acceso al sistema" style={{ marginLeft: 8, opacity: 0.5, fontFamily: "monospace" }}>
                          · acceso: {s.login_email}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>Creado: {formatDate(s.invited_at)}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>Expira: {formatDate(s.access_expires_at)}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>Auditorías enviadas: <strong>{s.audit_count}</strong></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      defaultValue={7}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                      style={{ ...inputStyle, width: 58, textAlign: "center" }}
                      title="Días adicionales"
                    />
                    <button
                      style={{ ...btnGhost, fontSize: 12 }}
                      onClick={() => handleExtend(s.id)}
                      disabled={isExtending}
                      title="Extender acceso"
                    >
                      {isExtending ? "..." : "+ días"}
                    </button>
                    <a
                      href={`/mystery-shopper?shopper_id=${s.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...btnGhost, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      Ver panel ↗
                    </a>
                    {/* Menu "..." */}
                    <div style={{ position: "relative" }}>
                      <button
                        style={{ ...btnGhost, fontSize: 14, padding: "6px 10px", lineHeight: 1 }}
                        onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}
                        title="Más opciones"
                      >
                        ···
                      </button>
                      {openMenuId === s.id && (
                        <div style={{
                          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                          background: v("--sc-card-bg", "#1e293b"),
                          border: `1px solid ${v("--sc-border", "rgba(255,255,255,0.12)")}`,
                          borderRadius: 10, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                          overflow: "hidden",
                        }}>
                          {confirmDeleteId === s.id ? (
                            <div style={{ padding: "12px 14px" }}>
                              <div style={{ fontSize: 12, marginBottom: 10, opacity: 0.8 }}>¿Eliminar a <strong>{s.full_name ?? s.email}</strong>?</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  style={{ ...btnPrimary, background: "#ef4444", fontSize: 12, padding: "6px 12px", flex: 1 }}
                                  onClick={() => { setOpenMenuId(null); handleDelete(s.id); }}
                                  disabled={deletingId === s.id}
                                >
                                  {deletingId === s.id ? "Eliminando..." : "Sí, eliminar"}
                                </button>
                                <button
                                  style={{ ...btnGhost, fontSize: 12, padding: "6px 10px" }}
                                  onClick={() => { setConfirmDeleteId(null); setOpenMenuId(null); }}
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "10px 14px", fontSize: 13, color: "#ef4444", cursor: "pointer" }}
                              onClick={() => setConfirmDeleteId(s.id)}
                            >
                              Eliminar shopper
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}