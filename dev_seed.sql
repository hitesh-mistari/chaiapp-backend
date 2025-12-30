-- Dev User
INSERT INTO users (id, google_id, email, name, picture)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'dev_google_id',
    'dev@chaiapp.local',
    'Developer',
    'https://ui-avatars.com/api/?name=Developer&background=random'
) ON CONFLICT (id) DO NOTHING;

-- Dev Store
INSERT INTO stores (id, user_id, store_name, currency_symbol)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    'Dev Chai Shop',
    '₹'
) ON CONFLICT (id) DO NOTHING;

-- Dev Store Settings
INSERT INTO store_settings (store_id, shop_name)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'Dev Chai Shop'
) ON CONFLICT (store_id) DO NOTHING;
