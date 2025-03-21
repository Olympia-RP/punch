const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const mysql = require('mysql2');
require('dotenv').config();


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const DATA_DIR = './data/';
const botOwnerId = process.env.BOT_OWNER_ID; // Stocke l'ID du propriétaire du bot dans une variable d'environnement
// Connexion à la base de données
const connection = mysql.createConnection({
    host: 'gamerhostinghub.ca',    // Hôte de la base de données
    user: 'u49_8Po4ISpvKu',         // Utilisateur MySQL
    password: '^a7NTdS5CE=2=etIktAezbyy', // Mot de passe
    database: 's49_punch'  // Nom de la base de données
});

connection.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err.stack);
        return;
    }
    console.log('Connecté à la base de données MySQL.');
});

// Vérifier si le dossier "data" existe, sinon le créer
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Fonction pour charger les données d'un serveur spécifique depuis MySQL
function loadData(guildId) {
    return new Promise((resolve, reject) => {
        // Charger les paramètres du serveur
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

                // Charger les heures des utilisateurs
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
    // Sauvegarder les paramètres du serveur
    connection.query(
        'INSERT INTO guild_settings (guild_id, log_channel, allowed_role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE log_channel = ?, allowed_role = ?',
        [guildId, guildData.settings.logChannel, guildData.settings.allowedRole, guildData.settings.logChannel, guildData.settings.allowedRole],
        (err) => {
            if (err) {
                console.error('Erreur lors de la sauvegarde des paramètres:', err);
            }
        }
    );

    // Sauvegarder les heures des utilisateurs
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

client.on('guildCreate', async (guild) => {
    try {
        const guildData = await loadData(guild.id);
        await saveData(guild.id, guildData);
    } catch (error) {
        console.error(`Erreur lors du traitement du serveur ${guild.id}:`, error);
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    let guildData = await loadData(guildId);

    if (message.content === '.clock') {
        message.reply('Commandes: .clockin, .clockout, .clockview, .clockshow, .clockset log <channelId>, .clockset role <roleId>');
    }

    if (message.content === '.clockin') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        const userId = message.author.id;
        if (!guildData.hours[userId]) guildData.hours[userId] = [];

        if (guildData.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }

        const now = new Date().toLocaleString();
        guildData.hours[userId].push({ clockIn: now, clockOut: null });
        saveData(guildId, guildData);

        message.reply(`Vous êtes maintenant pointé à ${now}.`);

        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a pointé à ${now}.`);
        }
    }

    if (message.content === '.clockout') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
    
        const userId = message.author.id;
        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
        if (!entry) return message.reply("Vous n'êtes pas pointé.");
    
        // Formater la date de sortie au format MySQL 'YYYY-MM-DD HH:MM:SS'
        const clockOut = new Date().toISOString().replace("T", " ").split(".")[0]; // format: 'YYYY-MM-DD HH:MM:SS'
        
        entry.clockOut = clockOut;
        saveData(guildId, guildData);
    
        message.reply(`Vous êtes sorti à ${clockOut}.`);
    
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a quitté à ${clockOut}.`);
        }
    }
    

    if (message.content === '.clockview') {
        guildData = await loadData(guildId);

        const userId = message.author.id;
        if (!guildData.hours[userId]) return message.reply("Aucune heure enregistrée.");

        const entries = guildData.hours[userId];
        let totalMilliseconds = 0;
        let response = `📋 **Historique des heures de <@${userId}>** :\n`;

        entries.forEach(e => {
            response += `- 🕐 **Entrée** : ${e.clockIn}, `;
            if (e.clockOut) {
                response += `**Sortie** : ${e.clockOut}\n`;

                const startTime = new Date(e.clockIn).getTime();
                const endTime = new Date(e.clockOut).getTime();
                if (!isNaN(startTime) && !isNaN(endTime)) {
                    totalMilliseconds += (endTime - startTime);
                }
            } else {
                response += "**Sortie** : ⏳ Toujours en service\n";
            }
        });

        const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
        response += `\n⏳ **Total travaillé** : ${totalHours}h ${totalMinutes}m`;

        message.reply(response);
    }

    iif (message.content === '.clockshow') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
    
        try {
            guildData = await loadData(message.guild.id);  // Assurer que les dernières données sont chargées
    
            if (!guildData.hours || Object.keys(guildData.hours).length === 0) {
                return message.reply("Aucune donnée d'heures enregistrée sur ce serveur.");
            }
    
            let response = `📊 **Historique des heures des membres sur ${message.guild.name}** :\n`;
    
            Object.keys(guildData.hours).forEach(userId => {
                const entries = guildData.hours[userId];
                let totalMilliseconds = 0;
                let userHistory = `**Historique des heures de <@${userId}> :**\n`;
    
                entries.forEach(e => {
                    const clockIn = e.clockIn;
                    const clockOut = e.clockOut;
                    userHistory += `- 🕐 **Entrée** : ${clockIn}, `;
                    if (clockOut) {
                        userHistory += `**Sortie** : ${clockOut}\n`;
    
                        const startTime = new Date(clockIn).getTime();
                        const endTime = new Date(clockOut).getTime();
                        if (!isNaN(startTime) && !isNaN(endTime)) {
                            totalMilliseconds += (endTime - startTime);
                        }
                    } else {
                        userHistory += "**Sortie** : ⏳ Toujours en service\n";
                    }
                });
    
                const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
                const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
                userHistory += `\n⏳ **Total travaillé** : ${totalHours}h ${totalMinutes}m\n\n`;
    
                response += userHistory;
            });
    
            if (response === `📊 **Historique des heures des membres sur ${message.guild.name}** :\n`) {
                return message.reply("Aucun membre n'a encore enregistré d'heures.");
            }
    
            message.reply(response);
        } catch (error) {
            console.error("Erreur lors du traitement de la commande .clockshow :", error);
            message.reply("Une erreur est survenue lors de l'affichage des heures.");
        }
    }
    

    // Commande .clockset log
    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const channelId = args[2];
        const channel = message.guild.channels.cache.get(channelId);

        if (!channel) return message.reply("Le canal spécifié est invalide.");

        guildData.settings.logChannel = channelId;
        saveData(guildId, guildData);
        message.reply(`Le canal de logs a été défini sur ${channel.name}.`);
    }

    // Commande .clockset role
    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const roleId = args[2];
        const role = message.guild.roles.cache.get(roleId);

        if (!role) return message.reply("Le rôle spécifié est invalide.");

        guildData.settings.allowedRole = roleId;
        saveData(guildId, guildData);

        message.reply(`Le rôle ${role.name} a été défini comme rôle autorisé pour utiliser les commandes de pointage.`);
    }
});

client.login(process.env.BOT_TOKEN);
