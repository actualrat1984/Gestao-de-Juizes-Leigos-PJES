# Gestão de Juízes Leigos — PJES

MVP em Google Apps Script que substitui a camada de interface do AppSheet sem desativar, contornar ou enfraquecer a segurança do AppSheet. O sistema lê e atualiza diretamente a planilha de respostas, exige login Google institucional e mantém auditoria das alterações.

## Funcionalidades

- Login com Google Identity Services restrito ao domínio institucional.
- Visão do próprio solicitante para usuários comuns.
- Visão geral para gestores e administradores.
- Fila de solicitações, filtros e indicadores.
- Lista de juízes leigos disponíveis.
- Designação de juiz, status e data da designação.
- Atualização de status e observações.
- Registro de auditoria com usuário, data, ação, valores anteriores e novos.
- Nenhuma chave do AppSheet é usada ou exposta no navegador.

## Arquitetura de segurança

O Web App deve ser implantado para **executar como o proprietário**. A tela pública não recebe nenhum dado. O usuário entra com a conta institucional pelo Google Identity Services; o backend valida o ID token diretamente no Google, confere `aud`, `email_verified`, `exp` e o domínio hospedado (`hd`), e só então cria uma sessão temporária. Toda função que lê ou altera dados exige essa sessão; operações de escrita exigem perfil `GESTOR` ou `ADMIN`.

Essa arquitetura evita compartilhar a planilha com todos os usuários e não depende do login/licenciamento do AppSheet.

## Configuração

1. Crie um projeto autônomo no Google Apps Script e envie o conteúdo de `src/` (recomendado: `clasp`).
2. No projeto do Google Cloud associado, crie um **OAuth Client ID — Web application**.
3. Cadastre como origens JavaScript autorizadas `https://script.google.com` e `https://script.googleusercontent.com`.
4. Em **Configurações do projeto > Propriedades do script**, crie:

   - `SPREADSHEET_ID`: ID da planilha de respostas.
   - `GOOGLE_OAUTH_CLIENT_ID`: Client ID web terminado em `.apps.googleusercontent.com`.
   - `ADMIN_EMAILS`: e-mails institucionais administradores, separados por vírgula.
   - `INSTITUTIONAL_DOMAIN`: `tjes.jus.br`.

5. No editor do Apps Script, execute `instalarEstruturasAuxiliares_()` uma vez e autorize o script. O sufixo `_` impede chamada pelo navegador.
6. Execute `verificarConfiguracao_()` e confirme a mensagem de sucesso.
7. Implante como **Aplicativo da Web**, executando como o proprietário. O nível de acesso à URL pode ser amplo porque nenhum dado é retornado sem um token institucional válido; ainda assim, use a opção mais restrita que permita aos servidores do domínio abrir a página.

## Perfis

Os e-mails em `ADMIN_EMAILS` recebem perfil `ADMIN`. A aba `USUARIOS` permite cadastrar outros acessos:

| EMAIL | NOME | PERFIL | ATIVO |
|---|---|---|---|
| servidor@tjes.jus.br | Nome do servidor | GESTOR | TRUE |

Perfis aceitos: `CONSULTA`, `GESTOR` e `ADMIN`.

## Observações importantes

- O projeto espera os 17 cabeçalhos presentes na planilha fornecida, com os textos originais.
- A aba-fonte é `Respostas ao formulário 1`.
- Não publique IDs, chaves de API, client secrets ou credenciais no GitHub.
- Revogue qualquer chave do AppSheet ou token que tenha sido enviado por mensagem.
- Antes de produção, submeta o sistema à TI/Segurança da Informação do TJES e realize um piloto com dados não sensíveis.

## Implantação com clasp

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Gestão de Juízes Leigos — PJES" --rootDir src
clasp push
```

O projeto não usa a API do AppSheet. Isso é intencional: a API é adequada para integrações servidor-a-servidor, não para remover autenticação ou licenciamento de usuários finais.
