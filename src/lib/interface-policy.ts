// Pure helpers for the admin-controlled interface policy (app_settings.user_interface_policy).
export type UiKey = "workbench" | "professional";
export type LandingKey = "new" | "classic";

export interface InterfacePolicy {
  available_interfaces: UiKey[];
  default_ui: UiKey;
  landing: LandingKey;
  show_professional_link: boolean;
}

export const DEFAULT_INTERFACE_POLICY: InterfacePolicy = {
  available_interfaces: ["workbench", "professional"],
  default_ui: "workbench",
  landing: "new",
  show_professional_link: true,
};

export function normalizeInterfacePolicy(raw: unknown): InterfacePolicy {
  const v = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  let available: UiKey[] = Array.isArray(v.available_interfaces)
    ? v.available_interfaces.filter((x: unknown): x is UiKey => x === "workbench" || x === "professional")
    : v.enabled === false ? ["professional"] : [...DEFAULT_INTERFACE_POLICY.available_interfaces];
  if (available.length === 0) available = ["professional"];
  const wanted: UiKey = v.default_ui === "professional" ? "professional" : "workbench";
  const default_ui = available.includes(wanted) ? wanted : available[0];
  return {
    available_interfaces: available,
    default_ui,
    landing: v.landing === "classic" ? "classic" : "new",
    show_professional_link: v.show_professional_link !== false,
  };
}

/** Where a signed-in user lands when no explicit redirect was requested. */
export function postLoginTarget(policy: InterfacePolicy): "/workspace" | "/dashboard" {
  return policy.default_ui === "workbench" && policy.available_interfaces.includes("workbench") ? "/workspace" : "/dashboard";
}

/**
 * Merge a user-specific policy override on top of the site-wide defaults.
 * Missing override properties inherit global values; invalid values are
 * normalized by the same validator used for the global policy.
 */
export function resolveInterfacePolicy(globalRaw: unknown, userOverrideRaw?: unknown): InterfacePolicy {
  const base = normalizeInterfacePolicy(globalRaw);
  if (!userOverrideRaw || typeof userOverrideRaw !== "object" || Array.isArray(userOverrideRaw)) return base;
  const override = userOverrideRaw as Partial<InterfacePolicy>;
  return normalizeInterfacePolicy({
    ...base,
    ...(Array.isArray(override.available_interfaces) ? { available_interfaces: override.available_interfaces } : {}),
    ...(override.default_ui === "workbench" || override.default_ui === "professional" ? { default_ui: override.default_ui } : {}),
    ...(override.landing === "new" || override.landing === "classic" ? { landing: override.landing } : {}),
    ...(typeof override.show_professional_link === "boolean" ? { show_professional_link: override.show_professional_link } : {}),
  });
}
