const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});



// Détecter la fermeture du processus (Pterodactyl, Ctrl+C, kill)
const shutdown = async (signal) => {
    if (client && client.destroy) {
        console.log(`ℹ️  Processus de déconnexion en cours...`);
        console.log(`ℹ️  Signal reçu: ${signal}. Déconnexion du bot en cours...`);
        await client.destroy(); 
    } else if (client.destroy) {
        console.log('✅  Bot déconnecté avec succès.');    
    } else {
        console.log(`⚠️ Client déjà inactif ou non défini.`);
    }

    process.exit(0);
};

// Stocke l'ID du propriétaire du bot dans une variable d'environnement
const botOwnerId = process.env.BOT_OWNER_ID; 
// Connexion à la base de données
const connection = mysql.createConnection({
    host: process.env.DB_HOST, // Utilisation d'une variable d'environnement pour la sécurité
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
// Charger les données du serveur lors de l'ajout du bot
const { loadData, saveData } = require('./modules');

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
    // Récupérer l'ID du serveur
    const guildId = message.guild.id;
    let guildData = await loadData(guildId);
    // Commande .clock
    if (message.content === '.clock') {
        message.reply('Commandes: .clockin, .clockout, .clockview, .clockshow, .clockset log <channelId>, .clockset role <roleId>, .clockset reset');
    }
    // Commande .clockin
    if (message.content === '.clockin') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        // Vérifier si l'utilisateur est déjà pointé
        const userId = message.author.id;
        if (!guildData.hours[userId]) guildData.hours[userId] = [];
        
        if (guildData.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }

        // Utilisation de moment pour formater la date de manière correcte
        const now = moment().format('YYYY-MM-DD HH:mm:ss');
        guildData.hours[userId].push({ clockIn: now, clockOut: null });

        console.log("Données avant sauvegarde:", guildData.hours);  // Log pour vérifier les données

        saveData(guildId, guildData);

        console.log("Données après sauvegarde:", guildData.hours);  // Log après sauvegarde

        message.reply(`Vous êtes maintenant pointé à ${now}.`);
        // Envoi d'un message dans le canal de log si configuré
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a pointé à ${now}.`);
        }
    }
    // Commande .clockout
    if (message.content === '.clockout') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        // Récupérer l'ID de l'utilisateur et l'entrée en cours
        const userId = message.author.id;
        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
    
        // Vérifier si l'utilisateur est bien en cours de pointage
        if (!entry) {
            return message.reply("Vous n'êtes pas actuellement pointé. Veuillez d'abord utiliser .clockin.");
        }
    
        // Utilisation de moment pour formater la date de manière correcte
        const clockOut = moment().format('YYYY-MM-DD HH:mm:ss');
    
        // Mettre à jour uniquement la première entrée sans 'clockOut'
        entry.clockOut = clockOut;
    
        // Sauvegarder les modifications dans la base de données
        saveData(guildId, guildData);
    
        message.reply(`Vous êtes sorti à ${clockOut}.`);
    
        // Envoi d'un message dans le canal de log si configuré
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) logChannel.send(`<@${userId}> a quitté à ${clockOut}.`);
        }
    }
    
    
    
    // Fonction pour formater la date en format lisible
    const formatDate = (dateString) => {
        if (!dateString) return 'En cours';
        const date = new Date(dateString);
        return date.toLocaleString('fr-CA', { 
            timeZone: 'America/Toronto', 
            hour12: false, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        }).replace(',', ''); // Enlève la virgule pour un affichage propre
    };

    // Affichage de l'historique des heures
    if (message.content === '.clockshow') {
        connection.query(
            'SELECT user_id, clock_in, clock_out FROM user_hours WHERE guild_id = ?',
            [guildId],
            (err, results) => {
                if (err) {
                    console.error('Erreur lors de la récupération des heures:', err);
                    return message.reply('❌ Une erreur est survenue.');
                }

                if (results.length === 0) {
                    return message.reply('📭 Aucun membre n’a enregistré d’heures.');
                }

                let response = `📊 **Historique des heures des membres sur ${message.guild.name}** :\n`;

                // Regroupe les heures par utilisateur
                const userHours = {};
                results.forEach(row => {
                    if (!userHours[row.user_id]) userHours[row.user_id] = [];
                    userHours[row.user_id].push({
                        clockIn: moment(row.clock_in).format('ddd MMM DD YYYY HH:mm'),
                        clockOut: row.clock_out ? moment(row.clock_out).format('ddd MMM DD YYYY HH:mm') : null
                    });
                });

                // Affiche les heures pour chaque utilisateur
                Object.keys(userHours).forEach(userId => {
                    const user = message.guild.members.cache.get(userId);
                    response += `\n**Historique des heures de <@${userId}>** :\n`;
                    // Si l'utilisateur n'est pas trouvé, affiche l'ID
                    let totalWorkedMinutes = 0;
                    userHours[userId].forEach(entry => {
                        const clockIn = entry.clockIn;
                        const clockOut = entry.clockOut ? entry.clockOut : 'En cours';

                        // Calcul du total de temps travaillé si sortie existe
                        if (entry.clockOut) {
                            const clockInTime = moment(entry.clockIn, 'ddd MMM DD YYYY HH:mm');
                            const clockOutTime = moment(entry.clockOut, 'ddd MMM DD YYYY HH:mm');
                            const diffMinutes = clockOutTime.diff(clockInTime, 'minutes');
                            totalWorkedMinutes += diffMinutes;
                        }

                        response += `🕐 Entrée : ${clockIn}, Sortie : ${clockOut}\n`;
                    });

                    // Calcule les heures et minutes totales
                    const hours = Math.floor(totalWorkedMinutes / 60);
                    const minutes = totalWorkedMinutes % 60;
                    response += `⏳ **Total travaillé** : ${hours}h ${minutes}m\n`;
                });

                message.reply(response);
            }
        );
    }

    // Affichage des heures d'un utilisateur
    if (message.content.startsWith('.clockview')) {
        const userId = message.mentions.users.first()?.id || message.author.id;
        connection.query(
            'SELECT clock_in, clock_out FROM user_hours WHERE user_id = ? AND guild_id = ?',
            [userId, message.guild.id],
            (err, results) => {
                if (err) {
                    console.error('Erreur lors de la récupération des heures:', err);
                    return message.reply('❌ Une erreur est survenue.');
                }
                // Vérifier si l'utilisateur a des heures enregistrées
                if (results.length === 0) {
                    return message.reply(`📭 Aucun historique pour <@${userId}>.`);
                }
                // Création de la réponse avec l'historique des heures
                let response = `📊 **Historique des heures de <@${userId}>** :\n`;
                // Variable pour accumuler le total des minutes travaillées
                let totalWorkedMinutes = 0; // Variable pour accumuler le total des minutes travaillées
                // Parcours des résultats de la requête SQL
                results.forEach(row => {
                    const clockIn = moment(row.clock_in);  // Moment de l'entrée
                    const clockOut = row.clock_out ? moment(row.clock_out) : null;  // Moment de la sortie (peut être null)
    
                    // Affichage des heures d'entrée et de sortie
                    response += `🕐 Entrée : ${clockIn.format('YYYY-MM-DD HH:mm')}, Sortie : ${clockOut ? clockOut.format('YYYY-MM-DD HH:mm') : 'En cours'}\n`;
    
                    // Calcul du temps travaillé si la sortie est définie
                    if (clockOut) {
                        const diffMinutes = clockOut.diff(clockIn, 'minutes');
                        totalWorkedMinutes += diffMinutes;  // Ajout au total des minutes travaillées
                    }
                });
    
                // Calcul des heures et minutes totales
                const hours = Math.floor(totalWorkedMinutes / 60);
                const minutes = totalWorkedMinutes % 60;
    
                // Affichage du total des heures travaillées
                response += `⏳ **Total travaillé** : ${hours}h ${minutes}m\n`;
    
                message.reply(response);
            }
        );
    }
    

    // Commande .clockset log
    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
        // Récupérer l'ID du canal spécifié
        const args = message.content.split(' ');
        const channelId = args[2];
        const channel = message.guild.channels.cache.get(channelId);
        // Vérifier si le canal spécifié est valide
        if (!channel) return message.reply("Le canal spécifié est invalide.");
        // Mettre à jour les paramètres du serveur
        guildData.settings.logChannel = channelId;
        saveData(guildId, guildData);
        message.reply(`Le canal de logs a été défini sur ${channel.name}.`);
    }

    // Commande .clockset role
    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
        // Récupérer l'ID du rôle spécifié
        const args = message.content.split(' ');
        const roleId = args[2];
        const role = message.guild.roles.cache.get(roleId);
        // Vérifier si le rôle spécifié est valide
        if (!role) return message.reply("Le rôle spécifié est invalide.");
        // Mettre à jour les paramètres du serveur
        guildData.settings.allowedRole = roleId;
        saveData(guildId, guildData);

        message.reply(`Le rôle ${role.name} a été défini comme rôle autorisé pour utiliser les commandes de pointage.`);
    }

    if (message.content === '.clockset reset') {
        // Vérifier si l'utilisateur a les permissions nécessaires
        const userId = message.mentions.users.first()?.id || message.author.id;
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== botOwnerId) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }
    
        // Demander confirmation à l'admin
        message.reply("Êtes-vous sûr de vouloir réinitialiser toutes les heures ? Répondez **oui** dans les 30 secondes pour confirmer.")
            .then(() => {
                // Création d'un filtre pour ne prendre en compte que la réponse de l'admin
                const filter = response => 
                    response.author.id === message.author.id && response.content.toLowerCase() === "oui";
    
                // Attendre une réponse pendant 30 secondes
                message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                    .then(() => {
                        // Exécuter la requête SQL pour supprimer les heures des membres
                        const sql = `DELETE FROM user_hours WHERE guild_id = ?`;
                        connection.query(sql, [guildId], (err, result) => {
                            if (err) {
                                console.error("Erreur lors de la réinitialisation des heures:", err);
                                return message.reply("Une erreur est survenue lors de la réinitialisation des heures.");
                            }
    
                            message.reply("Les heures des membres ont été réinitialisées.");
    
                            // Envoyer un message dans le canal de log si configuré
                            if (guildData.settings.logChannel) {
                                const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
                                if (logChannel) logChannel.send(`Les heures des membres ont été réinitialisées par <@${userId}>.`);
                            }
                        });
                    })
                    .catch(() => {
                        message.reply("Réinitialisation annulée. Vous n'avez pas confirmé dans le temps imparti.");
                    });
            });
    }    
});

// Log de connexion du bot
client.on('ready', () => {
    console.log(`✅  Bot connecter avec succès en tant que ${client.user.tag}!`);
});

// Gestion des erreurs
client.on('error', console.error);
process.on('SIGINT', () => shutdown('SIGINT'));
// process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(process.env.BOT_TOKEN);
