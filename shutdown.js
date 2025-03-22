process.on('SIGINT', () => {
    console.log('Détection de fermeture du processus (SIGINT), déconnexion du bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Détection de fermeture du processus (SIGTERM), déconnexion du bot...');
    client.destroy();
    process.exit(0);
});
