<?php
$discord_id = "843629863537344514"; // Remplace par l'ID du membre
$guild_id = "1332166613486538844"; // Remplace par l'ID de ton serveur
$bot_token = "MTM1MjE1Mjk3NzE3OTQxNDY2OQ.GehLkr.cyevOUnjEHpSXYNdXmu7jCD12xT5vBjec7e8x8"; // Remplace par le token de ton bot
$url = "https://discord.com/api/v10/guilds/$guild_id/members/$discord_id";

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