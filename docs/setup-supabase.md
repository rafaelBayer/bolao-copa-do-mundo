# Setup do Supabase real

Este guia prepara o primeiro bolao owner no Supabase real sem mudar o fluxo OpenFootball, RLS ou telas da aplicacao.

## 1. Criar o projeto Supabase

1. Crie um projeto em https://supabase.com/dashboard.
2. Anote a `Project URL`, a `publishable key` e a `service_role key` em **Project Settings > API**.
3. Guarde a `service_role key` somente no ambiente local/servidor. Ela ignora RLS e nunca deve ir para o frontend.

## 2. Configurar `.env.local`

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`OPENFOOTBALL_WORLD_CUP_2026_URL` continua opcional e so e usada pelo `npm run fetch:worldcup`.

## 3. Aplicar migrations

Aplique todas as migrations em `supabase/migrations` em ordem numerica.

Opcoes:

- Pelo Dashboard: abra **SQL Editor**, cole cada arquivo e execute em ordem.
- Pela Supabase CLI, se ja estiver configurada: rode `supabase link --project-ref <project-ref>` e depois `supabase db push`.

## 4. Criar o primeiro usuario no Auth

Crie o usuario owner em **Authentication > Users > Add user**.

Para o fluxo de convite entrar direto no bolao apos o cadastro, o Supabase Auth precisa criar uma sessao logo depois do `signUp`. No ambiente de desenvolvimento, verifique em **Authentication > Providers > Email** se a confirmacao obrigatoria de e-mail esta desativada. Se o projeto exigir confirmacao, o usuario precisara confirmar o e-mail antes de concluir a entrada no bolao.

## 4.1. Configuracao obrigatoria para cadastro simples

Para o fluxo de convite funcionar direto para amigos, o Supabase precisa permitir login automatico logo apos o cadastro.

Checklist no Supabase Dashboard:

```txt
Authentication
-> Providers / Email
-> Confirm email: desativado
```

O nome exato do menu pode variar na interface atual do Supabase. Procure pela configuracao de confirmacao obrigatoria de e-mail do provider Email e deixe desativada no ambiente do bolao.

Tambem recomendamos:

- usar e-mails reais e validos nos testes;
- evitar muitos cadastros seguidos para nao bater rate limit;
- testar `/login?invite=TOKEN` para usuarios que ja tem conta.

## 5. Criar o primeiro bolao e vincular o owner

Use o script local com a `SUPABASE_SERVICE_ROLE_KEY` configurada:

```bash
npm run setup:owner-pool -- --email dono@example.com --pool-name "Bolao da Copa 2026"
```

Tambem da para usar o id do usuario:

```bash
npm run setup:owner-pool -- --user-id <auth-user-id> --pool-name "Bolao da Copa 2026"
```

Se rodar sem argumentos, o script pergunta o email/id e o nome do bolao. Ele reaproveita um pool ja existente com o mesmo `owner_id` e `name`, e garante que o registro em `pool_members` esteja com `role = owner`.

## 6. Importar dados da Copa

Depois das migrations e do owner:

```bash
npm run seed:worldcup
```

Antes de escrever no Supabase, voce pode validar localmente:

```bash
npm run validate:worldcup
npm run seed:worldcup:dry
```

## 7. Testar `/dashboard/groups`

1. Rode o app com `npm run dev`.
2. Acesse `/login`.
3. Entre com o usuario owner criado no Auth.
4. Abra `/dashboard/groups` e confira grupos, jogos e inputs de palpites.

## 8. Gerar convite

1. Com o owner logado, acesse `/dashboard/admin`.
2. Clique em **Gerar convite**.
3. Na lista de convites, copie o link gerado. O formato e `/register?invite=<token>`.

## 9. Testar cadastro por convite

1. Abra o link copiado em uma sessao anonima ou outro navegador.
2. Cadastre um novo usuario.
3. Ao concluir, o app chama `accept_pool_invite`, registra o uso do link e redireciona para `/dashboard/groups`.
4. Volte em `/dashboard/admin` com o owner e confirme que o novo participante aparece na lista.
5. Abra o mesmo link em outro navegador/perfil e confirme que outro usuario tambem consegue entrar.

O mesmo navegador e bloqueado para reutilizar o mesmo link por outro cadastro enquanto mantiver o identificador local salvo. IP hash fica para uma etapa futura server-side.

Depois da migration `0009_ensure_user_profile.sql`, o cadastro tambem chama `ensure_user_profile_for_pool` para garantir um registro em `profiles`. Se o usuario nao informar nome, a RPC gera `Visitante N` sem repetir dentro do bolao.

## 10. Problemas comuns no cadastro

- `email rate limit exceeded`: o Supabase Auth pode limitar cadastros repetidos durante QA. Aguarde alguns minutos ou use um projeto/dev separado para testes intensos.
- Use e-mails reais validos nos testes. Alguns dominios ou formatos descartaveis podem ser bloqueados pelo Supabase.
- Evite dominios invalidos como `example.com` se o Supabase recusar a validacao.
- Em QA local, tambem e possivel criar usuarios pelo Supabase Auth e depois abrir o link de convite logado.
- Para o fluxo direto do convite, a confirmacao obrigatoria de e-mail precisa estar desativada no ambiente de desenvolvimento.
- TODO futuro: trocar exclusao fisica de convites por `revoked_at`, mantendo historico de usos do link.
