import { useState, useCallback, useRef, useEffect } from "react";

export function useConfirmDelete(onDelete: (id: number) => void | Promise<void>) {
  const [targetId, setTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  const requestDelete = useCallback((id: number) => {
    setTargetId(id);
  }, []);

  const confirm = useCallback(async () => {
    if (targetId) {
      setIsDeleting(true);
      try {
        await onDeleteRef.current(targetId);
      } finally {
        setIsDeleting(false);
        setTargetId(null);
      }
    }
  }, [targetId]);

  const cancel = useCallback(() => {
    setTargetId(null);
  }, []);

  return {
    targetId,
    requestDelete,
    confirm,
    cancel,
    isPending: targetId !== null,
    isDeleting,
  };
}
