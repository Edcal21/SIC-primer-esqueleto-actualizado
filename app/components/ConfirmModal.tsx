"use client";
import { useEffect, useRef } from "react";
import type { ModalState } from "../shared";

export default function ConfirmModal({ modal, busy, onCancel, onConfirm }: { modal: ModalState; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
    const firstTarget = focusable()[0] ?? dialogRef.current;
    firstTarget?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
      if (event.key !== "Tab") return;
      const targets = focusable();
      if (!targets.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [busy, onCancel]);

  return <div className="modalOverlay"><section ref={dialogRef} className={`modalCard ${modal.isDanger ? "danger" : ""}`} role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" tabIndex={-1}><div className="modalHead"><span className="modalShield" aria-hidden="true">{modal.isDanger ? "!" : "✓"}</span><b id="confirm-modal-title">{modal.title}</b></div><div className="modalBody">{modal.message}</div><div className="modalFoot"><button className="secondary" type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button className="primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Procesando..." : modal.confirmLabel ?? "Confirmar"}</button></div></section></div>;
}
