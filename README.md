# Punch Discord Bot

Punch est un bot Discord permettant de gérer les pointages des utilisateurs. Il offre des commandes pour enregistrer les entrées et sorties, afficher l'historique des heures, et configurer les rôles et canaux de logs.

## Installation

1. Clonez le dépôt :
    ```sh
    git clone https://github.com/pasmax2/punch.git
    cd punch
    ```

2. Installez les dépendances :
    ```sh
    npm install
    ```

3. Créez un fichier `.env` à la racine du projet et ajoutez-y vos variables d'environnement :
    ```env
    TOKEN=your_discord_bot_token
    PTERO_PANEL_URL=your_pterodactyl_panel_url
    PTERO_SERVER_ID=your_pterodactyl_server_id
    PTERO_API_KEY=your_pterodactyl_api_key
    ```

## Utilisation

1. Démarrez le bot :
    ```sh
    node index.js
    ```

2. Utilisez les commandes suivantes sur votre serveur Discord :

    - `.clock` : Affiche les commandes disponibles.
    - `.clockin` : Enregistrez votre entrée dans le système.
    - `.clockout` : Enregistrez votre sortie du système.
    - `.clockview` : Affichez votre historique des heures.
    - `.clockshow` : Affichez l'historique des heures pour tous les utilisateurs.
    - `.clockset log <channel_id>` : Définissez le canal de logs (administrateur uniquement).
    - `.clockset role <role_id>` : Définissez le rôle autorisé à utiliser les commandes de pointage (administrateur uniquement).

## Configuration

- Le fichier `data.json` est utilisé pour stocker les données des utilisateurs et les paramètres du bot. Il est créé automatiquement si il n'existe pas.

## Workflow GitHub Actions

Le fichier `.github/workflows/restart-bot.yml` contient un workflow GitHub Actions pour redémarrer le bot sur Pterodactyl à chaque push sur la branche `main`.

## Auteurs

- Codage By DJBlack
- Discord: djblack.
- GitHub: [pasmax2](https://github.com/pasmax2)

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.