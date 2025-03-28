const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

// Création d'un pool de connexions
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,  // Nombre max de connexions ouvertes
    queueLimit: 0         // Pas de limite pour la file d'attente
});

// Fonction pour exécuter une requête MySQL avec le pool
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('🛑  Erreur lors de la récupération d\'une connexion MySQL:', err);
                return reject(err);
            }

            connection.query(sql, params, (error, results) => {
                connection.release(); // Toujours libérer la connexion après usage

                if (error) {
                    return reject(error);
                }

                resolve(results);
            });
        });
    });
}

// Fonction pour charger les données d'un serveur spécifique
async function loadData(guildId) {
    try {
        const results = await query('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
        if (results.length === 0) {
            return { settings: { logChannel: null, allowedRole: null }, hours: {} };
        }

        const guildData = {
            settings: {
                logChannel: results[0].log_channel,
                allowedRole: results[0].allowed_role
            },
            hours: {}
        };

        const hoursResults = await query('SELECT * FROM user_hours WHERE guild_id = ?', [guildId]);
        hoursResults.forEach(entry => {
            const userId = entry.user_id;
            if (!guildData.hours[userId]) guildData.hours[userId] = [];

            guildData.hours[userId].push({
                clockIn: entry.clock_in,
                clockOut: entry.clock_out
            });
        });

        return guildData;
    } catch (error) {
        console.error(`🛑  Erreur lors du chargement des données: ${error.message}`);
        throw error;
    }
}

// Fonction pour sauvegarder les données
async function saveData(guildId, guildData) {
    try {
        await query(
            'INSERT INTO guild_settings (guild_id, log_channel, allowed_role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE log_channel = ?, allowed_role = ?',
            [guildId, guildData.settings.logChannel, guildData.settings.allowedRole, guildData.settings.logChannel, guildData.settings.allowedRole]
        );

        for (const userId of Object.keys(guildData.hours)) {
            for (const entry of guildData.hours[userId]) {
                await query(
                    'INSERT INTO user_hours (guild_id, user_id, clock_in, clock_out) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE clock_out = ?',
                    [guildId, userId, entry.clockIn, entry.clockOut, entry.clockOut]
                );
            }
        }
    } catch (error) {
        console.error(`🛑  Erreur lors de la sauvegarde des données: ${error.message}`);
    }
}

module.exports = { loadData, saveData, query };
