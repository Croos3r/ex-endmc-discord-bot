import { ApplicationCommandOptionType, type ButtonInteraction, type CommandInteraction, type User } from "discord.js";
import { type ArgsOf, ButtonComponent, Discord, On, Slash, SlashGroup, SlashOption } from "discordx";
import {
	createEmptyInventoryMessage,
	createEphemeralContentMessage,
	createEphemeralMessage,
	createInventoryMessage,
} from "../helpers/ui.js";
import { getDatabasePokemonDetails, getStoredPokemon, setPokemonStored } from "../storage/storage.service.js";
import {
	getHeldPokemon,
	getInventoryPokemons,
	isExperienceOnCooldown,
	isInventoryFull,
	setExperienceCooldown,
	setPokemonHeld,
	updateAllHeldPokemonsExperienceAndStats,
} from "./inventory.service.js";

@Discord()
@SlashGroup({
	name: "inventory",
	description: "Inventory commands",
	root: "pc",
})
@SlashGroup("inventory", "pc")
export class InventoryController {
	static async getInventoryComponents(trainer: User) {
		const inventoryPokemons = await getInventoryPokemons(trainer);
		if (inventoryPokemons.length === 0) return createEmptyInventoryMessage(trainer);
		return createInventoryMessage(trainer, inventoryPokemons);
	}

	@ButtonComponent({ id: /inventory-refresh-\d+/ })
	async refreshInventoryButton(interaction: ButtonInteraction) {
		const inventoryPageComponents = await InventoryController.getInventoryComponents(interaction.user);
		await interaction.update(inventoryPageComponents);
	}

	@Slash({ description: "View your inventory" })
	async view(
		@SlashOption({
			name: "user",
			description: "User to view the inventory of",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;
		const inventoryPageComponents = await InventoryController.getInventoryComponents(targetTrainer);
		await interaction.reply(createEphemeralMessage(inventoryPageComponents));
	}

	@Slash({ description: "Add a pokemon to your inventory" })
	async add(
		@SlashOption({
			name: "stored-pokemon-id",
			description: "Stored ID of the Pokemon to add to the inventory",
			required: true,
			type: ApplicationCommandOptionType.Number,
		})
		pokemon: number,
		@SlashOption({
			name: "user",
			description: "User to add the pokemon to",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;
		const pokemonToTransfer = await getStoredPokemon(targetTrainer, pokemon);

		if (!pokemonToTransfer)
			return await interaction.reply(
				createEphemeralContentMessage(`Pokemon not found in ${targetTrainer.displayName}'s PC`),
			);
		if (await isInventoryFull(targetTrainer))
			return await interaction.reply(createEphemeralContentMessage("Your inventory is full"));
		await setPokemonHeld(targetTrainer, pokemonToTransfer.id);
		const pokemonDetails = await getDatabasePokemonDetails(pokemonToTransfer);
		await interaction.reply(
			createEphemeralContentMessage(
				`Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) added to your inventory`,
			),
		);
	}

	@Slash({ description: "Remove a pokemon from your inventory" })
	async remove(
		@SlashOption({
			name: "held-pokemon-id",
			description: "Held ID of the Pokemon to remove from the inventory",
			required: true,
			type: ApplicationCommandOptionType.Number,
		})
		pokemon: number,
		@SlashOption({
			name: "user",
			description: "User to remove the pokemon from",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;
		const pokemonToTransfer = await getHeldPokemon(targetTrainer, pokemon);

		if (!pokemonToTransfer)
			return await interaction.reply(
				createEphemeralContentMessage(`Pokemon not found in ${targetTrainer.displayName}'s inventory`),
			);
		await setPokemonStored(targetTrainer, pokemonToTransfer.id);
		const pokemonDetails = await getDatabasePokemonDetails(pokemonToTransfer);
		await interaction.reply(
			createEphemeralContentMessage(
				`Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) removed from your inventory`,
			),
		);
	}

	@On({ event: "messageCreate" })
	async onMessageCreate([message]: ArgsOf<"messageCreate">) {
		if (message.author.bot) return;
		const trainer = message.author;

		const isExperiencedDelayed = await isExperienceOnCooldown(trainer);

		if (isExperiencedDelayed) return;
		await setExperienceCooldown(trainer);
		const targetUsersInventoryPokemons = await getInventoryPokemons(trainer);
		if (targetUsersInventoryPokemons.length === 0) return;
		await updateAllHeldPokemonsExperienceAndStats(trainer);
	}
}
