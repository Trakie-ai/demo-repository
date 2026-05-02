import {
  clearAuth,
  exchangePairingCode,
  setToken,
  trakieConnectUrl,
  trakieSubscriptionUrl,
} from "./auth.js";

function show(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) return null;
  el.hidden = false;
  return el;
}

function hide(id: string): void {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

export function hideAllGates(): void {
  hide("signin-gate");
  hide("subscription-gate");
}

function hideStatusPill(): void {
  const pill = document.getElementById("status-pill");
  if (pill) pill.hidden = true;
}

export function renderSignInGate(opts: {
  onConnected: () => void;
  prefillError?: string;
}): void {
  hideAllGates();
  hide("connecting-view");
  hide("live-view");
  hideStatusPill();
  const root = show("signin-gate");
  if (!root) return;

  const openBtn = root.querySelector<HTMLButtonElement>("[data-action='open-trakie']");
  const input = root.querySelector<HTMLInputElement>("[data-role='code-input']");
  const connectBtn = root.querySelector<HTMLButtonElement>("[data-action='connect-code']");
  const errorEl = root.querySelector<HTMLElement>("[data-role='error']");

  function setError(msg: string | null) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  setError(opts.prefillError ?? null);

  if (openBtn) {
    openBtn.onclick = () => {
      chrome.tabs.create({ url: trakieConnectUrl() });
    };
  }

  if (input) {
    input.value = "";
    input.oninput = () => {
      input.value = input.value.toUpperCase();
      setError(null);
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        connectBtn?.click();
      }
    };
  }

  if (connectBtn) {
    connectBtn.onclick = async () => {
      const code = (input?.value ?? "").trim().toUpperCase();
      if (!code) {
        setError("Enter the pairing code from trakie.ai.");
        return;
      }
      connectBtn.disabled = true;
      connectBtn.textContent = "Connecting…";
      setError(null);
      const res = await exchangePairingCode(code);
      if (!res.ok) {
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect";
        setError(reasonToMessage(res.reason));
        return;
      }
      await setToken(res.token, res.email);
      opts.onConnected();
    };
  }
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case "invalid_code":
      return "We couldn't find that code. Double-check and try again.";
    case "code_already_used":
      return "That code has already been used. Generate a new one on trakie.ai.";
    case "code_expired":
      return "That code has expired. Generate a new one on trakie.ai.";
    case "missing_code":
      return "Enter the pairing code from trakie.ai.";
    case "network_error":
      return "Couldn't reach Trakie. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function renderSubscriptionGate(opts: {
  onSignOut: () => void;
}): void {
  hideAllGates();
  hide("connecting-view");
  hide("live-view");
  hideStatusPill();
  const root = show("subscription-gate");
  if (!root) return;

  const manageBtn = root.querySelector<HTMLButtonElement>("[data-action='manage-subscription']");
  const signOutBtn = root.querySelector<HTMLButtonElement>("[data-action='sign-out']");

  if (manageBtn) {
    manageBtn.onclick = () => {
      chrome.tabs.create({ url: trakieSubscriptionUrl() });
    };
  }
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await clearAuth();
      opts.onSignOut();
    };
  }
}

export function renderSignedInFooter(opts: {
  email: string | null;
  onSignOut: () => void;
}): void {
  const footer = document.getElementById("signed-in-footer");
  if (!footer) return;
  const emailEl = footer.querySelector<HTMLElement>("[data-role='email']");
  const signOutBtn = footer.querySelector<HTMLButtonElement>("[data-action='sign-out']");
  if (emailEl) emailEl.textContent = opts.email ?? "Signed in";
  if (signOutBtn) {
    signOutBtn.onclick = async () => {
      await clearAuth();
      opts.onSignOut();
    };
  }
  footer.hidden = false;
}

export function showToast(message: string): void {
  let toast = document.getElementById("toast") as HTMLElement | null;
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("toast--visible");
  window.setTimeout(() => {
    toast?.classList.remove("toast--visible");
  }, 3500);
}
