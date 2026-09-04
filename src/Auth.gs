function normalizarEmail_(valor) {
  return String(valor || "").trim().toLowerCase();
}

function hashToken_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
}

function validarIdTokenGoogle_(credential) {
  if (!credential || String(credential).length > 10000) throw new Error("Credencial Google inválida.");
  const resposta = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(credential)),
    { muteHttpExceptions: true }
  );
  if (resposta.getResponseCode() !== 200) throw new Error("Não foi possível validar a identidade Google.");
  const payload = JSON.parse(resposta.getContentText());
  const email = normalizarEmail_(payload.email);
  const dominio = dominioInstitucional_();
  const expiraEm = Number(payload.exp || 0) * 1000;
  if (String(payload.aud || "") !== clienteOAuth_()) throw new Error("Credencial destinada a outro sistema.");
  if (payload.email_verified !== "true" && payload.email_verified !== true) throw new Error("E-mail Google não verificado.");
  if (!email.endsWith("@" + dominio) || String(payload.hd || "").toLowerCase() !== dominio) {
    throw new Error("Use exclusivamente sua conta institucional @" + dominio + ".");
  }
  if (expiraEm <= Date.now()) throw new Error("A autenticação expirou. Entre novamente.");
  return { email: email, nome: String(payload.name || email.split("@")[0]).trim() };
}

function emailsAdministradores_() {
  return String(PropertiesService.getScriptProperties().getProperty(JL_CONFIG.PROPERTIES.ADMIN_EMAILS) || "")
    .split(/[;,\n]+/).map(normalizarEmail_).filter(Boolean);
}

function perfilUsuario_(identidade) {
  const email = normalizarEmail_(identidade.email);
  if (emailsAdministradores_().includes(email)) return JL_CONFIG.ROLES.ADMIN;
  const planilha = abrirPlanilha_();
  const aba = planilha.getSheetByName(JL_CONFIG.USERS_SHEET);
  if (!aba || aba.getLastRow() < 2) return JL_CONFIG.ROLES.VIEWER;
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 4).getDisplayValues();
  const registro = linhas.find(linha => {
    const ativo = String(linha[3] || "").trim().toUpperCase();
    return normalizarEmail_(linha[0]) === email && ["TRUE", "VERDADEIRO", "SIM", "1"].includes(ativo);
  });
  if (!registro) return JL_CONFIG.ROLES.VIEWER;
  const perfil = String(registro[2] || "").trim().toUpperCase();
  return perfil === JL_CONFIG.ROLES.ADMIN ? JL_CONFIG.ROLES.ADMIN
    : perfil === JL_CONFIG.ROLES.MANAGER ? JL_CONFIG.ROLES.MANAGER
    : JL_CONFIG.ROLES.VIEWER;
}

function criarSessao_(identidade) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const sessao = {
    email: normalizarEmail_(identidade.email),
    nome: identidade.nome,
    perfil: perfilUsuario_(identidade),
    emitidaEm: new Date().toISOString()
  };
  CacheService.getScriptCache().put("sessao:" + hashToken_(token), JSON.stringify(sessao), JL_CONFIG.SESSION_SECONDS);
  return { token: token, usuario: sessao, expiresIn: JL_CONFIG.SESSION_SECONDS };
}

function exigirSessao_(token, perfisPermitidos) {
  const chave = "sessao:" + hashToken_(String(token || ""));
  const bruto = token ? CacheService.getScriptCache().get(chave) : null;
  if (!bruto) throw new Error("Sessão ausente ou expirada. Entre novamente.");
  const sessao = JSON.parse(bruto);
  if (!normalizarEmail_(sessao.email).endsWith("@" + dominioInstitucional_())) throw new Error("Sessão inválida.");
  if (perfisPermitidos && !perfisPermitidos.includes(sessao.perfil)) throw new Error("Seu perfil não autoriza esta operação.");
  return sessao;
}

function podeGerenciar_(usuario) {
  return usuario.perfil === JL_CONFIG.ROLES.MANAGER || usuario.perfil === JL_CONFIG.ROLES.ADMIN;
}
