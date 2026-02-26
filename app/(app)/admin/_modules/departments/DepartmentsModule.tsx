"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AreaRow = {
  id: string;
  name: string;
  hotel_id: string | null;
  created_at?: string | null;

  // opcionales (pueden NO existir en tu tabla)
  active?: boolean | null;
  sort_order?: number | null;
};

const HOTEL_KEY = "sc_hotel_id";
const HOTEL_CHANGED_EVENT = "sc-hotel-changed";

export default function DepartmentsModule() {
  const [activeHotelId, setActiveHotelId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<AreaRow[]>([]);

  // si tu DB no tiene estas columnas, el módulo se adapta
  const [supportsActive, setSupportsActive] = useState(false);
  const [supportsSortOrder, setSupportsSortOrder] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // modal create/edit
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AreaRow | null>(null);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // hotel activo (localStorage)
  useEffect(() => {
    const readHotel = () => {
      try {
        setActiveHotelId(localStorage.getItem(HOTEL_KEY));
      } catch {
        setActiveHotelId(null);
      }
    };

    readHotel();
    window.addEventListener(HOTEL_CHANGED_EVENT, readHotel);
    window.addEventListener("storage", readHotel);

    return () => {
      window.removeEventListener(HOTEL_CHANGED_EVENT, readHotel);
      window.removeEventListener("storage", readHotel);
    };
  }, []);

  async function load() {
    setError("");
    setMessage("");

    if (!activeHotelId) {
      setItems([]);
      setLoading(false);
      setError("No hay hotel seleccionado. Selecciona un hotel primero.");
      return;
    }

    setLoading(true);

    try {
      // 1) Intento completo (active + sort_order)
      {
        const { data, error: err } = await supabase
          .from("areas")
          .select("id, name, hotel_id, created_at, active, sort_order")
          .eq("hotel_id", activeHotelId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (!err) {
          setSupportsActive(true);
          setSupportsSortOrder(true);
          setItems((data ?? []) as any);
          return;
        }

        // Si falló por columnas inexistentes, seguimos con fallbacks.
        // Si falló por RLS/permisos, lo veremos también aquí.
        console.warn("[DepartmentsModule] full select failed:", err.message);
      }

      // 2) Fallback: sin sort_order
      {
        const { data, error: err } = await supabase
          .from("areas")
          .select("id, name, hotel_id, created_at, active")
          .eq("hotel_id", activeHotelId)
          .order("name", { ascending: true });

        if (!err) {
          setSupportsActive(true);
          setSupportsSortOrder(false);
          setItems((data ?? []) as any);
          return;
        }

        console.warn("[DepartmentsModule] select without sort_order failed:", err.message);
      }

      // 3) Fallback mínimo: sin active ni sort_order
      {
        const { data, error: err } = await supabase
          .from("areas")
          .select("id, name, hotel_id, created_at")
          .eq("hotel_id", activeHotelId)
          .order("name", { ascending: true });

        if (err) {
          console.error("[DepartmentsModule] minimal select failed:", err.message);
          throw err;
        }

        setSupportsActive(false);
        setSupportsSortOrder(false);
        setItems((data ?? []) as any);
      }
    } catch (e: any) {
      console.error("[DepartmentsModule] load() error:", e);
      setError(e?.message || "Error cargando departamentos (areas).");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotelId]);

  const filtered = useMemo(() => {
    let list = [...items];
    const needle = q.trim().toLowerCase();

    if (needle) {
      list = list.filter((d) => {
        const nm = (d.name ?? "").toLowerCase();
        const id = (d.id ?? "").toLowerCase();
        return nm.includes(needle) || id.includes(needle);
      });
    }

    if (supportsActive && statusFilter !== "all") {
      list =
        statusFilter === "active"
          ? list.filter((d) => (d.active ?? true) === true)
          : list.filter((d) => (d.active ?? true) === false);
    }

    return list;
  }, [items, q, statusFilter, supportsActive]);

  function openCreate() {
    setError("");
    setMessage("");
    setEditing(null);
    setName("");
    setSortOrder("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(row: AreaRow) {
    setError("");
    setMessage("");
    setEditing(row);
    setName(row.name ?? "");
    setSortOrder(row.sort_order === null || row.sort_order === undefined ? "" : String(row.sort_order));
    setActive((row.active ?? true) === true);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!activeHotelId) return setError("No hay hotel seleccionado.");

    const n = name.trim();
    if (!n) return setError("El nombre es obligatorio.");

    let so: number | null = null;
    if (supportsSortOrder) {
      so = sortOrder.trim() === "" ? null : Number(sortOrder);
      if (so !== null && Number.isNaN(so)) return setError("Orden debe ser un número o vacío.");
    }

    setSaving(true);
    try {
      if (editing) {
        const patch: any = { name: n };
        if (supportsSortOrder) patch.sort_order = so;
        if (supportsActive) patch.active = active;

        const { error: err } = await supabase
          .from("areas")
          .update(patch)
          .eq("id", editing.id)
          .eq("hotel_id", activeHotelId);

        if (err) throw err;
        setMessage("Departamento actualizado.");
      } else {
        const payload: any = { name: n, hotel_id: activeHotelId };
        if (supportsSortOrder) payload.sort_order = so;
        if (supportsActive) payload.active = true;

        const { error: err } = await supabase.from("areas").insert(payload);
        if (err) throw err;

        setMessage("Departamento creado.");
      }

      setOpen(false);
      await load();
    } catch (e: any) {
      console.error("[DepartmentsModule] save error:", e);
      setError(e?.message || "Error guardando departamento.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AreaRow) {
    setError("");
    setMessage("");

    if (!supportsActive) {
      setError("Tu tabla `areas` no tiene columna `active`. Si quieres, la añadimos.");
      return;
    }
    if (!activeHotelId) return setError("No hay hotel seleccionado.");

    const next = !((row.active ?? true) === true);
    setBusyId(row.id);

    try {
      const { error: err } = await supabase
        .from("areas")
        .update({ active: next })
        .eq("id", row.id)
        .eq("hotel_id", activeHotelId);

      if (err) throw err;

      setItems((prev) => prev.map((x) => (x.id === row.id ? { ...x, active: next } : x)));
      setMessage(next ? "Departamento activado." : "Departamento desactivado.");
    } catch (e: any) {
      console.error("[DepartmentsModule] toggleActive error:", e);
      setError(e?.message || "Error actualizando estado.");
    } finally {
      setBusyId(null);
    }
  }

  async function hardDelete(row: AreaRow) {
    setError("");
    setMessage("");
    if (!activeHotelId) return setError("No hay hotel seleccionado.");

    if (!confirm(`¿Borrar "${row.name}"? Esto elimina el registro.`)) return;

    setBusyId(row.id);
    try {
      const { error: err } = await supabase
        .from("areas")
        .delete()
        .eq("id", row.id)
        .eq("hotel_id", activeHotelId);

      if (err) throw err;

      setItems((prev) => prev.filter((x) => x.id !== row.id));
      setMessage("Departamento borrado.");
    } catch (e: any) {
      console.error("[DepartmentsModule] delete error:", e);
      setError(e?.message || "Error borrando departamento.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(0,0,0,0.03)",
          border: "1px solid var(--border)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>
          Hotel:{" "}
          <span style={{ fontWeight: 900, color: "var(--text)" }}>{activeHotelId ?? "—"}</span>
        </div>

        <button
          onClick={openCreate}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "black",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          + Crear departamento
        </button>

        <button
          onClick={load}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Recargar
        </button>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o ID..."
          style={{
            flex: 1,
            minWidth: 260,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card-bg)",
          }}
        />

        {supportsActive ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              fontWeight: 900,
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        ) : (
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
            (Sin filtro activo/inactivo: `areas.active` no existe)
          </div>
        )}
      </div>

      {/* mensajes */}
      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(220,0,0,0.35)",
            background: "rgba(220,0,0,0.06)",
            color: "crimson",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(0,200,0,0.10)",
            color: "green",
            fontWeight: 900,
          }}
        >
          {message}
        </div>
      ) : null}

      {/* Listado */}
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ fontWeight: 900 }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "var(--shadow-sm)",
              padding: 18,
            }}
          >
            <div style={{ fontWeight: 900 }}>No hay departamentos</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>Crea uno o cambia filtros.</div>
          </div>
        ) : (
          filtered.map((d) => {
            const disabled = busyId === d.id;
            const isActive = supportsActive ? (d.active ?? true) === true : true;

            return (
              <div
                key={d.id}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  boxShadow: "var(--shadow-sm)",
                  padding: 16,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{d.name}</div>

                    {supportsActive ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: isActive ? "rgba(0,200,0,0.10)" : "rgba(0,0,0,0.04)",
                          color: isActive ? "green" : "var(--muted)",
                        }}
                      >
                        {isActive ? "ACTIVO" : "INACTIVO"}
                      </span>
                    ) : null}

                    {supportsSortOrder && d.sort_order !== null && d.sort_order !== undefined ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: "rgba(0,0,0,0.03)",
                        }}
                        title="Orden"
                      >
                        #{d.sort_order}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>ID: {d.id}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    disabled={disabled}
                    onClick={() => openEdit(d)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(0,0,0,0.03)",
                      fontWeight: 900,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    Editar
                  </button>

                  {supportsActive ? (
                    <button
                      disabled={disabled}
                      onClick={() => toggleActive(d)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                        fontWeight: 900,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.6 : 1,
                      }}
                    >
                      {isActive ? "Desactivar" : "Activar"}
                    </button>
                  ) : null}

                  <button
                    disabled={disabled}
                    onClick={() => hardDelete(d)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(220,0,0,0.35)",
                      background: "rgba(220,0,0,0.06)",
                      color: "crimson",
                      fontWeight: 900,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL */}
      {open ? (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--card-bg)",
              boxShadow: "var(--shadow-sm)",
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
              Admin · Departamentos (Áreas)
            </div>

            <h2 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900 }}>
              {editing ? "Editar departamento" : "Crear departamento"}
            </h2>

            <form onSubmit={save} style={{ marginTop: 14 }}>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 800, fontSize: 13 }}>Nombre</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Front Office"
                    style={{
                      width: "100%",
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--card-bg)",
                    }}
                  />
                </div>

                {supportsSortOrder ? (
                  <div>
                    <label style={{ fontWeight: 800, fontSize: 13 }}>Orden (opcional)</label>
                    <input
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      placeholder="Ej: 10"
                      style={{
                        width: "100%",
                        marginTop: 6,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--card-bg)",
                      }}
                    />
                  </div>
                ) : null}

                {editing && supportsActive ? (
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    Activo
                  </label>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setOpen(false)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(0,0,0,0.03)",
                      fontWeight: 900,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "black",
                      color: "white",
                      fontWeight: 900,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>

                {!supportsActive || !supportsSortOrder ? (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800 }}>
                    Nota: este módulo se adapta a tu esquema. Si quieres “activo” y/o “orden”, te paso el SQL para añadirlo en `areas`.
                  </div>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}