"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
import { UserLevelProgress } from "@/components/user-level-badge";

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"profile" | "security" | "ai">("profile");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [aiApiKey, setAiApiKey] = useState("");
  const [aiApiUrl, setAiApiUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((data) => {
        setName(data.name || "");
        setUsername(data.username || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
        setLocation(data.location || "");
        setAvatar(data.avatar || null);
      });

    fetch("/api/user/ai-settings")
      .then((res) => res.json())
      .then((data) => {
        setAiApiKey(data.aiApiKey || "");
        setAiApiUrl(data.aiApiUrl || "");
        setAiModel(data.aiModel || "");
      });
  }, [status]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, bio, website, location }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("保存成功");
      update({ name: data.name });
    } else {
      setMessage(data.error || "保存失败");
    }
    setSaving(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/user/avatar", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      setAvatar(data.avatar);
      update({});
    } else {
      setMessage(data.error || "上传失败");
    }
  };

  const changePassword = async () => {
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的密码不一致");
      return;
    }
    const res = await fetch("/api/user/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("密码修改成功");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setMessage(data.error || "修改失败");
    }
  };

  if (status !== "authenticated") return null;

  const saveAiSettings = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiApiKey, aiApiUrl, aiModel }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("AI 设置保存成功");
      } else {
        setMessage(data.error || "保存失败");
      }
    } catch (e) {
      setMessage("保存失败：" + (e as Error).message);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">账号设置</h1>

      <div className="flex gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => { setTab("profile"); setMessage(""); }}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === "profile" ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
        >
          个人资料
        </button>
        <button
          onClick={() => { setTab("security"); setMessage(""); }}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === "security" ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
        >
          安全设置
        </button>
        <button
          onClick={() => { setTab("ai"); setMessage(""); }}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === "ai" ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
        >
          AI 设置
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-3 rounded-lg text-sm ${message.includes("成功") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"}`}>
          {message}
        </div>
      )}

      {tab === "profile" && (
        <div className="space-y-6">
          <UserLevelProgress />

          <div className="flex items-center gap-4">
            <UserAvatar name={name} avatar={avatar} size="xl" />
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                更换头像
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">支持 JPG/PNG/GIF/WebP，最大 2MB</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">昵称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="用于个人主页链接" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">字母、数字、下划线和连字符，2-20个字符</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">个人简介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder="介绍一下自己..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">网站</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">所在地</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" placeholder="城市" />
            </div>
          </div>

          <button onClick={saveProfile} disabled={saving} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">当前密码</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">新密码</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">确认新密码</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500" />
          </div>
          <button onClick={changePassword} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            修改密码
          </button>
        </div>
      )}

      {tab === "ai" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              配置 AI 服务后，可以使用 Prompt 对话生成、提示词优化、文章 AI 问答等功能。
              支持 OpenAI 兼容 API。
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              API URL 需要完整路径，例如：https://api.openai.com/v1/chat/completions
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-16 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {showApiKey ? "隐藏" : "显示"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API URL</label>
            <input
              value={aiApiUrl}
              onChange={(e) => setAiApiUrl(e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions（需要完整路径）"
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">模型</label>
            <input
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="gpt-3.5-turbo（留空使用默认）"
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>

          <button onClick={saveAiSettings} disabled={saving} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? "保存中..." : "保存 AI 设置"}
          </button>
        </div>
      )}
    </div>
  );
}
