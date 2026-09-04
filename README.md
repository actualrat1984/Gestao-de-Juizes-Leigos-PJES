# Gestão de Juízes Leigos — PJES

Aplicativo institucional em Google Apps Script para acompanhar solicitações, disponibilidade e capacidade de juízes leigos. A aplicação lê a planilha de respostas do formulário, mantém dados de gestão em abas auxiliares e registra todas as alterações administrativas.

## Funcionalidades

- Autenticação pela sessão Google Workspace e lista privada de contas autorizadas.
- Perfis `CONSULTA`, `GESTOR` e `ADMIN`.
- Indicadores e alertas de solicitações atrasadas, antigas ou sem juiz.
- Busca, filtros avançados, ordenação e exportação CSV.
- Tela completa de detalhes e histórico de alterações.
- Prioridade (`Normal`, `Alta`, `Urgente`) e prazo por solicitação.
- Designação e redesignação de juiz com confirmação.
- Cálculo de carga, saldo e percentual de ocupação dos juízes.
- Justificativa obrigatória para exceder capacidade, concluir ou cancelar.
- Notificações institucionais por e-mail, configuráveis.
- Administração de usuários dentro do site.
- Auditoria de designações, atualizações e alterações de usuários.
- Tutorial e visita guiada no primeiro acesso.

## Arquitetura e segurança

O Web App deve ser implantado por uma conta Google Workspace do TJES para **executar como o proprietário**, com acesso restrito ao domínio. O sistema identifica a conta por `Session.getActiveUser()`, valida o domínio e aplica uma segunda camada de autorização.

As respostas originais do formulário permanecem na aba `Respostas ao formulário 1`. Informações adicionais são mantidas em:

- `USUARIOS`: perfis, situação e último acesso.
- `AUDITORIA`: alterações com usuário, data, valores anteriores e novos.
- `GESTAO_SOLICITACOES`: prioridade, prazo e última atualização.

Contas definidas em `ALLOWED_EMAILS` ou `ADMIN_EMAILS` são acessos fixos de recuperação e não podem ser desativadas pela interface.

## Propriedades do script

Em **Configurações do projeto → Propriedades do script**, configure:

| Propriedade | Finalidade | Exemplo |
|---|---|---|
| `SPREADSHEET_ID` | ID da planilha de respostas | ID encontrado na URL da planilha |
| `ALLOWED_EMAILS` | Contas fixas autorizadas, separadas por vírgula | `usuario1@dominio,usuario2@dominio` |
| `ADMIN_EMAILS` | Administradores fixos, separados por vírgula | `administrador@dominio` |
| `INSTITUTIONAL_DOMAIN` | Domínio institucional permitido | `tjes.jus.br` |
| `SEND_NOTIFICATIONS` | Envia e-mails em designações e mudanças de status | `TRUE` ou `FALSE` |

Não publique os valores reais dessas propriedades no GitHub.

## Instalação e atualização

O arquivo `.clasp.json` local deve apontar para o projeto correto:

```json
{
  "scriptId": "ID_DO_PROJETO_APPS_SCRIPT",
  "rootDir": "src"
}
```

Atualize o projeto:

```bash
git pull
clasp push
```

No editor do Apps Script:

1. Configure primeiro `ALLOWED_EMAILS` e `ADMIN_EMAILS` nas propriedades do script.
2. No menu de funções do editor, execute `instalarEstruturasAuxiliares()` e autorize as permissões solicitadas.
3. Execute `verificarConfiguracao()` e confirme a mensagem de sucesso.
3. Acesse **Implantar → Gerenciar implantações → Editar**.
4. Escolha **Nova versão** e clique em **Implantar**.
5. Use a URL terminada em `/exec`.

Configuração da implantação:

- **Executar como:** proprietário do projeto.
- **Quem tem acesso:** usuários do domínio TJES.

Após esta atualização, uma nova autorização será solicitada porque o aplicativo pode usar `MailApp` para notificações. Para manter os e-mails desativados, configure `SEND_NOTIFICATIONS` como `FALSE`; a autorização do escopo ainda pode aparecer devido ao manifesto.

## Perfis

| Perfil | Permissões |
|---|---|
| `CONSULTA` | Visualiza somente solicitações vinculadas ao próprio e-mail |
| `GESTOR` | Visualiza todas as solicitações, designa juízes e atualiza andamento |
| `ADMIN` | Possui as permissões de gestão e administra usuários |

## Fluxo recomendado

1. Localize uma solicitação e abra os detalhes.
2. Defina prioridade e prazo.
3. Consulte a capacidade dos juízes.
4. Faça a designação; o status muda para `Em atendimento`.
5. Registre o andamento nas observações.
6. Marque como `Concluído` ou `Cancelado` com uma justificativa.
7. Consulte o histórico para verificar todas as alterações.

## Observações

- A capacidade é calculada usando a quantidade de minutas das solicitações ativas designadas pelo nome do juiz.
- Valores de capacidade e quantidade precisam conter um número para o cálculo automático.
- Designações acima da capacidade continuam possíveis, mas exigem confirmação e justificativa.
- Notificações são enviadas apenas para endereços do domínio institucional.
- O sistema espera os 17 cabeçalhos originais da planilha fornecida.
- Links permanecem no navegador; nenhuma chave do AppSheet é usada ou exposta.
- Antes da produção, realize um piloto com dados não sensíveis e submeta o sistema à TI/Segurança da Informação do TJES.
