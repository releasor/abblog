"use client";

import { useState, FormEvent } from "react";

interface CommentFormProps {
  postId: number;
}

export function CommentForm({ postId }: CommentFormProps) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!authorName.trim()) {
      newErrors.authorName = "Name is required";
    } else if (authorName.trim().length > 50) {
      newErrors.authorName = "Name must be 50 characters or less";
    }

    if (!authorEmail.trim()) {
      newErrors.authorEmail = "Email is required";
    }

    if (!content.trim()) {
      newErrors.content = "Comment content is required";
    } else if (content.trim().length > 1000) {
      newErrors.content = "Comment must be 1000 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSuccess(false);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim(),
          content: content.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setServerError("Please wait before submitting another comment");
        } else {
          setServerError(data.error || "Something went wrong");
        }
        return;
      }

      setSuccess(true);
      setAuthorName("");
      setAuthorEmail("");
      setContent("");
      setErrors({});
    } catch {
      setServerError("Failed to submit comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Leave a Comment
      </h3>

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-sm text-green-800 dark:text-green-300">
          Comment submitted for review
        </div>
      )}

      {serverError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-800 dark:text-red-300">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="comment-name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="comment-name"
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={50}
            className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
              errors.authorName
                ? "border-red-300 dark:border-red-700"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {errors.authorName && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.authorName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="comment-email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="comment-email"
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
              errors.authorEmail
                ? "border-red-300 dark:border-red-700"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {errors.authorEmail && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.authorEmail}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Will not be displayed publicly
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="comment-content"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Comment <span className="text-red-500">*</span>
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          className={`w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-y ${
            errors.content
              ? "border-red-300 dark:border-red-700"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        />
        {errors.content && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.content}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
          {content.length}/1000 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting..." : "Submit Comment"}
      </button>
    </form>
  );
}