"use client";

import { createContext, useContext, useEffect, useId, useSyncExternalStore } from "react";
import type { DemoMode } from "@/lib/demo/demo-modes";
import { getUiMessages, type UiMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/config";
import type { WorkspaceFeatureFlags } from "@/lib/workspace-ops";

export type WorkspaceLayoutDensity = "comfortable" | "compact";
export type WorkspaceGuidanceMode = "guided" | "focused";

type WorkspaceUiContextValue = {
  locale: UiLocale;
  messages: UiMessages;
  pilotMode: boolean;
  captureConsentRequired: boolean;
  dataRetentionDays: number;
  featureFlags: WorkspaceFeatureFlags;
  demoMode: DemoMode | null;
  canAccessTenantHealth: boolean;
  isHelmReserved: boolean;
  layoutDensity: WorkspaceLayoutDensity;
  guidanceMode: WorkspaceGuidanceMode;
  formAssistEnabled: boolean;
  reducedMotion: boolean;
  setLayoutDensity: (value: WorkspaceLayoutDensity) => void;
  setGuidanceMode: (value: WorkspaceGuidanceMode) => void;
  setFormAssistEnabled: (value: boolean) => void;
};

const WorkspaceUiContext = createContext<WorkspaceUiContextValue | null>(null);
const WORKSPACE_LAYOUT_DENSITY_KEY = "helm-workspace-layout-density";
const WORKSPACE_GUIDANCE_MODE_KEY = "helm-workspace-guidance-mode";
const WORKSPACE_FORM_ASSIST_KEY = "helm-workspace-form-assist";
const WORKSPACE_PREFERENCES_EVENT = "helm-workspace-preferences-change";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DEFAULT_WORKSPACE_LAYOUT_DENSITY: WorkspaceLayoutDensity = "comfortable";
const DEFAULT_WORKSPACE_GUIDANCE_MODE: WorkspaceGuidanceMode = "guided";
const DEFAULT_WORKSPACE_FORM_ASSIST_ENABLED = true;
const DEFAULT_REDUCED_MOTION = false;

function readStoredValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function getInitialWorkspaceLayoutDensity(): WorkspaceLayoutDensity {
  const storedLayoutDensity = readStoredValue(WORKSPACE_LAYOUT_DENSITY_KEY);
  return storedLayoutDensity === "compact" ? "compact" : "comfortable";
}

function getInitialWorkspaceGuidanceMode(): WorkspaceGuidanceMode {
  const storedGuidanceMode = readStoredValue(WORKSPACE_GUIDANCE_MODE_KEY);
  return storedGuidanceMode === "focused" ? "focused" : "guided";
}

function getInitialFormAssistEnabled() {
  return readStoredValue(WORKSPACE_FORM_ASSIST_KEY) !== "disabled";
}

function getInitialReducedMotionPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribeWorkspacePreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.storageArea !== window.localStorage ||
      !event.key ||
      ![
        WORKSPACE_LAYOUT_DENSITY_KEY,
        WORKSPACE_GUIDANCE_MODE_KEY,
        WORKSPACE_FORM_ASSIST_KEY,
      ].includes(event.key)
    ) {
      return;
    }

    onStoreChange();
  };

  const handlePreferencesChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(WORKSPACE_PREFERENCES_EVENT, handlePreferencesChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(
      WORKSPACE_PREFERENCES_EVENT,
      handlePreferencesChange,
    );
  };
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const handleMotionChange = () => {
    onStoreChange();
  };

  mediaQuery.addEventListener("change", handleMotionChange);
  return () => {
    mediaQuery.removeEventListener("change", handleMotionChange);
  };
}

function getServerWorkspaceLayoutDensitySnapshot() {
  return DEFAULT_WORKSPACE_LAYOUT_DENSITY;
}

function getServerWorkspaceGuidanceModeSnapshot() {
  return DEFAULT_WORKSPACE_GUIDANCE_MODE;
}

