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

3. Copier le fichier `.env.exemple` en `.env` à la racine du projet et modifier la variables d'environnement :
    ```env
    TOKEN=your_discord_bot_token
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

## Auteurs

- Codage By DJBlack
- Discord: djblack.
- Discord de la communauté : [Utopia Island (Qc)](https://discord.gg/w6vwpTbnX6)
- GitHub: [pasmax2](https://github.com/pasmax2)

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.