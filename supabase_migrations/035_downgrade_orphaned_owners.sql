-- Fix for orphaned salon owners
-- If a salon is rejected/deleted, the owner's role should revert to customer.
-- This handles any existing users who have the salon_owner role but no associated salon.

UPDATE public.profiles
SET role = 'customer'
WHERE role = 'salon_owner'
  AND id NOT IN (
    SELECT owner_id 
    FROM public.salons 
    WHERE owner_id IS NOT NULL
  );
