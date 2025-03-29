<?php
require_once 'config.php'; // Inclure le fichier de configuration pour la connexion à la base de données

$headers = [
    "Authorization: Bot $bot_token",
    "Content-Type: application/json"
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

$member_info = json_decode($response, true);

if (isset($member_info['user'])) {
    $display_name = $member_info['nick'] ?? $member_info['user']['global_name'] ?? $username; // Priorité: nick -> global_name -> username
    $avatar = "https://cdn.discordapp.com/avatars/{$member_info['user']['id']}/{$member_info['user']['avatar']}.png";
    if ($member_info['user']['avatar'] == null) {
        $avatar = "https://cdn.discordapp.com/embed/avatars/0.png"; // Avatar par défaut
    }    
    print_r($member_info);
    echo "Display Name: $display_name<br>";
    echo "ID: " . $member_info['user']['id'] . "<br>";
    echo "Avatar: <img src='$avatar' width='100'><br>";
} else {
    echo "Impossible de récupérer les informations.";
}
?>