-- 035_worker_services.sql
-- Adds support for assigning specific services to workers

CREATE TABLE IF NOT EXISTS public.worker_services (
    worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, service_id)
);

-- Enable RLS
ALTER TABLE public.worker_services ENABLE ROW LEVEL SECURITY;

-- Allow salon owners to manage their worker's services
CREATE POLICY "Salon owners can manage worker services"
ON public.worker_services
FOR ALL
USING (
  worker_id IN (
    SELECT id FROM public.workers WHERE salon_id IN (
      SELECT id FROM public.salons WHERE owner_id = auth.uid()
    )
  )
);

-- Allow public to read worker services (so customers can see who does what)
CREATE POLICY "Public can view worker services"
ON public.worker_services
FOR SELECT
USING (true);
