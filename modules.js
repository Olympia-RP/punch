const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

// Connexion à la base de données
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Vérifier si la connexion à la base de données a réussi
connection.connect((err) => {
    if (err) {
        console.error('🛑  Erreur de connexion à la base de données:', err.stack);
        return;
    }
    console.log('✅  Connecté à la base de données MySQL.');
});

let keepalive = null;

// Fonction pour garder la connexion active
function keepAlive() {
    connection.ping(err => {
        if (err) {
            let keepAlive = false;
            console.error('🛑 Erreur lors du ping de la base de données:', err);
            reconnectDatabase(); // Relance la connexion en cas d'erreur
        } else {
            if (!keepAlive) {
                let keepAlive = true;
                console.log('✅ Ping MySQL réussi, connexion toujours active.');
            }
        }
    });
}

// Fonction pour reconnecter en cas de perte de connexion
function reconnectDatabase() {
    console.log('♻️ Tentative de reconnexion à MySQL...');
    connection.destroy(); // Détruit l'ancienne connexion
    connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    connection.connect(err => {
        if (err) {
            console.error('🛑 Erreur de reconnexion à MySQL:', err);
            setTimeout(reconnectDatabase, 5000); // Réessaie après 5 secondes
        } else {
            console.log('✅ Reconnecté à MySQL avec succès.');
        }
    });
}

// Lancer le KeepAlive toutes les 5 minutes
setInterval(keepAlive, 30 * 60 * 1000);

// Fonction pour charger les données d'un serveur spécifique depuis MySQL
function loadData(guildId) {
    return new Promise((resolve, reject) => {
        connection.query(
            'SELECT * FROM guild_settings WHERE guild_id = ?',
            [guildId],
            (err, results) => {
                if (err) {
                    return reject(`Erreur lors du chargement des paramètres : ${err.message}`);
                }
                if (results.length === 0) {
                    return resolve({ settings: { logChannel: null, allowedRole: null }, hours: {} });
                }

                const guildData = {
                    settings: {
                        logChannel: results[0].log_channel,
                        allowedRole: results[0].allowed_role
                    },
                    hours: {}
                };

                connection.query(
                    'SELECT * FROM user_hours WHERE guild_id = ?',
                    [guildId],
                    (err, results) => {
                        if (err) {
                            return reject(`Erreur lors du chargement des heures : ${err.message}`);
                        }

                        results.forEach(entry => {
                            const userId = entry.user_id;
                            if (!guildData.hours[userId]) guildData.hours[userId] = [];

                            guildData.hours[userId].push({
                                clockIn: entry.clock_in,
                                clockOut: entry.clock_out
                            });
                        });

                        resolve(guildData);
                    }
                );
            }
        );
    });
}

// Fonction pour sauvegarder les données dans la base de données MySQL
function saveData(guildId, guildData) {
    connection.query(
        'INSERT INTO guild_settings (guild_id, log_channel, allowed_role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE log_channel = ?, allowed_role = ?',
        [guildId, guildData.settings.logChannel, guildData.settings.allowedRole, guildData.settings.logChannel, guildData.settings.allowedRole],
        (err) => {
            if (err) {
                console.error('Erreur lors de la sauvegarde des paramètres:', err);
            }
        }
    );


    Object.keys(guildData.hours).forEach(userId => {
        guildData.hours[userId].forEach(entry => {
            connection.query(
                'INSERT INTO user_hours (guild_id, user_id, clock_in, clock_out) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE clock_out = ?',
                [guildId, userId, entry.clockIn, entry.clockOut, entry.clockOut],
                (err) => {
                    if (err) {
                        console.error(`Erreur lors de la sauvegarde des heures pour l'utilisateur ${userId}:`, err);
                    }
                }
            );
        });
    });
}


module.exports = { loadData, saveData, connection };