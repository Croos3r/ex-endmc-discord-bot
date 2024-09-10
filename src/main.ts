import { dirname, importx } from "@discordx/importer";
import type { Interaction } from "discord.js";
import { IntentsBitField } from "discord.js";
import { Client } from "discordx";
import { configDotenv } from "dotenv";
import "reflect-metadata";

configDotenv({ path: ".env" });

export const bot = new Client({
	// To use only guild command
	botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

	// Discord intents
	intents: [
		IntentsBitField.Flags.Guilds,
		IntentsBitField.Flags.GuildMembers,
		IntentsBitField.Flags.GuildMessages,
		IntentsBitField.Flags.DirectMessages,
	],

	// Debug logs are disabled in silent mode
	silent: false,

	// Configuration for @SimpleCommand
	// simpleCommand: {
	//   prefix: "!",
	// },
});

bot.once("ready", async () => {
	// Make sure all guilds are cached
	await bot.guilds.fetch();

	// Synchronize applications commands with Discord
	// noinspection ES6MissingAwait: No need to await this
	bot.initApplicationCommands();

	// To clear all guild commands, uncomment this line,
	// This is useful when moving from guild commands to global commands
	// It must only be executed once
	//
	//  await bot.clearApplicationCommands(
	//    ...bot.guilds.cache.map((g) => g.id)
	//  );

	console.log("Bot started");
});

bot.on("interactionCreate", (interaction: Interaction) => {
	bot.executeInteraction(interaction);
});

async function run() {
	// The following syntax should be used in the commonjs environment
	// await importx(__dirname + '/{events,commands}/**/*.{ts,js}')

	// The following syntax should be used in the ECMAScript environment
	await importx(
		`${dirname(import.meta.url)}/{Pokedex,Storage,Inventory,Database,Configuration}.{ts,js}`,
	);

	// Let's start the bot
	if (!process.env.BOT_TOKEN) {
		throw Error("Could not find BOT_TOKEN in your environment");
	}

	// Log in with your bot token
	await bot.login(process.env.BOT_TOKEN);
}

void run();
