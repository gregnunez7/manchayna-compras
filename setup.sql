-- Ejecutar una sola vez, DESPUÉS de las tablas y políticas creadas anteriormente.
-- Este proyecto comparte una sola lista entre los usuarios autorizados.
INSERT INTO public.shopping_sessions(id,status)
VALUES ('00000000-0000-4000-8000-000000000001','finished')
ON CONFLICT (id) DO NOTHING;

-- Los productos pendientes siempre pertenecen a la sesión compartida.
CREATE UNIQUE INDEX IF NOT EXISTS shopping_items_one_product_per_session
ON public.shopping_items(session_id,product_id);

-- Añadir productos con suma de cantidades de forma atómica.
CREATE OR REPLACE FUNCTION public.add_shopping_product(p_name text,p_quantity numeric)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_product uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 IF length(trim(p_name))<1 OR length(trim(p_name))>150 OR p_quantity<=0 OR p_quantity>100000 THEN RAISE EXCEPTION 'Producto o cantidad inválidos'; END IF;
 INSERT INTO public.products(name) VALUES(trim(p_name)) ON CONFLICT DO NOTHING;
 SELECT id INTO v_product FROM public.products WHERE lower(name)=lower(trim(p_name));
 INSERT INTO public.shopping_items(session_id,product_id,quantity,purchased_quantity)
 VALUES('00000000-0000-4000-8000-000000000001',v_product,p_quantity,0)
 ON CONFLICT (session_id,product_id) DO UPDATE
 SET quantity=shopping_items.quantity+EXCLUDED.quantity;
END;$$;

-- Inicio y fin atómicos: las cantidades compradas desaparecen y el resto permanece.
CREATE OR REPLACE FUNCTION public.set_purchase_status(p_finish boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_status text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
 SELECT status INTO v_status FROM public.shopping_sessions
 WHERE id='00000000-0000-4000-8000-000000000001' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Falta sesión compartida'; END IF;
 IF p_finish THEN
   IF v_status<>'active' THEN RAISE EXCEPTION 'La compra ya está finalizada'; END IF;
   DELETE FROM public.shopping_items WHERE session_id='00000000-0000-4000-8000-000000000001' AND purchased_quantity>=quantity;
   UPDATE public.shopping_items SET quantity=quantity-purchased_quantity,purchased_quantity=0
   WHERE session_id='00000000-0000-4000-8000-000000000001' AND purchased_quantity>0;
   UPDATE public.shopping_sessions SET status='finished',finished_at=now()
   WHERE id='00000000-0000-4000-8000-000000000001';
 ELSE
   IF v_status='active' THEN RAISE EXCEPTION 'La compra ya está iniciada'; END IF;
   UPDATE public.shopping_sessions SET status='active',started_at=now(),finished_at=NULL
   WHERE id='00000000-0000-4000-8000-000000000001';
 END IF;
END;$$;

REVOKE ALL ON FUNCTION public.add_shopping_product(text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_shopping_product(text,numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.set_purchase_status(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_purchase_status(boolean) TO authenticated;
