

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 657240)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4009 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 657385)
-- Name: admin_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_activity_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id uuid,
    action character varying(50) NOT NULL,
    target_type character varying(50),
    target_id uuid,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_activity_logs OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 657452)
-- Name: affiliate_referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_referrals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    affiliate_id uuid,
    store_id uuid,
    commission_amount numeric(10,2) DEFAULT 0,
    commission_status character varying(50) DEFAULT 'pending'::character varying,
    payment_status character varying(50) DEFAULT 'unpaid'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.affiliate_referrals OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 657435)
-- Name: affiliates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    referral_code character varying(20) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    total_earnings numeric(10,2) DEFAULT 0,
    total_withdrawn numeric(10,2) DEFAULT 0,
    available_balance numeric(10,2) DEFAULT 0,
    joined_date timestamp with time zone DEFAULT now()
);


ALTER TABLE public.affiliates OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 657497)
-- Name: admin_affiliate_overview; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.admin_affiliate_overview AS
 SELECT a.id AS affiliate_id,
    a.name AS affiliate_name,
    a.email,
    a.referral_code,
    a.status,
    a.joined_date,
    ( SELECT count(*) AS count
           FROM public.affiliate_referrals ar
          WHERE (ar.affiliate_id = a.id)) AS total_referrals,
    a.total_earnings,
    a.total_withdrawn,
    a.available_balance
   FROM public.affiliates a;


ALTER VIEW public.admin_affiliate_overview OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 657180)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    name character varying(255) NOT NULL,
    phone character varying(20),
    office character varying(255),
    lat numeric(10,8),
    lng numeric(11,8),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 657195)
-- Name: logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    customer_id uuid,
    drink_type character varying(50) NOT NULL,
    quantity integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    product_type character varying(50),
    count integer DEFAULT 1,
    "timestamp" bigint,
    price_at_time numeric(10,2)
);


ALTER TABLE public.logs OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 657213)
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    customer_id uuid,
    amount numeric(10,2) NOT NULL,
    payment_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    month_str character varying(20),
    status character varying(50),
    receipt_url text,
    paid_at bigint
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- TOC entry 216 (class 1259 OID 657135)
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    store_name character varying(255) NOT NULL,
    currency_symbol character varying(10) DEFAULT '₹'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_blocked boolean DEFAULT false,
    upi_id character varying(255)
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 657419)
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    store_id uuid,
    plan_type character varying(50) DEFAULT 'free'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    start_date timestamp with time zone DEFAULT now(),
    end_date timestamp with time zone,
    payment_gateway character varying(50),
    payment_id character varying(255),
    amount numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- TOC entry 215 (class 1259 OID 657124)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255),
    picture text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    google_id character varying(255),
    email_verified boolean DEFAULT false,
    verification_token character varying(255),
    last_login_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 657492)
-- Name: admin_shop_overview; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.admin_shop_overview AS
 SELECT s.id AS store_id,
    s.store_name,
    u.name AS owner_name,
    u.email,
    s.created_at AS signup_date,
    COALESCE(sub.plan_type, 'free'::character varying) AS plan,
    COALESCE(sub.status, 'none'::character varying) AS subscription_status,
    s.is_blocked,
    a.name AS affiliate_name,
    a.referral_code AS affiliate_code,
    ( SELECT count(*) AS count
           FROM public.customers c
          WHERE (c.store_id = s.id)) AS total_customers,
    ( SELECT count(*) AS count
           FROM public.logs l
          WHERE (l.store_id = s.id)) AS total_cups,
    ( SELECT COALESCE(sum(p.amount), (0)::numeric) AS "coalesce"
           FROM public.payments p
          WHERE (p.store_id = s.id)) AS total_revenue
   FROM ((((public.stores s
     JOIN public.users u ON ((s.user_id = u.id)))
     LEFT JOIN public.subscriptions sub ON (((sub.store_id = s.id) AND ((sub.status)::text = 'active'::text))))
     LEFT JOIN public.affiliate_referrals ar ON ((ar.store_id = s.id)))
     LEFT JOIN public.affiliates a ON ((ar.affiliate_id = a.id)));


ALTER VIEW public.admin_shop_overview OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 657372)
-- Name: admin_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    is_active boolean DEFAULT true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_users OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 657472)
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    affiliate_id uuid,
    user_id uuid,
    amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    payout_method character varying(50),
    payout_details jsonb,
    payout_reference character varying(255),
    payout_note text,
    rejected_reason text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.affiliate_payouts OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 657165)
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 657399)
-- Name: store_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_blocks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    store_id uuid,
    blocked_by uuid,
    reason text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    unblocked_at timestamp with time zone
);


