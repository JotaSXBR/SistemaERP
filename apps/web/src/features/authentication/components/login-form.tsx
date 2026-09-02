import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SignInError, type SignInFailureReason } from "../api/session.js";
import { useSession } from "../session-context.js";

const loginSchema = z.object({
  email: z.email("Informe um e-mail válido"),
  organizationSlug: z
    .string()
    .trim()
    .min(1, "Informe a empresa")
    .max(80, "Identificador da empresa muito longo"),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const FAILURE_MESSAGES: Record<SignInFailureReason, string> = {
  INVALID_CREDENTIALS: "E-mail, senha ou empresa não conferem.",
  RATE_LIMITED: "Tentativas demais. Aguarde alguns minutos antes de tentar novamente.",
  UNAVAILABLE: "Não foi possível falar com o servidor. Tente novamente.",
};

const FIELD_CLASSNAME =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-sm text-ink-950 transition placeholder:text-ink-500 focus:border-brand-500 aria-[invalid=true]:border-alert-600";

export function LoginForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { signIn } = useSession();
  const [failure, setFailure] = useState<SignInFailureReason | null>(null);
  const formId = useId();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", organizationSlug: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  const fieldId = (field: string) => `${formId}-${field}`;
  const errorId = (field: string) => `${formId}-${field}-error`;

  async function submit(values: LoginFormValues): Promise<void> {
    setFailure(null);

    try {
      await signIn(values);
      onAuthenticated();
    } catch (error) {
      setFailure(error instanceof SignInError ? error.reason : "UNAVAILABLE");
    }
  }

  return (
    <form
      className="mt-8 space-y-5"
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      {failure ? (
        <p
          className="rounded-xl border border-alert-600/20 bg-alert-50 px-4 py-3 text-sm text-alert-600"
          role="alert"
        >
          {FAILURE_MESSAGES[failure]}
        </p>
      ) : null}

      <div>
        <label className="text-sm font-medium text-ink-700" htmlFor={fieldId("email")}>
          E-mail
        </label>
        <input
          {...register("email")}
          aria-describedby={errors.email ? errorId("email") : undefined}
          aria-invalid={errors.email ? true : undefined}
          autoComplete="username"
          className={FIELD_CLASSNAME}
          id={fieldId("email")}
          placeholder="voce@empresa.com.br"
          type="email"
        />
        {errors.email ? (
          <p className="mt-1.5 text-xs text-alert-600" id={errorId("email")}>
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700" htmlFor={fieldId("organizationSlug")}>
          Empresa
        </label>
        <input
          {...register("organizationSlug")}
          aria-describedby={
            errors.organizationSlug ? errorId("organizationSlug") : `${formId}-organization-hint`
          }
          aria-invalid={errors.organizationSlug ? true : undefined}
          autoComplete="organization"
          className={FIELD_CLASSNAME}
          id={fieldId("organizationSlug")}
          placeholder="minha-empresa"
          type="text"
        />
        {errors.organizationSlug ? (
          <p className="mt-1.5 text-xs text-alert-600" id={errorId("organizationSlug")}>
            {errors.organizationSlug.message}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-500" id={`${formId}-organization-hint`}>
            Identificador da empresa em que você quer trabalhar nesta sessão.
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700" htmlFor={fieldId("password")}>
          Senha
        </label>
        <input
          {...register("password")}
          aria-describedby={errors.password ? errorId("password") : undefined}
          aria-invalid={errors.password ? true : undefined}
          autoComplete="current-password"
          className={FIELD_CLASSNAME}
          id={fieldId("password")}
          type="password"
        />
        {errors.password ? (
          <p className="mt-1.5 text-xs text-alert-600" id={errorId("password")}>
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        className="min-h-11 w-full rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
