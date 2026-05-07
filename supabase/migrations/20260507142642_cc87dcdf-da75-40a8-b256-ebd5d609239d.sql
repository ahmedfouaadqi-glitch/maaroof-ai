-- Auto-promote specific email to admin on signup; also handle existing user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  IF lower(NEW.email) = 'ahmedfouaad.qi@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- If the super-admin email already exists, promote now
DO $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = 'ahmedfouaad.qi@gmail.com' LIMIT 1;
  IF u_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (u_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;