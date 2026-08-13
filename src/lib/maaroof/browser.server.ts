import type { MaaroofSettings } from "./settings.server";

export type BrowserPath = "none" | "embedded" | "user_connector";
export type BrowserCapabilityStatus = "unavailable" | "opt_in" | "ready";

export type BrowserCapability = {
  selectedPath: BrowserPath;
  status: BrowserCapabilityStatus;
  canNavigate: boolean;
  requiresUserConfirmation: boolean;
  reason: string;
};

export type BrowserIntent = {
  url?: string;
  action: "inspect" | "search" | "navigate" | "extract";
  path: BrowserPath;
  userConfirmed: boolean;
};

/**
 * Resolve browser capability without pretending that a browser exists.
 * An embedded browser is ready only when the server adapter is explicitly
 * configured. A user connector remains opt-in until the user authorizes it.
 */
export function resolveBrowserCapability(
  path: BrowserPath | undefined,
  settings: MaaroofSettings,
  env: Record<string, string | undefined> = process.env,
): BrowserCapability {
  const selectedPath = path || "none";
  const browser = settings.browser || {
    enabled: false,
    allow_user_connector: false,
    require_user_confirmation: true,
  };

  if (selectedPath === "none") {
    return {
      selectedPath,
      status: "unavailable",
      canNavigate: false,
      requiresUserConfirmation: true,
      reason: "لم يتم اختيار مسار متصفح لهذه الجلسة.",
    };
  }

  if (!browser.enabled) {
    return {
      selectedPath,
      status: "unavailable",
      canNavigate: false,
      requiresUserConfirmation: true,
      reason: "طبقة المتصفح مغلقة من إعدادات معروف.",
    };
  }

  if (selectedPath === "embedded") {
    const endpoint = env.MAAROOF_EMBEDDED_BROWSER_ENDPOINT;
    const ready = Boolean(endpoint && endpoint.startsWith("http"));
    return {
      selectedPath,
      status: ready ? "ready" : "unavailable",
      canNavigate: ready,
      requiresUserConfirmation: browser.require_user_confirmation !== false,
      reason: ready
        ? "موصل المتصفح المدمج مهيأ، لكن كل تنقل يحتاج سياسة الجلسة والموافقة المطلوبة."
        : "لم يتم تكوين endpoint للمتصفح المدمج؛ لم يُنفذ أي تنقل.",
    };
  }

  const allowed = browser.allow_user_connector === true;
  return {
    selectedPath,
    status: allowed ? "opt_in" : "unavailable",
    canNavigate: false,
    requiresUserConfirmation: true,
    reason: allowed
      ? "مسار متصفح المستخدم اختياري وينتظر اتصالاً وموافقة صريحة من المستخدم."
      : "مسار متصفح المستخدم غير مفعّل في إعدادات معروف.",
  };
}

export function browserPromptBlock(capability: BrowserCapability): string {
  return `\n\n[BROWSER CAPABILITY]\n${JSON.stringify(capability)}\nلا تدّعِ فتح موقع أو قراءة صفحة أو استخراج دليل عبر المتصفح ما لم يعد موصل المتصفح دليلاً فعلياً في أحداث الجلسة. حالة المتصفح الحالية لا تمنح صلاحية تلقائية للتنقل أو تسجيل الدخول أو الإرسال.\n`;
}

export function assertBrowserIntent(intent: BrowserIntent, capability: BrowserCapability): void {
  if (intent.path !== capability.selectedPath) throw new Error("browser_path_mismatch");
  if (!capability.canNavigate) throw new Error("browser_adapter_unavailable");
  if (capability.requiresUserConfirmation && !intent.userConfirmed) throw new Error("browser_confirmation_required");
  if (intent.url && !/^https?:\/\//i.test(intent.url)) throw new Error("browser_url_invalid");
}
