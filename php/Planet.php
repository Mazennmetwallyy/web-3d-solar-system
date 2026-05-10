<?php

class Planet {

    private SQLite3 $db;

    public function __construct() {
        $dbPath = __DIR__ . '/../data/planets.db';
        if (!file_exists($dbPath)) {
            ob_start();
            require_once __DIR__ . '/setup.php';
            ob_end_clean();
        }
        $this->db = new SQLite3($dbPath);
        $this->db->busyTimeout(5000);
    }

    public function getAll(): array {
        $result = $this->db->query("SELECT * FROM planets ORDER BY id");
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $rows[] = $this->cast($row);
        }
        return $rows;
    }

    public function getByName(string $name): ?array {
        $stmt = $this->db->prepare("SELECT * FROM planets WHERE LOWER(name) = LOWER(:name) LIMIT 1");
        $stmt->bindValue(':name', $name);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);
        return $row ? $this->cast($row) : null;
    }

    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM planets WHERE id = :id LIMIT 1");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);
        return $row ? $this->cast($row) : null;
    }

    private function cast(array $row): array {
        return [
            'id'               => (int)   $row['id'],
            'name'             => (string)$row['name'],
            'type'             => (string)$row['type'],
            'radius_km'        => (float) $row['radius_km'],
            'distance_au'      => (float) $row['distance_au'],
            'orbital_period'   => (float) $row['orbital_period'],
            'rotation_hours'   => (float) $row['rotation_hours'],
            'color_hex'        => (string)$row['color_hex'],
            'atmosphere'       => (bool)  $row['atmosphere'],
            'atmosphere_color' => $row['atmosphere_color'],
            'num_moons'        => (int)   $row['num_moons'],
            'has_rings'        => (bool)  $row['has_rings'],
            'tilt_deg'         => (float) $row['tilt_deg'],
            'description'      => (string)$row['description'],
            'fun_fact'         => (string)$row['fun_fact'],
            'surface_temp_c'   => (int)   ($row['surface_temp_c'] ?? 0),
        ];
    }
}
