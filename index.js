const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { EmbedBuilder } = require('@discordjs/builders');
const fs = require('fs');
const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

// Importer les fonctions depuis modules.js
const { loadData, saveData, connection } = require('./modules');

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
    // Vérifier si le client est défini et actif
    if (client && client.destroy) {
        console.log(`ℹ️  Processus de déconnexion en cours...`);
        console.log(`ℹ️  Signal reçu: ${signal}.`);
        await client.destroy();     
        console.log('✅  Bot déconnecté avec succès.');
    } else {
        console.log(`⚠️ Client déjà inactif ou non défini.`);
    }

    process.exit(0);
};

// Stocke l'ID du propriétaire du bot dans une variable d'environnement
const botOwnerId = process.env.BOT_OWNER_ID; 

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
        message.reply('Commandes: .clockin : Enregistrez votre entrée dans le système., .clockout  : Enregistrez votre sortie du système., .clockview  : Affichez votre historique des heures., .clockshow : Affichez l\'historique des heures pour tous les utilisateurs., .clockset log <channelId> : Owner du bot uniquement., .clockset role <roleId> : Owner du bot uniquement., .clockset reset : reset tout les membre avec leur heure tout en gardant le canal log & role intact.');
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
    if (message.content.startsWith('.clockout')) {
        // Vérifier si l'utilisateur a les permissions nécessaires
        const args = message.content.split(' ').slice(1);
        let targetUser = message.mentions.users.first() || (args[0] ? message.guild.members.cache.get(args[0])?.user : null);
        let isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    
        if (!targetUser) {
            targetUser = message.author;
        } else if (!isAdmin) {
            return message.reply("Vous n'avez pas la permission d'effectuer un clockout pour un autre membre.");
        }
    
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole) && !isAdmin) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
    
        const userId = targetUser.id;
        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
    
        if (!entry) {
            return message.reply(`<@${userId}> n'est pas actuellement pointé. Veuillez d'abord utiliser .clockin.`);
        }
    
        const clockOut = moment().format('YYYY-MM-DD HH:mm:ss');
        entry.clockOut = clockOut;
        saveData(guildId, guildData);
    
        message.reply(`${targetUser === message.author ? "Vous êtes" : `<@${userId}> est`} sorti à ${clockOut}.`);
    
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
    
                let embed = new EmbedBuilder()
                    .setColor(parseInt('0x0099ff'))
                    .setTitle(`Historique des heures des membres sur ${message.guild.name}`)
                    .setDescription('Voici l\'historique des heures de travail des membres :');
    
                // Regroupe les heures par utilisateur
                const userHours = {};
                results.forEach(row => {
                    if (!userHours[row.user_id]) userHours[row.user_id] = [];
                    userHours[row.user_id].push({
                        clockIn: moment(row.clock_in).format('ddd MMM DD YYYY HH:mm'),
                        clockOut: row.clock_out ? moment(row.clock_out).format('ddd MMM DD YYYY HH:mm') : null
                    });
                });
    
                const fields = []; // Tableau pour stocker les champs
    
                // Affiche les heures pour chaque utilisateur
                Object.keys(userHours).forEach(userId => {
                    const user = message.guild.members.cache.get(userId);
                    let userText = `**Historique des heures de <@${userId}> :**\n`;
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
    
                        userText += `🕐 Entrée : ${clockIn}, Sortie : ${clockOut}\n`;
                    });
    
                    // Calcule les heures et minutes totales
                    const hours = Math.floor(totalWorkedMinutes / 60);
                    const minutes = totalWorkedMinutes % 60;
                    userText += `⏳ **Total travaillé** : ${hours}h ${minutes}m\n`;
    
                    // Diviser l'utilisateurText en plusieurs champs si trop long
                    const maxFieldLength = 977;
                    while (userText.length > maxFieldLength) {
                        fields.push({
                            name: `Historique des heures de ${user ? user.user.tag : `Utilisateur ${userId}`}`,
                            value: userText.substring(0, maxFieldLength)
                        });
                        userText = userText.substring(maxFieldLength);
                    }
    
                    // Ajouter le reste du texte (si plus court que maxFieldLength)
                    fields.push({
                        name: `Historique des heures de ${user ? user.user.tag : `Utilisateur ${userId}`}`,
                        value: userText
                    });
                });
    
                // Ajouter les champs à l'embed après avoir vérifié les données
                try {
                    embed.addFields(fields);
                } catch (error) {
                    console.error('Erreur lors de l\'ajout des champs:', error);
                    return message.reply('❌ Une erreur est survenue lors de l\'ajout des champs.');
                }
    
                message.reply({ embeds: [embed] });
            }
        );
    }
    
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
    
                if (results.length === 0) {
                    return message.reply(`📭 Aucun historique pour <@${userId}>.`);
                }
    
                let totalWorkedMinutes = 0;
                let currentEmbed = new EmbedBuilder()
                    .setColor(parseInt('0x0099ff'))
                    .setTitle(`Historique des heures de ${message.guild.members.cache.get(userId)?.displayName || `<@${userId}>`}`)  // Utiliser le displayName
                    .setDescription('Voici l\'historique des heures de travail de l\'utilisateur.');
                
                let fieldCount = 0;  // Compteur de champs ajoutés dans l'embed
                let fieldsToAdd = [];  // Tableau pour stocker les champs à ajouter à l'embed actuel
                const maxFieldLength = 977;  // Limite de caractères par champ Discord
    
                results.forEach((row, index) => {
                    const clockIn = moment(row.clock_in);  // Moment de l'entrée
                    const clockOut = row.clock_out ? moment(row.clock_out) : null;  // Moment de la sortie (peut être null)
    
                    // Texte à afficher pour chaque entrée
                    let userText = `🕐 Entrée : ${clockIn.format('YYYY-MM-DD HH:mm')}, Sortie : ${clockOut ? clockOut.format('YYYY-MM-DD HH:mm') : 'En cours'}`;
    
                    // Calcul du temps travaillé si la sortie est définie
                    if (clockOut) {
                        const diffMinutes = clockOut.diff(clockIn, 'minutes');
                        totalWorkedMinutes += diffMinutes;
                    }
    
                    // Ajouter le texte au champ
                    fieldsToAdd.push({
                        name: `Entrée : ${clockIn.format('YYYY-MM-DD HH:mm')}`,
                        value: userText
                    });
    
                    fieldCount++;
    
                    // Si le nombre de champs atteint 25 ou que le texte dépasse la limite, envoyer l'embed et réinitialiser
                    if (fieldCount === 25 || index === results.length - 1 || userText.length > maxFieldLength) {
                        if (fieldCount > 0) {
                            // Calcul des heures et minutes totales
                            const hours = Math.floor(totalWorkedMinutes / 60);
                            const minutes = totalWorkedMinutes % 60;
    
                            currentEmbed.addFields(fieldsToAdd);  // Ajouter les champs collectés
                            currentEmbed.addFields(
                                { name: '⏳ **Total travaillé**', value: `${hours}h ${minutes}m` }
                            );
    
                            message.reply({ embeds: [currentEmbed] });
    
                            // Si on n'est pas encore à la fin, créez un nouvel embed
                            if (index !== results.length - 1) {
                                currentEmbed = new EmbedBuilder()
                                    .setColor('#0099ff')
                                    .setTitle(`Historique des heures de ${message.guild.members.cache.get(userId)?.displayName || `<@${userId}>`}`)
                                    .setDescription('Voici l\'historique des heures de travail de l\'utilisateur.');
                            }
    
                            // Réinitialisation des variables pour le prochain groupe de champs
                            fieldsToAdd = [];
                            fieldCount = 0;
                            totalWorkedMinutes = 0;  // Réinitialisation pour le prochain batch d'heures
                        }
                    }
                });
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
