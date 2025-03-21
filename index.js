const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

process.on('SIGINT', async () => {
    console.log('Arrêt du bot...');
    await client.destroy();
    process.exit(0);
});

let data = {};

function loadData() {
    if (fs.existsSync('data.json')) {
        try {
            data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
            console.log("✅ Data chargée :", data);  // Ajoute cette ligne
        } catch (error) {
            console.error('❌ Erreur de parsing JSON:', error);
        }
    } else {
        console.log("⚠️ Aucun fichier data.json trouvé, création d'un nouveau.");
    }
}


function saveData() {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

client.on('guildCreate', (guild) => {
    if (!data[guild.id]) {
        data[guild.id] = {
            settings: { logChannel: null, allowedRole: null },
            hours: {}
        };
        saveData();
    }
});

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    
    const guildId = message.guild.id;
    if (!data[guildId]) {
        data[guildId] = { settings: { logChannel: null, allowedRole: null }, hours: {} };
    }
    
    const guildData = data[guildId];
    
    if (message.content === '.clock') {
        message.reply('Commandes: .clockin, .clockout, .clockview, .clockshow, .clockset log <channelId>, .clockset role <roleId>');
    }

    // Commande .clockin
    if (message.content === '.clockin') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        
        const userId = message.author.id;
        if (!guildData.hours[userId]) {
            guildData.hours[userId] = [];
        }
        
        if (guildData.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }
        
        const now = new Date().toLocaleString();
        guildData.hours[userId].push({ clockIn: now, clockOut: null });
        saveData();
        
        message.reply(`Vous êtes maintenant pointé à ${now}.`);
        
        // ✅ ENVOYER LE MESSAGE DANS LE CANAL DE LOGS
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) {
                logChannel.send(`<@${userId}> a pointé à ${now}.`);
            } else {
                console.error(`Canal de log introuvable: ${guildData.settings.logChannel}`);
            }
        }
    }

    // Commande .clockout
    if (message.content === '.clockout') {
        if (guildData.settings.allowedRole && !message.member.roles.cache.has(guildData.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }
        
        const userId = message.author.id;
        const entry = guildData.hours[userId]?.find(entry => entry.clockOut === null);
        if (!entry) return message.reply("Vous n'êtes pas pointé.");
        
        entry.clockOut = new Date().toLocaleString();
        saveData();
        
        message.reply(`Vous êtes sorti à ${entry.clockOut}.`);
        
        // ✅ ENVOYER LE MESSAGE DANS LE CANAL DE LOGS
        if (guildData.settings.logChannel) {
            const logChannel = message.guild.channels.cache.get(guildData.settings.logChannel);
            if (logChannel) {
                logChannel.send(`<@${userId}> a quitté à ${entry.clockOut}.`);
            } else {
                console.error(`Canal de log introuvable: ${guildData.settings.logChannel}`);
            }
        }
    }


    if (message.content === '.clockview') {
        // Recharger les données depuis le fichier
        loadData(); 
    
        const guildId = message.guild.id;
        const userId = message.author.id;
    
        // Vérifie si les données existent bien
        if (!data[guildId] || !data[guildId].hours || !data[guildId].hours[userId]) {
            return message.reply("Aucune heure enregistrée.");
        }
    
        const entries = data[guildId].hours[userId];
    
        let totalMilliseconds = 0;
        let response = `📋 **Historique des heures de <@${userId}>** :\n`;
    
        entries.forEach(e => {
            response += `- 🕐 **Entrée** : ${e.clockIn}, `;
            if (e.clockOut) {
                response += `**Sortie** : ${e.clockOut}\n`;
    
                // Calcul du total en millisecondes
                const startTime = new Date(e.clockIn).getTime();
                const endTime = new Date(e.clockOut).getTime();
                if (!isNaN(startTime) && !isNaN(endTime)) {
                    totalMilliseconds += (endTime - startTime);
                }
            } else {
                response += "**Sortie** : ⏳ Toujours en service\n";
            }
        });
    
        // Convertir le total en heures et minutes
        const totalHours = Math.floor(totalMilliseconds / (1000 * 60 * 60));
        const totalMinutes = Math.floor((totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
        response += `\n⏳ **Total travaillé** : ${totalHours}h ${totalMinutes}m`;
    
        message.reply(response);
    }
    
    
    

    if (message.content === '.clockshow') {
        // Recharger les données depuis le fichier
        loadData(); 
    
        const guildId = message.guild.id;
    
        if (!data[guildId] || !data[guildId].hours) {
            return message.reply("Aucune donnée d'heures enregistrée sur ce serveur.");
        }
    
        let response = `📊 **Historique des heures des membres sur ${message.guild.name}** :\n`;
    
        Object.keys(data[guildId].hours).forEach(userId => {
            const entries = data[guildId].hours[userId];
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
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const channelId = args[2];
        const channel = message.guild.channels.cache.get(channelId);
        
        if (!channel) {
            return message.reply("Le canal spécifié est invalide.");
        }

        guildData.settings.logChannel = channelId;
        saveData();
        message.reply(`Le canal de logs a été défini sur ${channel.name}.`);
    }

    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Vous devez être administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const roleId = args[2];
        const role = message.guild.roles.cache.get(roleId);
        
        if (!role) {
            return message.reply("Le rôle spécifié est invalide.");
        }

        guildData.settings.allowedRole = roleId;
        saveData();
        message.reply(`Le rôle autorisé a été défini sur ${role.name}.`);
    }
});

client.login(process.env.TOKEN);