ALTER TABLE public.store_blocks OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 657148)
-- Name: store_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    price_per_chai numeric(10,2) DEFAULT 10.00,
    price_per_coffee numeric(10,2) DEFAULT 15.00,
    shop_name character varying(255),
    enable_notifications boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    show_walk_in boolean DEFAULT true,
    products jsonb,
    sound_enabled boolean DEFAULT true
);


ALTER TABLE public.store_settings OWNER TO postgres;

--
-- TOC entry 3829 (class 2606 OID 657393)
-- Name: admin_activity_logs admin_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3825 (class 2606 OID 657384)
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- TOC entry 3827 (class 2606 OID 657382)
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- TOC entry 3843 (class 2606 OID 657481)
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- TOC entry 3841 (class 2606 OID 657461)
-- Name: affiliate_referrals affiliate_referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_pkey PRIMARY KEY (id);


--
-- TOC entry 3835 (class 2606 OID 657449)
-- Name: affiliates affiliates_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_email_key UNIQUE (email);


--
-- TOC entry 3837 (class 2606 OID 657447)
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- TOC entry 3839 (class 2606 OID 657451)
-- Name: affiliates affiliates_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_referral_code_key UNIQUE (referral_code);


--
-- TOC entry 3814 (class 2606 OID 657189)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 3819 (class 2606 OID 657202)
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3810 (class 2606 OID 657172)
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 3812 (class 2606 OID 657174)
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- TOC entry 3823 (class 2606 OID 657220)
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- TOC entry 3831 (class 2606 OID 657408)
-- Name: store_blocks store_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_blocks
    ADD CONSTRAINT store_blocks_pkey PRIMARY KEY (id);


--
-- TOC entry 3806 (class 2606 OID 657157)
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3808 (class 2606 OID 657159)
-- Name: store_settings store_settings_store_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_store_id_key UNIQUE (store_id);


--
-- TOC entry 3804 (class 2606 OID 657142)
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- TOC entry 3833 (class 2606 OID 657429)
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 3797 (class 2606 OID 657134)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3799 (class 2606 OID 665299)
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- TOC entry 3801 (class 2606 OID 657132)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3815 (class 1259 OID 657232)
-- Name: idx_customers_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_store_id ON public.customers USING btree (store_id);


--
-- TOC entry 3816 (class 1259 OID 657234)
-- Name: idx_logs_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_customer_id ON public.logs USING btree (customer_id);


--
-- TOC entry 3817 (class 1259 OID 657233)
-- Name: idx_logs_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_logs_store_id ON public.logs USING btree (store_id);


--
-- TOC entry 3820 (class 1259 OID 657236)
-- Name: idx_payments_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_customer_id ON public.payments USING btree (customer_id);


--
-- TOC entry 3821 (class 1259 OID 657235)
-- Name: idx_payments_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_store_id ON public.payments USING btree (store_id);


--
-- TOC entry 3802 (class 1259 OID 657231)
-- Name: idx_stores_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stores_user_id ON public.stores USING btree (user_id);


--
-- TOC entry 3852 (class 2606 OID 657394)
-- Name: admin_activity_logs admin_activity_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id);


--
-- TOC entry 3858 (class 2606 OID 657482)
-- Name: affiliate_payouts affiliate_payouts_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);


--
-- TOC entry 3859 (class 2606 OID 657487)
-- Name: affiliate_payouts affiliate_payouts_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.admin_users(id);


--
-- TOC entry 3856 (class 2606 OID 657462)
-- Name: affiliate_referrals affiliate_referrals_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);


--
-- TOC entry 3857 (class 2606 OID 657467)
-- Name: affiliate_referrals affiliate_referrals_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.affiliate_referrals
    ADD CONSTRAINT affiliate_referrals_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- TOC entry 3847 (class 2606 OID 657190)
-- Name: customers customers_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- TOC entry 3848 (class 2606 OID 657208)
-- Name: logs logs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 3849 (class 2606 OID 657203)
-- Name: logs logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- TOC entry 3846 (class 2606 OID 657175)
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3850 (class 2606 OID 657226)
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 3851 (class 2606 OID 657221)
-- Name: payments payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- TOC entry 3853 (class 2606 OID 657414)
-- Name: store_blocks store_blocks_blocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_blocks
    ADD CONSTRAINT store_blocks_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.admin_users(id);


--
-- TOC entry 3854 (class 2606 OID 657409)
-- Name: store_blocks store_blocks_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_blocks
    ADD CONSTRAINT store_blocks_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- TOC entry 3845 (class 2606 OID 657160)
-- Name: store_settings store_settings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- TOC entry 3844 (class 2606 OID 657143)
-- Name: stores stores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3855 (class 2606 OID 657430)
-- Name: subscriptions subscriptions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


-- Completed on 2025-12-30 17:20:33 IST

--
-- PostgreSQL database dump complete
--
