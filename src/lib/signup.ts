import { validateSignupChoice } from "./language-package";
import type { TargetLanguageCode } from "./languages";

export interface SignupInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  wantsPackage: boolean;
  language: string | null;
  acceptPrivacy: boolean;
  /** Nur bei Paket: Zustimmung, dass die Leistung vor Ablauf der Widerrufsfrist beginnt. */
  acceptPackageTerms: boolean;
}

export interface SignupValid {
  name: string;
  email: string;
  phone: string | null;
  password: string;
  language: TargetLanguageCode | null;
}

export type FieldErrors = Partial<Record<keyof SignupInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSignupForm(form: FormData): SignupInput {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  return {
    name: s("name"),
    email: s("email").toLowerCase(),
    phone: s("phone"),
    password: String(form.get("password") ?? ""),
    wantsPackage: form.get("wantsPackage") === "yes",
    language: s("language") || null,
    acceptPrivacy: form.get("acceptPrivacy") === "on",
    acceptPackageTerms: form.get("acceptPackageTerms") === "on",
  };
}

export function validateSignup(input: SignupInput): { ok: true; value: SignupValid } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (input.name.length < 2) errors.name = "Bitte gib deinen Namen ein.";
  if (!EMAIL_RE.test(input.email)) errors.email = "Bitte gib eine gültige E-Mail-Adresse ein.";
  if (input.password.length < 10) errors.password = "Das Passwort braucht mindestens 10 Zeichen.";
  if (!input.acceptPrivacy) errors.acceptPrivacy = "Bitte bestätige die Datenschutzhinweise.";

  const choice = validateSignupChoice({ wantsPackage: input.wantsPackage, language: input.language });
  if (!choice.ok) errors.language = choice.error;
  if (input.wantsPackage && !input.acceptPackageTerms) {
    errors.acceptPackageTerms = "Bitte bestätige die Bedingungen für das Sprachpaket.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      password: input.password,
      language: choice.ok && choice.value ? choice.value.language : null,
    },
  };
}
