import { ApplicationCommandOptionType, type ButtonInteraction, type CommandInteraction, type User } from 'discord.js'
import { type ArgsOf, ButtonComponent, Discord, On, Slash, SlashGroup, SlashOption } from 'discordx'
import { invalidateCache, isDelayKeyActive, setDelayKey } from '../cache.service.js'
import { CONFIGURATION } from '../configuration.service.js'
import DATA_SOURCE from '../database.service.js'
import Pokemon from '../entities/Pokemon.js'
import {
	createEmptyInventoryMessage,
	createEphemeralContentMessage,
	createEphemeralMessage,
	createInventoryMessage,
} from '../helpers/ui.js'
import { getDatabasePokemonDetails } from '../storage/storage.service.js'
import { getInventoryPokemons, isInventoryFull } from './inventory.service.js'

@Discord()
@SlashGroup({
	name: "inventory",
	description: "Inventory commands",
	root: "pc",
})
@SlashGroup("inventory", "pc")
export class InventoryController {
	static async getInventoryComponents(targetUser: User) {
		const inventoryPokemons = await getInventoryPokemons(targetUser);
		if (inventoryPokemons.length === 0) return createEmptyInventoryMessage(targetUser);
		return createInventoryMessage(targetUser, inventoryPokemons);
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
		user: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;
		const inventoryPageComponents = await InventoryController.getInventoryComponents(targetUser);
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
		user: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const pokemonToTransfer = await pokemons.findOne({ where: { id: pokemon, storedBy: targetUser.id } });

		if (!pokemonToTransfer)
			return await interaction.reply(
				createEphemeralContentMessage(`Pokemon not found in ${targetUser.displayName}'s PC`),
			);
		if (await isInventoryFull(targetUser))
			return await interaction.reply(createEphemeralContentMessage("Your inventory is full"));
		pokemonToTransfer.heldBy = targetUser.id;
		pokemonToTransfer.storedBy = null;
		await pokemons.save(pokemonToTransfer);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await invalidateCache(`inventory:full:${targetUser.id}`);
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
		user: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user;
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const pokemonToTransfer = await pokemons.findOne({ where: { id: pokemon, heldBy: targetUser.id } });

		if (!pokemonToTransfer)
			return await interaction.reply(
				createEphemeralContentMessage(`Pokemon not found in ${targetUser.displayName}'s inventory`),
			);
		pokemonToTransfer.heldBy = null;
		pokemonToTransfer.storedBy = targetUser.id;
		await pokemons.save(pokemonToTransfer);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await invalidateCache(`inventory:full:${targetUser.id}`);
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
		const user = message.author;

		const isExperiencedDelayed = await isDelayKeyActive(`experience-delay:${user.id}`);

		if (isExperiencedDelayed) return;
		await setDelayKey(`experience-delay:${user.id}`, CONFIGURATION.leveling.experienceGainCooldown);
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const targetUsersInventoryPokemons = await pokemons.find({
			where: { heldBy: user.id },
			take: CONFIGURATION.inventory.size,
		});
		if (targetUsersInventoryPokemons.length === 0) return;
		await pokemons.save(
			await Promise.all(
				targetUsersInventoryPokemons.map(async (pokemon) => {
					let { level, experience, ...rest } = pokemon;
					const { health, attack, defense, specialAttack, specialDefense, speed } = rest;
					const pokemonDetails = await getDatabasePokemonDetails({ ...rest, experience, level });
					// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
					experience += Math.ceil(eval(CONFIGURATION.leveling.experiencePerMessage));
					let stats = [health, attack, defense, specialAttack, specialDefense, speed];
					// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
					if (experience >= Math.ceil(eval(CONFIGURATION.leveling.experiencePerLevel))) {
						experience = 0;
						level++;
						stats = stats.map(
							(stat) =>
								stat +
								CONFIGURATION.leveling.pointsAbilityPerLevel.min +
								Math.ceil(
									Math.random() * CONFIGURATION.leveling.pointsAbilityPerLevel.max -
										CONFIGURATION.leveling.pointsAbilityPerLevel.min,
								),
						);
						await user.send(
							`Your ${"error" in pokemonDetails ? "Unknown pokemon" : pokemonDetails.name} (No ${pokemonDetails.id}/#${pokemonDetails.pokeAPIId}) has leveled up to level ${level} you can check its new stat with /pc pokemon view ${pokemon.id}`,
						);
					}
					const [newHealth, newAttack, newDefense, newSpecialAttack, newSpecialDefense, newSpeed] = stats;

					return {
						...rest,
						level,
						experience,
						health: newHealth,
						attack: newAttack,
						defense: newDefense,
						specialAttack: newSpecialAttack,
						specialDefense: newSpecialDefense,
						speed: newSpeed,
					};
				}),
			),
		);
	}
}
