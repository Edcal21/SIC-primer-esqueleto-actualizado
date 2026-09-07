"use client";
import { useEffect } from "react";
import type { ModalState } from "../shared";

export default function ConfirmModal({ modal, busy, onCancel, onConfirm }: { modal: ModalState; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [busy, onCancel]);

  return <div className="modalOverlay"><section className={`modalCard ${modal.isDanger ? "danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title"><div className="modalHead"><span className="modalShield" aria-hidden="true">{modal.isDanger ? "!" : "✓"}</span><b id="confirm-modal-title">{modal.title}</b></div><div className="modalBody">{modal.message}</div><div className="modalFoot"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Procesando..." : modal.confirmLabel ?? "Confirmar"}</button></div></section></div>;
}
