/*
Credits:
- ChatGPT
- Copilot
- Mystic's Collei bot
*/

const { Command } = require('./classes/command.js');
const Canvas = require('canvas');

class FakeQuote extends Command {
    constructor(client){
        super(client, "fakequote", "fake make it a quote", [
            {
                name: "person",
                description: "person to quote",
                type: 6,
                required: true
            },
            {
                name: "message",
                description: "message",
                type: 3,
                required: true
            },
            {
                name: "nickname",
                description: "nickname of the person",
                type: 3,
                required: false
            },
            {
                name: "background",
                description: "background color (black or white)",
                type: 3,
                required: false,
                choices: [
                    { name: 'Black', value: 'black' },
                    { name: 'White', value: 'white' }
                ]
            }
        ]);
    }

    async run(interaction){
        try{
            const person = interaction.options.getUser("person");
            const username = person.username;
            const nickname = interaction.options.getString("nickname") || username;
            const message = `"${interaction.options.getString("message")}"`;
            const backgroundColor = interaction.options.getString("background") || 'black';
            const textColor = backgroundColor === 'white' ? 'black' : 'white';
            const pfp = await person.displayAvatarURL({ extension: 'png', size: 512 });

            const canvas = Canvas.createCanvas(1024, 512);
            const ctx = canvas.getContext('2d');
            console.log("Created canvas");

            // Set background color
            ctx.fillStyle = backgroundColor === 'white' ? '#ffffff' : '#000000';
            ctx.fillRect(0, 0, 1024, 512);
            console.log(`Filled ${backgroundColor} background`);

            // pfp on left
            const pfpImage = await Canvas.loadImage(pfp);
            ctx.drawImage(pfpImage, 0, 0, 512, 512);
            console.log("Drew pfp");

            // text on right
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const maxWidth = 480;
            let fontSize = 36;

            // Create gradient based on background color
            const gradient = ctx.createLinearGradient(384, 0, 512, 0);
            if (backgroundColor === 'white') {
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0)'); // Start transparent
                gradient.addColorStop(1, 'rgba(255, 255, 255, 1)'); // End white
            } else {
                gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Start transparent
                gradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // End black
            }

            ctx.fillStyle = gradient;
            ctx.fillRect(384, 0, 128, 512);
            console.log("Filled gradient");

            ctx.fillStyle = textColor;

            // Split text into lines and adjust font size if necessary
            const lines = this.wrapText(ctx, message, maxWidth, fontSize);
            fontSize = this.adjustFontSize(ctx, lines, maxWidth, fontSize);
            ctx.font = `italic ${fontSize}px sans-serif`;

            // Calculate total text height
            let lineHeight = fontSize * 1.2;
            let textHeight = lines.length * lineHeight;
            let nicknameHeight = 36; // Height of the nickname font
            let usernameHeight = 24; // Height of the username font
            let nicknameMargin = 10; // Margin below the quote for the nickname
            let usernameMargin = 50; // Margin below the quote for the username

            // Calculate total height including nickname and username
            let totalHeight = textHeight + nicknameHeight + nicknameMargin;
            if (username !== nickname) {
                totalHeight += usernameHeight + usernameMargin;
            }

            // Calculate starting Y position to center the text vertically
            let textY = (ctx.canvas.height - totalHeight) / 2;

            // Draw each line of text
            lines.forEach((line, index) => {
                ctx.fillText(`${line}`, 768, textY + (index * lineHeight));
            });
            console.log("Drew quote");

            // Draw nickname
            ctx.fillStyle = textColor;
            ctx.font = '36px sans-serif';
            ctx.fillText(`- ${nickname}`, 768, textY + textHeight + nicknameMargin);
            console.log("Drew nickname");

            // Draw username if different from nickname
            if (username !== nickname) {
                ctx.fillStyle = '#808080';
                ctx.font = '24px sans-serif';
                ctx.fillText(`@${username}`, 768, textY + textHeight + nicknameMargin + usernameMargin);
                console.log("Drew username");
            }

            // footer
            ctx.fillStyle = '#808080';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('silverwolf', 1014, 502);

            // test send
            await interaction.editReply({ files: [canvas.toBuffer()] });
        }catch(error){
            console.error(error);
            await interaction.editReply("Error: " + error.message);
        }
    }

    wrapText(ctx, text, maxWidth, fontSize) {
        ctx.font = `italic ${fontSize}px sans-serif`;
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + ' ' + word).width;
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    adjustFontSize(ctx, lines, maxWidth, fontSize) {
        ctx.font = `italic ${fontSize}px sans-serif`;

        // Check if the text fits within the canvas
        let lineHeight = fontSize * 1.2;
        let totalHeight = lines.length * lineHeight;

        while (totalHeight > 350 || lines.some(line => ctx.measureText(line).width > maxWidth)) {
            fontSize -= 1;
            ctx.font = `italic ${fontSize}px sans-serif`;
            lineHeight = fontSize * 1.2;
            totalHeight = lines.length * lineHeight;
        }

        return fontSize;
    }
}

module.exports = FakeQuote;