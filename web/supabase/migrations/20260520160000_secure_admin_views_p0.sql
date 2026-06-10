-- P0-1 FIX SECURITY : verrouiller les vues admin
-- Audit 2026-05-20 : vues v_admin_* lisibles par TOUS les users authentifiés
-- via PostgREST. Solution : revoke + security_invoker + RPC admin-only.

revoke select on v_admin_signups        from authenticated;
revoke select on v_admin_signups_stats  from authenticated;
revoke select on v_admin_patrons        from authenticated;
revoke select on v_admin_employes       from authenticated;
revoke select on v_admin_admins         from authenticated;
revoke select on v_admin_role_stats     from authenticated;

-- En complément : security_invoker sur les vues (Postgres 15+)
-- pour qu'elles respectent les RLS des tables sous-jacentes en cas de fuite.
alter view v_admin_signups        set (security_invoker = on);
alter view v_admin_signups_stats  set (security_invoker = on);
alter view v_admin_patrons        set (security_invoker = on);
alter view v_admin_employes       set (security_invoker = on);
alter view v_admin_admins         set (security_invoker = on);
alter view v_admin_role_stats     set (security_invoker = on);

-- Pour les requêtes côté API : on switche les pages admin sur supabaseAdmin()
-- (service_role) côté serveur. Aucun browser n'a accès direct désormais.

-- Idem pour les tables sous-jacentes : signup_events + email_test_log
-- avaient déjà RLS active + policy admin_dep only, mais on ajoute une
-- defensive layer : revoke select default to authenticated.
revoke select on signup_events from authenticated;
revoke select on email_test_log from authenticated;
-- Les policies RLS définies plus tôt permettent toujours l'accès via
-- supabaseAdmin() (service_role bypass RLS) et via la fonction is_admin_dep()
-- pour les admins authentifiés (qui font la requête depuis Server Components).
