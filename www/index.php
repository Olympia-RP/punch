<?php
$discord_id = "843629863537344514"; // Remplace par l'ID du membre
$guild_id = "TON_GUILD_ID"; // Remplace par l'ID de ton serveur
$bot_token = "TON_BOT_TOKEN"; // Remplace par le token de ton bot

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
    echo "Pseudo: " . $member_info['user']['username'] . "#" . $member_info['user']['discriminator'] . "<br>";
    echo "ID: " . $member_info['user']['id'] . "<br>";
    echo "Avatar: <img src='https://cdn.discordapp.com/avatars/{$member_info['user']['id']}/{$member_info['user']['avatar']}.png' width='100'><br>";
} else {
    echo "Impossible de récupérer les informations.";
}
?>
