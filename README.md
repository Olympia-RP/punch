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
        BOT_TOKEN=                          # Le jeton d'authentification du bot Discord
        BOT_OWNER_ID=                       # L'identifiant Discord du propriétaire du bot
        DB_HOST=                            # L'adresse de l'hôte de la base de données (ex: localhost)
        DB_USER=                            # Le nom d'utilisateur pour se connecter à la base de données
        DB_PASSWORD=                        # Le mot de passe pour se connecter à la base de données
        DB_NAME=                            # Le nom de la base de données à utiliser
    ```

## Utilisation

1. Démarrez le bot :
    ```sh
    node index.js
    ```

2. Utilisez les commandes suivantes sur votre serveur Discord :

    - `.clock` : Affiche les commandes disponibles.
    - `.clockin` : Enregistrez votre entrée dans le système.
    - `.clockout` ou `.clockout <member> ou <ID>` : Enregistrez votre ou la sortie du système du membre.
    - `.clockview` : Affichez votre historique des heures.
    - `.clockshow` : Affichez l'historique des heures pour tous les utilisateurs.
    - `.clockset log <channel_id>` : Définissez le canal de logs (administrateur uniquement).
    - `.clockset role <role_id>` : Définissez le rôle autorisé à utiliser les commandes de pointage (administrateur uniquement).
    - `.clockset reset` : reset tout les membre avec leur heure tout en gardant le canal log & role intact.
    - `.invite` : Affiche le lien d'invitation du bot.

## Configuration

- Les données des utilisateurs et les paramètres du bot sont désormais gérés via une base de données MySQL. Assurez-vous que les informations de connexion à la base de données sont correctement configurées dans le fichier `.env`. Le fichier `data/IDGUILD.json` n'est plus utilisé.

`mysql -u <votre_utilisateur> -p <votre_base_de_données> < setup.sql`

## Auteurs

- Codage By DJBlack
- Discord: djblack.
- Discord de la communauté : [Utopia Island (Qc)](https://discord.gg/w6vwpTbnX6)
- GitHub: [pasmax2](https://github.com/pasmax2)

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.