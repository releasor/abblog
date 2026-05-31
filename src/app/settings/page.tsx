"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/fetch-api";
import { UserAvatar } from "@/components/user-avatar";
import { UserLevelProgress } from "@/components/user-level-badge";
import { Input } from "@/components/ui/input";

type SettingsTab = "profile" | "security" | "ai" | "notifications";

const TAB_LABELS: Record<SettingsTab, string> = {
  profile: "个人资料",
  security: "安全设置",
  ai: "AI 设置",
  notifications: "通知设置",
};

export default function SettingsPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<SettingsTab>("profile");
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

  const [emailNotifications, setEmailNotifications] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status !== "authenticated") return;

    async function loadSettings() {
      const [profileRes, aiRes, notifRes] = await Promise.all([
        fetchApi<{ name: string; username: string; bio: string; website: string; location: string; avatar: string | null }>("/api/user/profile", { showErrorToast: false }),
        fetchApi<{ aiApiKey: string; aiApiUrl: string; aiModel: string }>("/api/user/ai-settings", { showErrorToast: false }),
        fetchApi<{ emailNotifications: boolean }>("/api/user/notification-settings", { showErrorToast: false }),
      ]);

      if (profileRes.ok) {
        setName(profileRes.data.name || "");
        setUsername(profileRes.data.username || "");
        setBio(profileRes.data.bio || "");
        setWebsite(profileRes.data.website || "");
        setLocation(profileRes.data.location || "");
        setAvatar(profileRes.data.avatar || null);
      }
      if (aiRes.ok) {
        setAiApiKey(aiRes.data.aiApiKey || "");
        setAiApiUrl(aiRes.data.aiApiUrl || "");
        setAiModel(aiRes.data.aiModel || "");
      }
      if (notifRes.ok) {
        setEmailNotifications(notifRes.data.emailNotifications ?? true);
      }
    }
    loadSettings();
  }, [status, router]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetchApi<{ name: string }>("/api/user/profile", {
      method: "PATCH",
      body: JSON.stringify({ name, username, bio, website, location }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("保存成功");
      update({ name: res.data.name });
    } else {
      setMessage(res.error || "保存失败");
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
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
    } catch (e) {
      console.error("[Settings] Failed to upload avatar:", e);
      setMessage("上传失败，请稍后重试");
    }
  };

  const changePassword = async () => {
    setMessage("");
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的密码不一致");
      return;
    }
    const res = await fetchApi("/api/user/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      setMessage("密码修改成功");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setMessage(res.error || "修改失败");
    }
  };

  const saveNotificationSettings = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetchApi("/api/user/notification-settings", {
      method: "PATCH",
      body: JSON.stringify({ emailNotifications }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("通知设置保存成功");
    } else {
      setMessage(res.error || "保存失败");
    }
  };

  if (status !== "authenticated") return null;

  const saveAiSettings = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetchApi("/api/user/ai-settings", {
      method: "PATCH",
      body: JSON.stringify({ aiApiKey, aiApiUrl, aiModel }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("AI 设置保存成功");
    } else {
      setMessage(res.error || "保存失败");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">账号设置</h1>

      <div className="flex gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-hide" role="tablist" aria-label="设置分类">
        {(Object.keys(TAB_LABELS) as SettingsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMessage(""); }}
            role="tab"
            aria-selected={tab === t}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
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

          <Input
            id="settings-name"
            label="昵称"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <Input
              id="settings-username"
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用于个人主页链接"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">字母、数字、下划线和连字符，2-20个字符</p>
          </div>

          <div>
            <label htmlFor="settings-bio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">个人简介</label>
            <textarea id="settings-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none" placeholder="介绍一下自己..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="settings-website"
              label="网站"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
            <Input
              id="settings-location"
              label="所在地"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="城市"
            />
          </div>

          <button onClick={saveProfile} disabled={saving} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <Input
            id="settings-current-password"
            label="当前密码"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            id="settings-new-password"
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            id="settings-confirm-password"
            label="确认新密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
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
            <label htmlFor="settings-ai-key" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">API Key</label>
            <div className="relative">
              <input
                id="settings-ai-key"
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

          <Input
            id="settings-ai-url"
            label="API URL"
            value={aiApiUrl}
            onChange={(e) => setAiApiUrl(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions（需要完整路径）"
          />

          <Input
            id="settings-ai-model"
            label="模型"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="gpt-3.5-turbo（留空使用默认）"
          />

          <button onClick={saveAiSettings} disabled={saving} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? "保存中..." : "保存 AI 设置"}
          </button>
        </div>
      )}

      {tab === "notifications" && (
        <div className="space-y-6">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              管理你的邮件通知偏好。关闭后将不再收到评论回复、点赞等邮件通知。
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">邮件通知</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                接收评论回复、点赞、关注等邮件通知
              </p>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotifications ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-600"}`}
              role="switch"
              aria-checked={emailNotifications}
              aria-label="切换邮件通知"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${emailNotifications ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <button onClick={saveNotificationSettings} disabled={saving} className="w-full px-4 py-2 text-sm bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {saving ? "保存中..." : "保存通知设置"}
          </button>
        </div>
      )}
    </div>
  );
}
