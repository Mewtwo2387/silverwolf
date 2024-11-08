const { Client, REST, Routes, EmbedBuilder, escapeMarkdown, AttachmentBuilder } = require("discord.js");
const { Database } = require("./database.js");
const fs = require("fs");
const path = require("path");
const BirthdayScheduler = require('./birthdayScheduler');
const Canvas = require('canvas');
const { log } = require('../utils/log');
// const CharacterAI = require('node_characterai')
require('dotenv').config();


class ChristmasHandler {
    //christmas
    async summonPokemon(message, mode = "normal") {
        const allMembers = await message.guild.members.fetch();
        const members = allMembers.filter(member => !member.user.bot);
        const member = members.random();
        const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
    
        if (mode === "shiny" || (mode === "normal" && Math.random() < 0.03)) {
            log("Santa Pokemon")
            const canvasSize = 512;
            const canvas = Canvas.createCanvas(canvasSize, canvasSize);
            const ctx = canvas.getContext("2d");
        
            // Load the profile picture and draw it on the canvas
            const img = await Canvas.loadImage(pfp);
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
        
            // Apply a red tint to the profile picture
            const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(data[i] + 50, 255);     // Increase red
                data[i + 1] = Math.max(data[i + 1] - 30, 0); // Reduce green
                data[i + 2] = Math.max(data[i + 2] - 30, 0); // Reduce blue
            }
            ctx.putImageData(imageData, 0, 0);
        
            // Load and overlay the Christmas snow image
            const snowOverlayPath = path.join(__dirname, '../data/images/1christmasSnow.png');
            const snowOverlay = await Canvas.loadImage(snowOverlayPath);
            ctx.drawImage(snowOverlay, 0, 0, canvasSize, canvasSize);
        
            // Load and overlay the Christmas decoration image
            const decoOverlayPath = path.join(__dirname, '../data/images/1christmasDeco.png');
            const decoOverlay = await Canvas.loadImage(decoOverlayPath);
            ctx.drawImage(decoOverlay, 0, 0, canvasSize, canvasSize);
        
            // Convert to buffer and send as attachment
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
            message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`A Santa ${escapeMarkdown(member.user.username)} appeared!`)
                        .setImage('attachment://shiny.png')
                        .setColor("#00FF00")
                        .setFooter({ text: "catch them with /catch santa [username]!" })
                ],
                files: [attachment]
            });
            this.currentPokemon = "santa " + member.user.username;
        } else if (mode === "mystery" || (mode === "normal" && Math.random() < 0.3)) {
            // Load the mystery border
            const borderPath = path.join(__dirname, '../data/images/3christmasBorder.png');
            const borderImg = await Canvas.loadImage(borderPath);
    
            // Create a canvas to fit both profile picture and border
            const canvasSize = 512;
            const canvas = Canvas.createCanvas(canvasSize, canvasSize);
            const ctx = canvas.getContext("2d");
    
            // Load profile picture and scale it to fit the canvas
            const img = await Canvas.loadImage(pfp);
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
    
            // Scale and overlay the border image
            ctx.drawImage(borderImg, 0, 0, canvasSize, canvasSize);
    
            // Send the final image as an attachment
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'mystery.png' });
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ??? appeared!`)
                .setImage('attachment://mystery.png')
                .setColor("#00FF00")
                .setFooter({ text: "guess the username and catch with /catch [username]!" })
            ], files: [attachment]});
            this.currentPokemon = member.user.username;
        } else {
            log("Normal Pokemon")
            // Load the border image
            const borderPath = path.join(__dirname, '../data/images/1christmasBorder.png');
            const borderImg = await Canvas.loadImage(borderPath);
            
            // Create a canvas to fit both profile picture and border
            const canvasSize = 512;
            const canvas = Canvas.createCanvas(canvasSize, canvasSize);
            const ctx = canvas.getContext("2d");
    
            // Load profile picture and scale it to fit the canvas
            const img = await Canvas.loadImage(pfp);
            ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
    
            // Scale and overlay the border image
            ctx.drawImage(borderImg, 0, 0, canvasSize, canvasSize);
    
            // Send the final image as an attachment
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'normal.png' });
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
                .setImage('attachment://normal.png')
                .setColor("#00FF00")
                .setFooter({ text: "catch them with /catch [username]!" })
            ], files: [attachment]});
            this.currentPokemon = member.user.username;
        }
    }
}

class NormalHandler {
    //normal
    async summonPokemon(message, mode = "normal"){
        const allMembers = await message.guild.members.fetch();
        const members = allMembers.filter(member => !member.user.bot);
        const member = members.random();
        //console.log(member)
        const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
        if (mode == "shiny" || (mode == "normal" && Math.random() < 0.03)){
            log("Shiny Pokemon")
            const canvas = Canvas.createCanvas(512, 512);
            const ctx = canvas.getContext("2d");
            const img = await Canvas.loadImage(pfp);
            ctx.drawImage(img, 0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;

            // Invert colors
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];       // Red
                data[i + 1] = 255 - data[i + 1]; // Green
                data[i + 2] = 255 - data[i + 2]; // Blue
                // Alpha (data[i + 3]) remains unchanged
            }

            ctx.putImageData(imageData, 0, 0);

            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A shiny ${escapeMarkdown(member.user.username)} appeared!`)
                .setImage('attachment://shiny.png')
                .setColor("#00FF00")
                .setFooter({ text: "catch them with /catch [username] shiny!" })
            ], files: [attachment]})
            this.currentPokemon = member.user.username + " shiny";
        }else if (mode == "mystery" || (mode == "normal" && Math.random() < 0.3)){
            log("Mystery Pokemon")
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ??? appeared!`)
                .setImage(pfp)
                .setColor("#00FF00")
                .setFooter({ text: "guess the username and catch with /catch [username]!" })
            ]})
            this.currentPokemon = member.user.username;
        }else{
            log("Normal Pokemon")
            message.channel.send({ embeds:[ new EmbedBuilder()
                .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
                .setImage(pfp)
                .setColor("#00FF00")
                .setFooter({ text: "catch them with /catch [username]!" })
            ]})
            this.currentPokemon = member.user.username;
        }
    }
}

class HalloweenHandler {
    //halloween
    async summonPokemon(message, mode = "normal") {
        const allMembers = await message.guild.members.fetch();
        const members = allMembers.filter(member => !member.user.bot);
        const member = members.random();
        const pfp = await member.user.displayAvatarURL({ extension: 'png', size: 512 });
    
        // Helper function to apply a lighter red tint to the canvas
        function applyRedTint(ctx, img) {
            ctx.drawImage(img, 0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(data[i] + 100, 255); // Increase red
                data[i + 1] = data[i + 1] * 0.5; // Reduce green
                data[i + 2] = data[i + 2] * 0.5; // Reduce blue
            }
            ctx.putImageData(imageData, 0, 0);
        }
    
        // Helper function to apply color inversion
        function applyColorInversion(ctx, img) {
            ctx.drawImage(img, 0, 0, 512, 512);
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];       // Invert Red
                data[i + 1] = 255 - data[i + 1]; // Invert Green
                data[i + 2] = 255 - data[i + 2]; // Invert Blue
            }
            ctx.putImageData(imageData, 0, 0);
        }
    
        if (mode === "shiny" || (mode === "normal" && Math.random() < 0.03)) {
            log("Nightmare Mode Pokemon")
            const canvas = Canvas.createCanvas(512, 512);
            const ctx = canvas.getContext("2d");
            const img = await Canvas.loadImage(pfp);
    
            // Apply color inversion and red tint with colorful static for "shiny"
            applyColorInversion(ctx, img);
    
            const imageData = ctx.getImageData(0, 0, 512, 512);
            const data = imageData.data;
    
            // Apply red tint and colorful static noise
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(data[i] + 100, 255); // Red tint
                data[i + 1] = data[i + 1] * 0.5;
                data[i + 2] = data[i + 2] * 0.5;
    
                if (Math.random() < 0.4) {
                    const noiseRed = Math.floor(Math.random() * 120) - 60;
                    const noiseGreen = Math.floor(Math.random() * 120) - 60;
                    const noiseBlue = Math.floor(Math.random() * 120) - 60;
    
                    data[i] = Math.min(Math.max(data[i] + noiseRed, 0), 255);
                    data[i + 1] = Math.min(Math.max(data[i + 1] + noiseGreen, 0), 255);
                    data[i + 2] = Math.min(Math.max(data[i + 2] + noiseBlue, 0), 255);
                }
            }
    
            ctx.putImageData(imageData, 0, 0);
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'shiny.png' });
    
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle(`A nightmare mode ${escapeMarkdown(member.user.username)} appeared!`)
                    .setImage('attachment://shiny.png')
                    .setColor("#00FF00")
                    .setFooter({ text: "Nightmarish Halloween! Catch it with /catch Nightmare mode [username]!" })
                ],
                files: [attachment]
            });
            this.currentPokemon = "Nightmare mode "+ member.user.username ;
    
        } else if (mode === "mystery" || (mode === "normal" && Math.random() < 0.3)) {
            log("Mystery Pokemon")
            // Apply only color inversion for "mystery"
            const canvas = Canvas.createCanvas(512, 512);
            const ctx = canvas.getContext("2d");
            const img = await Canvas.loadImage(pfp);
            applyColorInversion(ctx, img);
    
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'mystery.png' });
    
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle(`A wild ??? appeared!`)
                    .setImage('attachment://mystery.png')
                    .setColor("#00FF00")
                    .setFooter({ text: "Horror Halloween! Guess the username and catch with /catch [username]!" })
                ],
                files: [attachment]
            });
            this.currentPokemon = member.user.username;
    
        } else {
            log("Normal Pokemon")
            // Apply only red tint for normal
            const canvas = Canvas.createCanvas(512, 512);
            const ctx = canvas.getContext("2d");
            const img = await Canvas.loadImage(pfp);
            applyRedTint(ctx, img);
    
            const buffer = canvas.toBuffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'normal.png' });
    
            message.channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle(`A wild ${escapeMarkdown(member.user.username)} appeared!`)
                    .setImage('attachment://normal.png')
                    .setColor("#00FF00")
                    .setFooter({ text: "Spooky Halloween! Catch it with /catch [username]!" })
                ],
                files: [attachment]
            });
            this.currentPokemon = member.user.username;
        }
    }
}

module.exports = {
    ChristmasHandler,
    NormalHandler,
    HalloweenHandler
};