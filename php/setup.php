<?php
/**
 * setup.php
 * Run this script ONCE to initialise the SQLite database and seed planet data.
 * Usage: php setup.php  OR  visit http://localhost:8000/php/setup.php
 */

$dbPath = __DIR__ . '/../data/planets.db';

// Create data directory if missing
if (!is_dir(__DIR__ . '/../data')) {
    mkdir(__DIR__ . '/../data', 0755, true);
}

try {
    $db = new SQLite3($dbPath);

    // ── Schema ────────────────────────────────────────────────────────────────
    $db->exec("
        CREATE TABLE IF NOT EXISTS planets (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL UNIQUE,
            type            TEXT    NOT NULL,
            radius_km       REAL    NOT NULL,
            distance_au     REAL    NOT NULL,
            orbital_period  REAL    NOT NULL,
            rotation_hours  REAL    NOT NULL,
            color_hex       TEXT    NOT NULL,
            atmosphere      INTEGER NOT NULL DEFAULT 0,
            atmosphere_color TEXT,
            num_moons       INTEGER NOT NULL DEFAULT 0,
            has_rings       INTEGER NOT NULL DEFAULT 0,
            tilt_deg        REAL    NOT NULL DEFAULT 0,
            description     TEXT    NOT NULL,
            fun_fact        TEXT    NOT NULL,
            surface_temp_c  INTEGER NOT NULL DEFAULT 0
        );
    ");

    // Add surface_temp_c to existing databases that predate this column
    // PRAGMA table_info is idempotent — safe to call on every setup run
    $hasTempCol = false;
    $colInfo = $db->query("PRAGMA table_info(planets)");
    while ($col = $colInfo->fetchArray(SQLITE3_ASSOC)) {
        if ($col['name'] === 'surface_temp_c') { $hasTempCol = true; break; }
    }
    if (!$hasTempCol) {
        $db->exec("ALTER TABLE planets ADD COLUMN surface_temp_c INTEGER NOT NULL DEFAULT 0");
    }

    // ── Seed data ─────────────────────────────────────────────────────────────
    // surface_temp_c: mean surface (or cloud-top for gas/ice giants)
    $planets = [
        //  name        type           km      AU     orb_days  rot_hrs
        //  hex         atmo  atmo_col  moons rings  tilt   description  fun_fact  temp_c
        [
            'Sun', 'Star', 696340, 0, 0, 609.12,
            '#FDB813', 0, null, 0, 0, 7.25,
            'The Sun is the star at the centre of our Solar System. It is a nearly perfect sphere of hot plasma, generating energy via nuclear fusion of hydrogen into helium at its core.',
            'The Sun accounts for 99.86% of the total mass of the Solar System.',
            5500
        ],
        [
            'Mercury', 'Terrestrial', 2439.7, 0.39, 87.97, 1407.6,
            '#B5B5B5', 0, null, 0, 0, 0.034,
            'Mercury is the smallest planet and the closest to the Sun. Its surface is heavily cratered, resembling our Moon, and it has no atmosphere to retain heat.',
            'A day on Mercury lasts longer than its year — 176 Earth days vs 88 Earth days for its orbit.',
            167
        ],
        [
            'Venus', 'Terrestrial', 6051.8, 0.72, 224.7, -5832,
            '#E8C56C', 1, '#E8D5A0', 0, 0, 177.4,
            'Venus is the hottest planet in the Solar System, with surface temperatures reaching 465 °C. Its thick atmosphere of CO₂ creates an extreme greenhouse effect.',
            'Venus rotates backwards compared to most planets, so the Sun rises in the west and sets in the east.',
            465
        ],
        [
            'Earth', 'Terrestrial', 6371, 1.0, 365.25, 23.93,
            '#2E86AB', 1, '#4AACFF', 1, 0, 23.44,
            'Earth is the only known planet to harbour life. It has liquid water on its surface, a protective magnetic field, and an atmosphere rich in nitrogen and oxygen.',
            'Earth is the densest planet in the Solar System and the largest of the four terrestrial planets.',
            15
        ],
        [
            'Mars', 'Terrestrial', 3389.5, 1.52, 686.97, 24.62,
            '#C1440E', 1, '#FFAA66', 2, 0, 25.19,
            'Mars is known as the Red Planet due to iron oxide on its surface. It hosts Olympus Mons, the tallest volcano in the Solar System, and Valles Marineris, a vast canyon system.',
            'Mars has the largest dust storms in the Solar System, which can engulf the entire planet for months.',
            -65
        ],
        [
            'Jupiter', 'Gas Giant', 69911, 5.2, 4332.59, 9.93,
            '#C88B3A', 1, '#D4AA7D', 95, 0, 3.13,
            'Jupiter is the largest planet in the Solar System — more than twice as massive as all other planets combined. Its Great Red Spot is a storm that has raged for over 350 years.',
            'Jupiter\'s magnetic field is 20,000 times stronger than Earth\'s and extends millions of kilometres into space.',
            -110
        ],
        [
            'Saturn', 'Gas Giant', 58232, 9.58, 10759.22, 10.7,
            '#E8D191', 1, '#E8D5B0', 146, 1, 26.73,
            'Saturn is famous for its spectacular ring system, composed mainly of ice and rock. It is the least dense planet — less dense than water — and could theoretically float in a giant ocean.',
            'Saturn\'s rings span up to 282,000 km in diameter but are only about 20 metres thick on average.',
            -140
        ],
        [
            'Uranus', 'Ice Giant', 25362, 19.22, 30688.5, -17.24,
            '#7DE8E8', 1, '#A0F0F0', 28, 1, 97.77,
            'Uranus is an ice giant that rotates on its side, with an axial tilt of 97.77°. This extreme tilt means its poles experience 42 years of continuous sunlight followed by 42 years of darkness.',
            'Uranus was the first planet discovered with a telescope, found by William Herschel in 1781.',
            -195
        ],
        [
            'Neptune', 'Ice Giant', 24622, 30.05, 60182, 16.11,
            '#4B70DD', 1, '#6080FF', 16, 0, 28.32,
            'Neptune is the most distant planet and has the strongest winds in the Solar System, reaching speeds of 2,100 km/h. Its moon Triton orbits backwards and is slowly spiralling inward.',
            'Neptune was predicted mathematically before it was ever observed — its position was calculated from perturbations in Uranus\'s orbit.',
            -200
        ],
    ];

    $stmt = $db->prepare("
        INSERT OR REPLACE INTO planets
            (name, type, radius_km, distance_au, orbital_period, rotation_hours,
             color_hex, atmosphere, atmosphere_color, num_moons, has_rings, tilt_deg,
             description, fun_fact, surface_temp_c)
        VALUES
            (:name,:type,:radius_km,:distance_au,:orbital_period,:rotation_hours,
             :color_hex,:atmosphere,:atmosphere_color,:num_moons,:has_rings,:tilt_deg,
             :description,:fun_fact,:surface_temp_c)
    ");

    foreach ($planets as $p) {
        $stmt->bindValue(':name',             $p[0]);
        $stmt->bindValue(':type',             $p[1]);
        $stmt->bindValue(':radius_km',        $p[2]);
        $stmt->bindValue(':distance_au',      $p[3]);
        $stmt->bindValue(':orbital_period',   $p[4]);
        $stmt->bindValue(':rotation_hours',   $p[5]);
        $stmt->bindValue(':color_hex',        $p[6]);
        $stmt->bindValue(':atmosphere',       $p[7]);
        $stmt->bindValue(':atmosphere_color', $p[8]);
        $stmt->bindValue(':num_moons',        $p[9]);
        $stmt->bindValue(':has_rings',        $p[10]);
        $stmt->bindValue(':tilt_deg',         $p[11]);
        $stmt->bindValue(':description',      $p[12]);
        $stmt->bindValue(':fun_fact',         $p[13]);
        $stmt->bindValue(':surface_temp_c',   $p[14], SQLITE3_INTEGER);
        $stmt->execute();
    }

    echo json_encode(['status' => 'ok', 'message' => 'Database created and seeded successfully.']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
