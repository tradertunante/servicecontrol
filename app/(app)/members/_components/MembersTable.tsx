"use client";

import type { MemberRecord } from "../_lib/memberTypes";

function secondaryButtonClasses(disabled = false) {
  return [
    "border border-[#d1d5db]",
    disabled ? "bg-[#f9fafb]" : "bg-white",
    "text-[#111827]",
    "py-2 px-[10px]",
    "rounded-[10px]",
    "font-bold",
    disabled ? "cursor-not-allowed" : "cursor-pointer",
  ].join(" ");
}

export default function MembersTable({
  members,
  busyMemberId,
  onEdit,
  onDelete,
}: {
  members: MemberRecord[];
  busyMemberId: string | null;
  onEdit: (member: MemberRecord) => void;
  onDelete: (member: MemberRecord) => void;
}) {
  return (
    <div className="border border-[#e5e7eb] bg-white p-4 rounded-[12px]">
      <div className="text-[18px] font-extrabold">Miembros</div>
      <div className="mt-3 grid gap-[10px]">
        {members.length === 0 ? (
          <div className="text-[#6b7280]">No hay miembros visibles para tu alcance actual.</div>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className={[
                "border border-[#e5e7eb] rounded-[10px] p-3",
                member.active ? "bg-white" : "bg-[#f9fafb]",
              ].join(" ")}
            >
              <div className="flex justify-between gap-3 flex-wrap">
                <div className="grid gap-1">
                  <div className="font-extrabold">{member.full_name}</div>
                  <div className="text-[13px] text-[#4b5563]">
                    No. colaborador: <b>{member.employee_number || "—"}</b>
                  </div>
                  <div className="text-[13px] text-[#4b5563]">
                    Estado: <b>{member.active ? "Activo" : "Inactivo"}</b>
                  </div>
                  <div className="text-[13px] text-[#4b5563]">
                    Areas: {member.area_names.length ? member.area_names.join(", ") : "Sin areas"}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => onEdit(member)}
                    disabled={busyMemberId === member.id}
                    className={secondaryButtonClasses(busyMemberId === member.id)}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(member)}
                    disabled={busyMemberId === member.id}
                    className={secondaryButtonClasses(busyMemberId === member.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
