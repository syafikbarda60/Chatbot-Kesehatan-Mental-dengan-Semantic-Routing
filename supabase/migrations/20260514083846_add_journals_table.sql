CREATE TABLE public.journals (
  journal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  mood character varying CHECK (mood::text = ANY (ARRAY['Calm'::character varying, 'Anxious'::character varying, 'Focused'::character varying, 'Tired'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journals_pkey PRIMARY KEY (journal_id),
  CONSTRAINT journals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
