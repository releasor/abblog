"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Heart, X } from "lucide-react";
import { fetchApi } from "@/lib/fetch-api";

const AMOUNTS = [100, 500, 1000, 2000, 5000];

interface DonateButtonProps {
  recipientId: number;
  recipientName: string;
  postId?: number;
}

export const DonateButton = memo(function DonateButton({ recipientId, recipientName, postId }: DonateButtonProps) {
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState(500);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const closeModal = useCallback(() => {
    setShow(false);
    setDone(false);
    setMessage("");
  }, []);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, closeModal]);

  const handleDonate = async () => {
    setLoading(true);
    const result = await fetchApi("/api/donations", {
      method: "POST",
      body: JSON.stringify({ recipientId, postId, amount, message }),
      errorMessage: "赞赏失败，请稍后重试",
    });
    setLoading(false);
    if (result.ok) {
      setDone(true);
      timerRef.current = setTimeout(closeModal, 2000);
    }
  };

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 rounded-lg transition-colors"
      >
        <Heart className="w-4 h-4" />
        <span>赞赏</span>
      </button>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`赞赏 ${recipientName}`}>
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-80">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-zinc-600"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>

            {done ? (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-pink-500 mx-auto mb-3 fill-current" />
                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">赞赏成功！</p>
                <p className="text-sm text-zinc-500 mt-1">感谢您的支持</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">
                  赞赏 {recipientName}
                </h3>
                <p className="text-sm text-zinc-500 mb-4">用实际行动支持创作者</p>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                  {AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAmount(a)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        amount === a
                          ? "bg-pink-500 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      ¥{a / 100}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="留个言吧 (可选)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 mb-4 resize-none"
                />

                <button
                  onClick={handleDonate}
                  disabled={loading}
                  className="w-full py-2.5 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? "处理中..." : `赞赏 ¥${(amount / 100).toFixed(0)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
});
