// Codage By DJBlack copyright 2024/2025
// Discord: djblack.
// Github: https://github.com/pasmax2/punch
 
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// Initialisation du client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

process.on('SIGINT', async () => {
    console.log('Arrêt du bot...');
    await client.destroy();
    process.exit(0);
});

// Chargement des données avec vérification de l'existence du fichier
let data = {
    settings: {
        logChannel: null,
        allowedRole: null
    },
    hours: {}
};

// Vérifier si le fichier JSON existe avant de le charger
function loadData() {
    fs.access('data.json', fs.constants.F_OK, (err) => {
        if (err) {
            console.log('Le fichier data.json n\'existe pas, création d\'un fichier par défaut.');
            saveData();  // Créer le fichier avec les valeurs par défaut
        } else {
            fs.readFile('data.json', 'utf8', (err, fileData) => {
                if (!err) {
                    try {
                        data = JSON.parse(fileData);
                    } catch (parseError) {
                        console.error('Erreur de parsing JSON:', parseError);
                    }
                }
            });
        }
    });
}

// Sauvegarder les données dans le fichier JSON
function saveData() {
    fs.writeFile('data.json', JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Erreur lors de l'enregistrement des données:", err);
        }
    });
}

// Charger les données au démarrage
loadData();

// Commande .clock
client.on('messageCreate', async (message) => {
    if (message.content === '.clock') {
        const commands = [
            { command: '.clockin', description: 'Enregistrez votre entrée dans le système.' },
            { command: '.clockout', description: 'Enregistrez votre sortie du système.' },
            { command: '.clockview', description: 'Affichez votre historique des heures.' },
            { command: '.clockshow', description: 'Affichez l\'historique des heures pour tous les utilisateurs.' }
        ];

        let response = 'Voici les commandes disponibles :\n\n';
        commands.forEach(cmd => {
            response += `**${cmd.command}** : ${cmd.description}\n`;
        });

        message.reply(response);
    }
});

// Commande .clockin
client.on('messageCreate', async (message) => {
    if (message.content === '.clockin') {
        if (data.settings.allowedRole && !message.member.roles.cache.has(data.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        const userId = message.author.id;
        if (!Array.isArray(data.hours[userId])) {
            data.hours[userId] = [];
        }

        if (data.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous êtes déjà pointé.");
        }

        const now = new Date();
        data.hours[userId].push({ clockIn: now.toLocaleString(), clockOut: null });
        saveData();

        message.reply(`Vous êtes maintenant pointé à ${now.toLocaleString()}.`);

        if (data.settings.logChannel) {
            const logChannel = await client.channels.fetch(data.settings.logChannel);
            logChannel.send(`<@${userId}> a pointé à ${now.toLocaleString()}.`);
        }
    }
});

// Commande .clockout
client.on('messageCreate', async (message) => {
    if (message.content === '.clockout') {
        if (data.settings.allowedRole && !message.member.roles.cache.has(data.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        const userId = message.author.id;
        if (!Array.isArray(data.hours[userId]) || !data.hours[userId].some(entry => entry.clockOut === null)) {
            return message.reply("Vous n'êtes pas pointé.");
        }

        const now = new Date();
        const entry = data.hours[userId].find(entry => entry.clockOut === null);
        entry.clockOut = now.toLocaleString();
        saveData();

        message.reply(`Vous êtes maintenant sorti à ${now.toLocaleString()}.`);

        if (data.settings.logChannel) {
            const logChannel = await client.channels.fetch(data.settings.logChannel);
            logChannel.send(`<@${userId}> a quitté à ${now.toLocaleString()}.`);
        }
    }
});

// Commande .clockview
client.on('messageCreate', (message) => {
    if (message.content === '.clockview') {
        if (data.settings.allowedRole && !message.member.roles.cache.has(data.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        const userId = message.author.id;
        if (!Array.isArray(data.hours[userId])) {
            return message.reply("Aucune heure enregistrée pour vous.");
        }

        let userHours = `Historique des heures de ${message.author.username} :\n`;
        let totalMilliseconds = 0;
        
        data.hours[userId].forEach(entry => {
            const clockIn = new Date(entry.clockIn);
            const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
            const clockOutText = clockOut ? clockOut.toLocaleString() : 'Non sorti';
            userHours += `Entrée: ${clockIn.toLocaleString()}, Sortie: ${clockOutText}\n`;
            
            if (clockOut) {
                totalMilliseconds += clockOut - clockIn;
            }
        });
        
        const totalHours = Math.floor(totalMilliseconds / 3600000);
        const totalMinutes = Math.floor((totalMilliseconds % 3600000) / 60000);
        userHours += `\nTotal des heures: ${totalHours}h ${totalMinutes}m`;
        
        message.reply(userHours);
    }
});

// Commande .clockshow
client.on('messageCreate', (message) => {
    if (message.content === '.clockshow') {
        if (data.settings.allowedRole && !message.member.roles.cache.has(data.settings.allowedRole)) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.");
        }

        let report = "Liste des membres ayant pointé :\n";
        
        Object.keys(data.hours).forEach(userId => {
            let totalMilliseconds = 0;
            let history = `\nHistorique des heures de <@${userId}> :\n`;
            
            data.hours[userId].forEach(entry => {
                const clockIn = new Date(entry.clockIn);
                const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
                const clockOutText = clockOut ? clockOut.toLocaleString() : 'Non sorti';
                history += `Entrée: ${clockIn.toLocaleString()}, Sortie: ${clockOutText}\n`;
                
                if (clockOut) {
                    totalMilliseconds += clockOut - clockIn;
                }
            });
            
            const totalHours = Math.floor(totalMilliseconds / 3600000);
            const totalMinutes = Math.floor((totalMilliseconds % 3600000) / 60000);
            report += `<@${userId}> : ${totalHours}h ${totalMinutes}m${history}\n`;
        });
        
        message.channel.send(report);
    }
});

// Commande .clockset log (non incluse dans .clock)
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('.clockset log')) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply("Vous devez avoir les permissions d'administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const channelId = args[2];

        const channel = await message.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return message.reply("Le canal spécifié est invalide.");
        }

        data.settings.logChannel = channelId;
        saveData();
        message.reply(`Le canal de logs a été défini sur ${channel.name}.`);
    }
});

// Commande .clockset role (non incluse dans .clock)
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('.clockset role')) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply("Vous devez avoir les permissions d'administrateur pour utiliser cette commande.");
        }

        const args = message.content.split(' ');
        const roleId = args[2];

        const role = await message.guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
            return message.reply("Le rôle spécifié est invalide.");
        }

        data.settings.allowedRole = roleId;
        saveData();
        message.reply(`Le rôle autorisé a été défini sur ${role.name}.`);
    }
});

// Connexion du bot
client.login(process.env.TOKEN);
