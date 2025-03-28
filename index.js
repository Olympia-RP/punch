const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const mysql = require('mysql2');
const moment = require('moment');
require('dotenv').config();

// Importer les fonctions depuis modules.js
const { loadData, saveData, query } = require('./modules');

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
                    .setColor('#0099ff')
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
    
                    // Ajouter les heures de l'utilisateur à l'embed
                    embed.addFields({ name: user ? user.user.tag : `Utilisateur ${userId}`, value: userText });
                });
    
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
    
                let embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle(`Historique des heures de <@${userId}>`)  // Mentionner l'utilisateur dans le titre
                    .setDescription('Voici l\'historique des heures de travail de l\'utilisateur.');
    
                let totalWorkedMinutes = 0;
    
                results.forEach(row => {
                    const clockIn = moment(row.clock_in);  // Moment de l'entrée
                    const clockOut = row.clock_out ? moment(row.clock_out) : null;  // Moment de la sortie (peut être null)
    
                    embed.addFields(
                        { name: `🕐 Entrée : ${clockIn.format('YYYY-MM-DD HH:mm')}`, value: `Sortie : ${clockOut ? clockOut.format('YYYY-MM-DD HH:mm') : 'En cours'}` }
                    );
    
                    // Calcul du temps travaillé si la sortie est définie
                    if (clockOut) {
                        const diffMinutes = clockOut.diff(clockIn, 'minutes');
                        totalWorkedMinutes += diffMinutes;
                    }
                });
    
                // Calcul des heures et minutes totales
                const hours = Math.floor(totalWorkedMinutes / 60);
                const minutes = totalWorkedMinutes % 60;
    
                embed.addFields(
                    { name: '⏳ **Total travaillé**', value: `${hours}h ${minutes}m` }
                );
    
                message.reply({ embeds: [embed] });
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
    
        if (!channel || channel.type !== 'GUILD_TEXT') {
            return message.reply("Veuillez spécifier un canal valide.");
        }

        guildData.settings.logChannel = channelId;
        saveData(guildId, guildData);

        message.reply(`Le canal de log a été configuré sur ${channel.name}.`);
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
    
        if (!role) {
            return message.reply("Veuillez spécifier un rôle valide.");
        }

        guildData.settings.allowedRole = roleId;
        saveData(guildId, guildData);

        message.reply(`Le rôle autorisé a été configuré sur ${role.name}.`);
    }
});

// Connexion à la base de données MySQL
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect(err => {
    if (err) {
        console.error('🛑  Erreur de connexion à la base de données:', err);
        process.exit(1);
    }
    console.log('✅  Connecté à la base de données MySQL.');
}
);



// Démarrage du bot
client.login(process.env.BOT_TOKEN);
