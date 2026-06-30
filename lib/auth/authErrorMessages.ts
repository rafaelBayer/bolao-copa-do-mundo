function isReservedExampleEmail(email?: string) {
  if (!email) {
    return false;
  }

  const domain = email.trim().toLowerCase().split("@")[1];

  return domain === "example.com" || domain === "example.org" || domain === "example.net";
}

export function authErrorMessage(error: unknown, email?: string) {
  const rawMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const message = rawMessage.toLowerCase();

  if (message.includes("email rate limit exceeded")) {
    return "Muitas tentativas de cadastro foram feitas. Aguarde alguns minutos e tente novamente.";
  }

  if (
    isReservedExampleEmail(email) ||
    message.includes("invalid email") ||
    message.includes("email address is invalid") ||
    message.includes("unable to validate email address") ||
    message.includes("invalid format") ||
    message.includes("valid email") ||
    (message.includes("email") &&
      (message.includes("domain") ||
        message.includes("not allowed") ||
        message.includes("not permitted") ||
        message.includes("blocked") ||
        message.includes("disposable")))
  ) {
    return "Informe um e-mail válido.";
  }

  if (message.includes("already registered")) {
    return "Este e-mail já está cadastrado. Faça login para continuar.";
  }

  if (message.includes("password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (message.includes("signup requires a valid password")) {
    return "Informe uma senha válida.";
  }

  return "Não foi possível criar sua conta. Verifique os dados e tente novamente.";
}

export function inviteErrorMessage(error: unknown) {
  const rawMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const message = rawMessage.toLowerCase();

  if (message.includes("browser")) {
    return "Este navegador já usou este convite.";
  }

  if (message.includes("expired")) {
    return "Este convite expirou.";
  }

  if (message.includes("invalid invite")) {
    return "Convite inválido ou expirado.";
  }

  return "Não conseguimos vincular sua conta ao bolão. Tente novamente.";
}

export function logUnexpectedAuthError(error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
}