function getServerWorkspaceFormAssistSnapshot() {
  return DEFAULT_WORKSPACE_FORM_ASSIST_ENABLED;
}

function getServerReducedMotionSnapshot() {
  return DEFAULT_REDUCED_MOTION;
}

function writeWorkspacePreference(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
  window.dispatchEvent(new Event(WORKSPACE_PREFERENCES_EVENT));
}

type WorkspaceUiProviderProps = {
  locale: UiLocale;
  pilotMode: boolean;
  captureConsentRequired: boolean;
  dataRetentionDays: number;
  featureFlags: WorkspaceFeatureFlags;
  demoMode: DemoMode | null;
  canAccessTenantHealth?: boolean;
  isHelmReserved?: boolean;
  children: React.ReactNode;
};

export function WorkspaceUiProvider({
  locale,
  pilotMode,
  captureConsentRequired,
  dataRetentionDays,
  featureFlags,
  demoMode,
  canAccessTenantHealth = false,
  isHelmReserved = false,
  children,
}: WorkspaceUiProviderProps) {
  const providerInstanceId = useId();
  const layoutDensity = useSyncExternalStore(
    subscribeWorkspacePreferences,
    getInitialWorkspaceLayoutDensity,
    getServerWorkspaceLayoutDensitySnapshot,
  );
  const guidanceMode = useSyncExternalStore(
    subscribeWorkspacePreferences,
    getInitialWorkspaceGuidanceMode,
    getServerWorkspaceGuidanceModeSnapshot,
  );
  const formAssistEnabled = useSyncExternalStore(
    subscribeWorkspacePreferences,
    getInitialFormAssistEnabled,
    getServerWorkspaceFormAssistSnapshot,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getInitialReducedMotionPreference,
    getServerReducedMotionSnapshot,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.dataset.workspaceUiOwner = providerInstanceId;
    root.dataset.workspaceDensity = layoutDensity;
    root.dataset.workspaceGuidance = guidanceMode;
    root.dataset.workspaceFormAssist = formAssistEnabled
      ? "enabled"
      : "disabled";
    root.dataset.workspaceMotion = reducedMotion ? "reduced" : "standard";

  }, [formAssistEnabled, guidanceMode, layoutDensity, providerInstanceId, reducedMotion]);

  useEffect(() => {
    return () => {
      const root = document.documentElement;
      if (root.dataset.workspaceUiOwner !== providerInstanceId) {
        return;
      }
      delete root.dataset.workspaceUiOwner;
      delete root.dataset.workspaceDensity;
      delete root.dataset.workspaceGuidance;
      delete root.dataset.workspaceFormAssist;
      delete root.dataset.workspaceMotion;
    };
  }, [providerInstanceId]);

  return (
    <WorkspaceUiContext.Provider
      value={{
        locale,
        messages: getUiMessages(locale),
        pilotMode,
        captureConsentRequired,
        dataRetentionDays,
        featureFlags,
        demoMode,
        canAccessTenantHealth,
        isHelmReserved,
        layoutDensity,
        guidanceMode,
        formAssistEnabled,
        reducedMotion,
        setLayoutDensity: (value) =>
          writeWorkspacePreference(WORKSPACE_LAYOUT_DENSITY_KEY, value),
        setGuidanceMode: (value) =>
          writeWorkspacePreference(WORKSPACE_GUIDANCE_MODE_KEY, value),
        setFormAssistEnabled: (value) =>
          writeWorkspacePreference(
            WORKSPACE_FORM_ASSIST_KEY,
            value ? "enabled" : "disabled",
          ),
      }}
    >
      {children}
    </WorkspaceUiContext.Provider>
  );
}

export function useWorkspaceUi() {
  const context = useContext(WorkspaceUiContext);
  if (!context) {
    throw new Error("useWorkspaceUi must be used within WorkspaceUiProvider");
  }
  return context;
}
