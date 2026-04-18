-- Reference data: US states (+ DC).
CREATE TABLE states (
    id BIGSERIAL PRIMARY KEY,
    code CHAR(2) NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE
);

-- Reference data: cities. Seeded with the 8 franchise cities now; grows later.
CREATE TABLE cities (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    state_id BIGINT NOT NULL REFERENCES states(id),
    UNIQUE (name, state_id)
);

-- Reference data: the fictional franchise brands.
CREATE TABLE franchises (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    city_id BIGINT NOT NULL REFERENCES cities(id),
    primary_color CHAR(7) NOT NULL,
    secondary_color CHAR(7) NOT NULL,
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

-- A user's league (save file).
CREATE TABLE leagues (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_subject TEXT NOT NULL,
    phase TEXT NOT NULL,
    team_count INTEGER NOT NULL,
    season_games INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- League name unique per owner (case-insensitive).
CREATE UNIQUE INDEX leagues_owner_name_unique
    ON leagues (owner_subject, lower(name));

-- A team is a franchise instantiated inside a league. NULL owner_subject == CPU.
CREATE TABLE teams (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    franchise_id BIGINT NOT NULL REFERENCES franchises(id),
    owner_subject TEXT,
    UNIQUE (league_id, franchise_id)
);

CREATE INDEX teams_league_owner_idx ON teams (league_id, owner_subject);

-- Seed states (50 + DC).
INSERT INTO states (code, name) VALUES
    ('AL', 'Alabama'),        ('AK', 'Alaska'),         ('AZ', 'Arizona'),
    ('AR', 'Arkansas'),       ('CA', 'California'),     ('CO', 'Colorado'),
    ('CT', 'Connecticut'),    ('DE', 'Delaware'),       ('DC', 'District of Columbia'),
    ('FL', 'Florida'),        ('GA', 'Georgia'),        ('HI', 'Hawaii'),
    ('ID', 'Idaho'),          ('IL', 'Illinois'),       ('IN', 'Indiana'),
    ('IA', 'Iowa'),           ('KS', 'Kansas'),         ('KY', 'Kentucky'),
    ('LA', 'Louisiana'),      ('ME', 'Maine'),          ('MD', 'Maryland'),
    ('MA', 'Massachusetts'),  ('MI', 'Michigan'),       ('MN', 'Minnesota'),
    ('MS', 'Mississippi'),    ('MO', 'Missouri'),       ('MT', 'Montana'),
    ('NE', 'Nebraska'),       ('NV', 'Nevada'),         ('NH', 'New Hampshire'),
    ('NJ', 'New Jersey'),     ('NM', 'New Mexico'),     ('NY', 'New York'),
    ('NC', 'North Carolina'), ('ND', 'North Dakota'),   ('OH', 'Ohio'),
    ('OK', 'Oklahoma'),       ('OR', 'Oregon'),         ('PA', 'Pennsylvania'),
    ('RI', 'Rhode Island'),   ('SC', 'South Carolina'), ('SD', 'South Dakota'),
    ('TN', 'Tennessee'),      ('TX', 'Texas'),          ('UT', 'Utah'),
    ('VT', 'Vermont'),        ('VA', 'Virginia'),       ('WA', 'Washington'),
    ('WV', 'West Virginia'),  ('WI', 'Wisconsin'),      ('WY', 'Wyoming');

-- Seed the 8 franchise cities.
INSERT INTO cities (name, state_id) VALUES
    ('Boston',      (SELECT id FROM states WHERE code = 'MA')),
    ('New York',    (SELECT id FROM states WHERE code = 'NY')),
    ('Atlanta',     (SELECT id FROM states WHERE code = 'GA')),
    ('Miami',       (SELECT id FROM states WHERE code = 'FL')),
    ('Chicago',     (SELECT id FROM states WHERE code = 'IL')),
    ('Dallas',      (SELECT id FROM states WHERE code = 'TX')),
    ('Denver',      (SELECT id FROM states WHERE code = 'CO')),
    ('Los Angeles', (SELECT id FROM states WHERE code = 'CA'));

-- Seed the 8 fictional franchises. Colors inspired by NFL palettes that avoid
-- mimicking the real team(s) in each city.
INSERT INTO franchises (name, city_id, primary_color, secondary_color) VALUES
    ('Minutemen',  (SELECT id FROM cities WHERE name = 'Boston'),      '#004C54', '#A5ACAF'),
    ('Sentinels',  (SELECT id FROM cities WHERE name = 'New York'),    '#241773', '#9E7C0C'),
    ('Peaches',    (SELECT id FROM cities WHERE name = 'Atlanta'),     '#0076B6', '#B0B7BC'),
    ('Tidal',      (SELECT id FROM cities WHERE name = 'Miami'),       '#002244', '#69BE28'),
    ('Ironworks',  (SELECT id FROM cities WHERE name = 'Chicago'),     '#A5ACAF', '#000000'),
    ('Drovers',    (SELECT id FROM cities WHERE name = 'Dallas'),      '#AA0000', '#B3995D'),
    ('Summit',     (SELECT id FROM cities WHERE name = 'Denver'),      '#203731', '#FFB612'),
    ('Stars',      (SELECT id FROM cities WHERE name = 'Los Angeles'), '#FB4F14', '#000000');
