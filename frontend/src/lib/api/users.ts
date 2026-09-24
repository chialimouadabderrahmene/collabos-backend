import { http } from "./http";

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type DigestFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "NEVER";
export type MeasurementUnit = "METRIC" | "IMPERIAL";
export type ProfileVisibility = "PUBLIC" | "PRIVATE";

export interface UserProfile {
  id: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  roles: string[];
  createdAt: string;
}

export interface UserSettings {
  theme: ThemePreference;
  language: string;
  timezone: string;
}

export interface UserPreferences {
  digestFrequency: DigestFrequency;
  measurementUnit: MeasurementUnit;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
}

export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  allowSearchIndexing: boolean;
}

export const PROFILE_LIMITS = { firstName: 50, lastName: 50, displayName: 80, bio: 500 } as const;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const usersApi = {
  me: () => http.get<UserProfile>("users/me"),
  updateProfile: (input: Partial<Pick<UserProfile, "firstName" | "lastName" | "displayName" | "bio">>) =>
    http.patch<UserProfile>("users/me/profile", input),
  /** Multipart field name `avatar` is fixed by the backend. */
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return http.post<{ avatarUrl: string | null }>("users/me/avatar", form);
  },
  removeAvatar: () => http.delete<{ avatarUrl: string | null }>("users/me/avatar"),
  settings: () => http.get<UserSettings>("users/me/settings"),
  updateSettings: (input: Partial<UserSettings>) => http.patch<UserSettings>("users/me/settings", input),
  preferences: () => http.get<UserPreferences>("users/me/preferences"),
  updatePreferences: (input: Partial<UserPreferences>) => http.patch<UserPreferences>("users/me/preferences", input),
  notifications: () => http.get<NotificationPreferences>("users/me/notifications"),
  updateNotifications: (input: Partial<NotificationPreferences>) =>
    http.patch<NotificationPreferences>("users/me/notifications", input),
  privacy: () => http.get<PrivacySettings>("users/me/privacy"),
  updatePrivacy: (input: Partial<PrivacySettings>) => http.patch<PrivacySettings>("users/me/privacy", input),
};
