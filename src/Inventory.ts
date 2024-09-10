import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	EmbedBuilder,
	type MessageActionRowComponentBuilder,
	type User,
} from "discord.js";
import { type ArgsOf, ButtonComponent, Discord, On, Slash, SlashGroup, SlashOption } from "discordx";
import { getCachedByIdOrCacheResult, invalidateCache, isDelayKeyActive, setDelayKey } from "./Cache.js";
import { CONFIGURATION } from "./Configuration.js";
import DATA_SOURCE from "./Database.js";
import { Storage } from "./Storage.js";
import Pokemon from "./entities/Pokemon.js";

@Discord()
@SlashGroup({
	name: "inventory",
	description: "Inventory commands",
	root: "pc",
})
@SlashGroup("inventory", "pc")
export class Inventory {
	static async isInventoryFull(targetUser: User) {
		return await getCachedByIdOrCacheResult(`inventory:full:${targetUser.id}`, async () => {
			const pokemons = DATA_SOURCE.getRepository(Pokemon);
			return (await pokemons.count({ where: { heldBy: targetUser.id } })) >= CONFIGURATION.inventory.size;
		});
	}

	static async getInventoryComponents(targetUser: User) {
		const inventoryPokemons = await Inventory.getInventoryPokemons(targetUser);
		const refreshButton = new ActionRowBuilder<MessageActionRowComponentBuilder>({
			components: [
				new ButtonBuilder()
					.setLabel("Refresh")
					.setEmoji("🔃")
					.setStyle(ButtonStyle.Secondary)
					.setCustomId(`inventory-refresh-${targetUser.id}`),
			],
		});
		if (inventoryPokemons.length === 0)
			return {
				content: `${targetUser.displayName}'s inventory is empty.\n Use \`/pc inventory add\` to add pokemons`,
				components: [refreshButton],
			};
		return {
			content: "",
			embeds: [
				new EmbedBuilder()
					.setTitle(`${targetUser.displayName}'s Inventory`)
					.addFields(
						await Promise.all(
							inventoryPokemons.map(async (pokemon, index) => {
								if ("error" in pokemon)
									return {
										name: `Slot ${index + 1}`,
										value:
											pokemon.error === "unknown"
												? `Unknown Pokemon #${pokemon.pokeAPIId}`
												: `Error fetching Pokemon #${pokemon.pokeAPIId}`,
									};
								return {
									name: `Slot ${index + 1}`,
									value: `${pokemon.id}. ${pokemon.name} (#${pokemon.pokeAPIId})`,
								};
							}),
						),
					)
					.addFields(
						Array(CONFIGURATION.inventory.size - inventoryPokemons.length)
							.fill(1)
							.map((_, index) => {
								const slotNumber = inventoryPokemons.length + index + 1;
								return { name: `Slot ${slotNumber}`, value: "Empty" };
							}),
					),
			],
			components: [refreshButton],
		};
	}

	static async getInventoryPokemons(targetUser: User) {
		const pokemons = DATA_SOURCE.getRepository(Pokemon);
		const targetUsersInventoryPokemons = await pokemons.find({
			where: { heldBy: targetUser.id },
			take: CONFIGURATION.inventory.size,
		});
		if (targetUsersInventoryPokemons.length === 0) return [];

		return await Promise.all(targetUsersInventoryPokemons.map(Storage.getDatabasePokemonDetails));
	}

	@ButtonComponent({ id: /inventory-refresh-\d+/ })
	async refreshInventoryButton(interaction: ButtonInteraction) {
		await interaction.update({ ...(await Inventory.getInventoryComponents(interaction.user)) });
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
		await interaction.reply({ ephemeral: true, ...(await Inventory.getInventoryComponents(targetUser)) });
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
			return await interaction.reply({
				ephemeral: true,
				content: `Pokemon not found in ${targetUser.displayName}'s PC`,
			});
		if (await Inventory.isInventoryFull(targetUser))
			return await interaction.reply({ ephemeral: true, content: "Your inventory is full" });
		pokemonToTransfer.heldBy = targetUser.id;
		pokemonToTransfer.storedBy = null;
		await pokemons.save(pokemonToTransfer);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await invalidateCache(`inventory:full:${targetUser.id}`);
		const pokemonDetails = await Storage.getDatabasePokemonDetails(pokemonToTransfer);
		await interaction.reply({
			ephemeral: true,
			content: `Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) added to your inventory`,
		});
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
			return await interaction.reply({
				ephemeral: true,
				content: `Pokemon not found in ${targetUser.displayName}'s inventory`,
			});
		pokemonToTransfer.heldBy = null;
		pokemonToTransfer.storedBy = targetUser.id;
		await pokemons.save(pokemonToTransfer);
		await invalidateCache(`pc:max-page:${targetUser.id}`);
		await invalidateCache(`inventory:full:${targetUser.id}`);
		const pokemonDetails = await Storage.getDatabasePokemonDetails(pokemonToTransfer);
		await interaction.reply({
			ephemeral: true,
			content: `Pokemon No ${pokemonToTransfer.id} (Level ${pokemonToTransfer.level} ${"error" in pokemonDetails ? "Unknown" : pokemonDetails.name} (#${pokemonDetails.pokeAPIId})) removed from your inventory`,
		});
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
					const pokemonDetails = await Storage.getDatabasePokemonDetails({
						...rest,
						experience,
						level,
					});
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
