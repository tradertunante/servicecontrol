"use client";

import { useState } from "react";

import {
  getAccessToken,
  getErrorMessage,
} from "./useAuditSession.lib";
import type {
  AuditRunRow,
  MetadataResponse,
} from "./useAuditSession.types";

export function useAuditMetadata({
  run,
  submitted,
  showRoomNumberField,
  selectedMember,
  setSelectedMember,
  roomNumber,
  setRoomNumber,
  setError,
  setRun,
}: {
  run: AuditRunRow | null;
  submitted: boolean;
  showRoomNumberField: boolean;
  selectedMember: string;
  setSelectedMember: React.Dispatch<React.SetStateAction<string>>;
  roomNumber: string;
  setRoomNumber: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setRun: React.Dispatch<React.SetStateAction<AuditRunRow | null>>;
}) {
  const [savingMember, setSavingMember] = useState(false);
  const [savingRoomNumber, setSavingRoomNumber] = useState(false);

  async function saveTeamMember(nextId: string) {
    if (!run || submitted) return;

    const prevMember = selectedMember;
    setSavingMember(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/audits/${run.id}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ team_member_id: nextId || null }),
      });

      const payload = (await response.json().catch(() => null)) as MetadataResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "No se pudo asignar el colaborador.");
      }

      const confirmedId = payload.run?.team_member_id ?? null;
      setSelectedMember(confirmedId ?? "");
      setRun((prev) =>
        prev ? { ...prev, team_member_id: confirmedId } : prev,
      );
    } catch (memberError: unknown) {
      setSelectedMember(prevMember); // restaurar
      setError(getErrorMessage(memberError, "No se pudo asignar el colaborador."));
    } finally {
      setSavingMember(false);
    }
  }

  async function saveRoomNumber(nextValue: string) {
    if (!run || submitted || !showRoomNumberField) return;

    const prevRoomNumber = roomNumber; // capturar previo
    const trimmedValue = nextValue.trim();
    setSavingRoomNumber(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/audits/${run.id}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ room_number: trimmedValue || null }),
      });

      const payload = (await response.json().catch(() => null)) as MetadataResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "No se pudo guardar el numero de habitacion.");
      }

      const confirmedRoom = payload.run?.room_number ?? null;
      setRoomNumber(confirmedRoom ?? "");
      setRun((prev) => (prev ? { ...prev, room_number: confirmedRoom } : prev));
    } catch (roomError: unknown) {
      setRoomNumber(prevRoomNumber); // rollback
      setError(getErrorMessage(roomError, "No se pudo guardar el numero de habitacion."));
    } finally {
      setSavingRoomNumber(false);
    }
  }

  return { saveTeamMember, saveRoomNumber, savingMember, savingRoomNumber };
}
