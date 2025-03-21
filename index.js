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

        entry.clockOut = new Date().toLocaleString();
        saveData(guildId, guildData);

        message.reply(`Vous êtes sorti à ${entry.clockOut}.`);

        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a quitté à ${entry.clockOut}.`);
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

    if (message.content === '.clockshow') {
        if ( !message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId ) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
    
        // Recharger les données depuis le fichier
        let guildData = loadData(message.guild.id);
    
        if (!guildData.hours) {
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
    
                    // Calcul du total en millisecondes
                    const startTime = new Date(clockIn).getTime();
                    const endTime = new Date(clockOut).getTime();
                    if (!isNaN(startTime) && !isNaN(endTime)) {
                        totalMilliseconds += (endTime - startTime);
                    }
                } else {
                    userHistory += "**Sortie** : ⏳ Toujours en service\n";
                }
            });
    
            // Convertir le total en heures et minutes
            const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
            const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
            // Ajouter le total à l'historique
            userHistory += `\n⏳ **Total travaillé** : ${totalHours}h ${totalMinutes}m\n\n`;
    
            // Ajouter l'historique de cet utilisateur à la réponse générale
            response += userHistory;
        });
    
        // Si aucune donnée n'est trouvée, renvoyer un message d'erreur
        if (response === `📊 **Historique des heures des membres sur ${message.guild.name}** :\n`) {
            return message.reply("Aucun membre n'a encore enregistré d'heures.");
        }
    
        message.reply(response);
        
    }
    

    if (message.content.startsWith('.clockset log')) {
        if ( !message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId ) {
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

    if (message.content.startsWith('.clockset role')) {
        if ( !message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId ) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const roleId = args[2];
        const role = message.guild.roles.cache.get(roleId);

        if (!role) return message.reply("Le rôle spécifié est invalide.");

        guildData.settings.allowedRole = roleId;
        saveData(guildId, guildData);
        message.reply(`Le rôle autorisé a été défini sur ${role.name}.`);
    }

    if (message.content === '.clockset reset') {
        if ( !message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId ) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
    
        // Demander la confirmation
        const confirmationMessage = await message.reply("Êtes-vous sûr de vouloir réinitialiser toutes les heures pour tous les membres ? Tapez 'oui' pour confirmer.");
        
        // Attendre la réponse de l'utilisateur
        const filter = (response) => {
            return response.author.id === message.author.id && response.content.toUpperCase() === 'oui';
        };
        
        try {
            // Attendre 30 secondes pour la confirmation
            const collected = await message.channel.awaitMessages({
                filter,
                max: 1,
                time: 30000,
                errors: ['time'],
            });
        
            // Réinitialiser les heures si la confirmation est reçue
            connection.query(
                'DELETE FROM user_hours WHERE guild_id = ?',
                [message.guild.id],
                (err) => {
                    if (err) {
                        return message.reply(`Erreur lors de la réinitialisation des heures : ${err.message}`);
                    }
    
                    message.reply("Toutes les heures ont été réinitialisées pour tous les membres.");
                }
            );
        
            // Log de la réinitialisation
            if (guildData.settings.logChannel) {
                const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
                if (logChannel) {
                    logChannel.send(`🔄 **Réinitialisation des heures de tous les membres** effectuée par <@${message.author.id}> (${message.author.tag}).`);
                }
            }
        } catch (err) {
            // Si aucune réponse n'est reçue dans le délai, annuler l'action
            message.reply("Réinitialisation annulée, aucune confirmation reçue.");
        } finally {
            // Supprimer le message de confirmation
            confirmationMessage.delete().catch(() => {});
        }
    }
    

    if (message.content === '.invite') {
        if (message.author.id !== botOwnerId) {
            return message.reply("Seul l'owner du bot peut utiliser cette commande.")
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
        }
    
        const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`;
        message.reply(`🔗 **Lien d'invitation du bot :**\n${inviteLink}`)
            .then(msg => setTimeout(() => msg.delete().catch(() => {}), 30000));
    }


});

client.login(process.env.TOKEN);
