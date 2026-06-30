# Setup do Supabase

Este guia prepara um projeto Supabase para rodar o MVP do bolão com autenticação, Bolão Geral, bolões privados, convites e permissão de admin global separada.

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

`OPENFOOTBALL_WORLD_CUP_2026_URL` continua opcional e só é usada pelo `npm run fetch:worldcup`.

## 3. Aplicar migrations

Aplique todas as migrations em `supabase/migrations` em ordem numérica.

Opções:

- Pelo Dashboard: abra **SQL Editor**, cole cada arquivo e execute em ordem.
- Pela Supabase CLI, se já estiver configurada: rode `supabase link --project-ref <project-ref>` e depois `supabase db push`.

## 4. Criar o primeiro usuário no Auth

Crie um usuário em **Authentication > Users > Add user** para validar o app.

Para o fluxo de convite entrar direto no bolão após o cadastro, o Supabase Auth precisa criar uma sessão logo depois do `signUp`. No ambiente de desenvolvimento, verifique em **Authentication > Providers > Email** se a confirmação obrigatória de e-mail está desativada. Se o projeto exigir confirmação, o usuário precisará confirmar o e-mail antes de concluir a entrada no bolão.

## 4.1. Configuração obrigatória para cadastro simples

Para o fluxo de convite funcionar direto para amigos, o Supabase precisa permitir login automático logo após o cadastro.

Checklist no Supabase Dashboard:

```txt
Authentication
-> Providers / Email
-> Confirm email: desativado
```

O nome exato do menu pode variar na interface atual do Supabase. Procure pela configuração de confirmação obrigatória de e-mail do provider Email e deixe desativada no ambiente do bolão.

Também recomendamos:

- usar e-mails reais e válidos nos testes;
- evitar muitos cadastros seguidos para não bater rate limit;
- testar `/login?invite=TOKEN` para usuários que já têm conta.

## 5. Cadastrar um system admin

Depois das migrations, escolha o usuário que terá permissão administrativa global e insira o UUID real dele em `system_admins`:

```sql
insert into public.system_admins (user_id)
values ('UUID_REAL_DO_USUARIO')
on conflict (user_id) do nothing;
```

Owner de bolão privado não é admin global. O owner gerencia apenas o próprio bolão.

## 6. Importar dados da Copa

```bash
npm run seed:worldcup
```

Antes de escrever no Supabase, você pode validar localmente:

```bash
npm run validate:worldcup
npm run seed:worldcup:dry
```

## 7. Testar `/dashboard/groups`

1. Rode o app com `npm run dev`.
2. Acesse `/login`.
3. Entre com o usuário criado no Auth.
4. Abra `/dashboard/groups` e confira grupos, jogos e inputs de palpites.

## 8. Criar bolão privado e gerar convite

1. Com o usuário logado, acesse Perfil > Bolões.
2. Crie um bolão privado.
3. Copie o link de convite exibido para o owner daquele bolão.
4. O link usa o formato `/convite/<codigo>`.

## 9. Testar cadastro por convite

1. Abra o link copiado em uma sessão anônima ou outro navegador.
2. Cadastre um novo usuário.
3. Ao concluir, o app chama `join_pool_by_invite_code`, adiciona o usuário em `pool_members` e redireciona para o dashboard.
4. Confirme que o bolão aparece em Perfil > Bolões.
5. Abra o mesmo link novamente e confirme que o membership não duplica.

Depois da migration `0009_ensure_user_profile.sql`, o cadastro também chama `ensure_user_profile_for_pool` para garantir um registro em `profiles`. Se o usuário não informar nome, a RPC gera `Visitante N` sem repetir dentro do bolão.

## 10. Problemas comuns no cadastro

- `email rate limit exceeded`: o Supabase Auth pode limitar cadastros repetidos durante QA. Aguarde alguns minutos ou use um projeto/dev separado para testes intensos.
- Use e-mails reais válidos nos testes. Alguns domínios ou formatos descartáveis podem ser bloqueados pelo Supabase.
- Evite domínios inválidos como `example.com` se o Supabase recusar a validação.
- Em QA local, também é possível criar usuários pelo Supabase Auth e depois abrir o link de convite logado.
- Para o fluxo direto do convite, a confirmação obrigatória de e-mail precisa estar desativada no ambiente de desenvolvimento.
