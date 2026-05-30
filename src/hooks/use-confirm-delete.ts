import { useState, useCallback } from "react";

export function useConfirmDelete(onDelete: (id: number) => void | Promise<void>) {
  const [targetId, setTargetId] = useState<number | null>(null);

  const requestDelete = useCallback((id: number) => {
    setTargetId(id);
  }, []);

  const confirm = useCallback(async () => {
    if (targetId) {
      await onDelete(targetId);
      setTargetId(null);
    }
  }, [targetId, onDelete]);

  const cancel = useCallback(() => {
    setTargetId(null);
  }, []);

  return {
    targetId,
    requestDelete,
    confirm,
    cancel,
    isPending: targetId !== null,
  };
}
