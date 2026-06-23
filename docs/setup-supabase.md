# Setup do Supabase

Este guia prepara um projeto Supabase para rodar o MVP do bolao com autenticacao, Bolao Geral, boloes privados, convites e permissao de admin global separada.

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

Crie um usuario em **Authentication > Users > Add user** para validar o app.

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

## 5. Cadastrar um system admin

Depois das migrations, escolha o usuario que tera permissao administrativa global e insira o UUID real dele em `system_admins`:

```sql
insert into public.system_admins (user_id)
values ('UUID_REAL_DO_USUARIO')
on conflict (user_id) do nothing;
```

Owner de bolao privado nao e admin global. O owner gerencia apenas o proprio bolao.

## 6. Importar dados da Copa

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
3. Entre com o usuario criado no Auth.
4. Abra `/dashboard/groups` e confira grupos, jogos e inputs de palpites.

## 8. Criar bolao privado e gerar convite

1. Com o usuario logado, acesse Perfil > Boloes.
2. Crie um bolao privado.
3. Copie o link de convite exibido para o owner daquele bolao.
4. O link usa o formato `/convite/<codigo>`.

## 9. Testar cadastro por convite

1. Abra o link copiado em uma sessao anonima ou outro navegador.
2. Cadastre um novo usuario.
3. Ao concluir, o app chama `join_pool_by_invite_code`, adiciona o usuario em `pool_members` e redireciona para o dashboard.
4. Confirme que o bolao aparece em Perfil > Boloes.
5. Abra o mesmo link novamente e confirme que o membership nao duplica.

Depois da migration `0009_ensure_user_profile.sql`, o cadastro tambem chama `ensure_user_profile_for_pool` para garantir um registro em `profiles`. Se o usuario nao informar nome, a RPC gera `Visitante N` sem repetir dentro do bolao.

## 10. Problemas comuns no cadastro

- `email rate limit exceeded`: o Supabase Auth pode limitar cadastros repetidos durante QA. Aguarde alguns minutos ou use um projeto/dev separado para testes intensos.
- Use e-mails reais validos nos testes. Alguns dominios ou formatos descartaveis podem ser bloqueados pelo Supabase.
- Evite dominios invalidos como `example.com` se o Supabase recusar a validacao.
- Em QA local, tambem e possivel criar usuarios pelo Supabase Auth e depois abrir o link de convite logado.
- Para o fluxo direto do convite, a confirmacao obrigatoria de e-mail precisa estar desativada no ambiente de desenvolvimento.
