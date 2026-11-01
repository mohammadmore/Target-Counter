<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// -----------------------------------------------------
// DATABASE CONFIGURATION (FILL IN YOUR CPANEL DETAILS)
// -----------------------------------------------------
$servername = "localhost";
$username = "pknxgtqa_kiyanpearl";
$password = "h*nhI)k=l9ayg,ws";
$dbname = "pknxgtqa_kiyanpearl";
// -----------------------------------------------------

// Connect to MySQL
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit();
}

// Create table if not exists
$createTableQuery = "CREATE TABLE IF NOT EXISTS kiyan_score (
    id INT(11) PRIMARY KEY DEFAULT 1,
    score BIGINT NOT NULL DEFAULT 0,
    target BIGINT NOT NULL DEFAULT 60000000
)";
$conn->query($createTableQuery);

// Initialize row if empty
$checkRow = $conn->query("SELECT * FROM kiyan_score WHERE id = 1");
if ($checkRow->num_rows == 0) {
    $conn->query("INSERT INTO kiyan_score (id, score, target) VALUES (1, 0, 60000000)");
} else {
    // Force update existing row to new target 60,000,000
    $conn->query("UPDATE kiyan_score SET target = 60000000 WHERE id = 1");
}

if ($_SERVER['REQUEST_METHOD'] == 'GET') {
    // Return current score
    $result = $conn->query("SELECT score, target FROM kiyan_score WHERE id = 1");
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        echo json_encode([
            "score" => (int)$row["score"],
            "target" => (int)$row["target"]
        ]);
    } else {
        echo json_encode(["score" => 0, "target" => 60000000]);
    }
} 
elseif ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Update score
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (isset($data["score"])) {
        $newScore = (int)$data["score"];
        $stmt = $conn->prepare("UPDATE kiyan_score SET score = ? WHERE id = 1");
        $stmt->bind_param("i", $newScore);
        
        if ($stmt->execute()) {
            echo json_encode(["success" => true, "score" => $newScore]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to update score"]);
        }
        $stmt->close();
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Invalid data"]);
    }
}

$conn->close();
?>
