import {
	type APIEmbed,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type InteractionReplyOptions,
	type MessageActionRowComponentBuilder,
	type User,
} from 'discord.js'
import { CONFIGURATION } from '../configuration.service.js'
import type Pokemon from '../entities/Pokemon.js'
import type { PokemonDetails } from '../poke-api.service.js'
import { POKEMON_MAX_STAT_VALUE, POKEMON_STAT_PROGRESS_BAR_SIZE } from './constants.js'

export function createContentMessage(content: string) {
	return { content };
}

export function createEmbedMessage(embed: APIEmbed) {
	return { embeds: [embed] };
}

export function createEphemeralMessage(fields: InteractionReplyOptions) {
	return { ...fields, ephemeral: true };
}

export function createEphemeralContentMessage(content: string) {
	return createEphemeralMessage({ content });
}

export function createEphemeralEmbedMessage(embed: APIEmbed) {
	return createEphemeralMessage({ embeds: [embed] });
}

export function createEmptyPCMessage(user: User) {
	return {
		content: `${user.displayName}'s PC is empty`,
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>({
				components: [
					new ButtonBuilder()
						.setLabel("Refresh")
						.setEmoji("🔃")
						.setStyle(ButtonStyle.Secondary)
						.setCustomId(`pc-page-1-${user.id}`),
				],
			}),
		],
	};
}

export function createPCPageMessage(
	user: User,
	pageNumber: number,
	maxPage: number,
	pcPagePokemons: Array<Pokemon & ({ error: "unknown" | "error" } | { name: string })>,
) {
	return {
		embeds: [
			new EmbedBuilder()
				.setTitle(`${user.displayName}'s PC`)
				.setFooter({ text: `Page ${pageNumber}/${maxPage}` })
				.addFields(
					pcPagePokemons.map((pokemon) => {
						if ("error" in pokemon) {
							if (pokemon.error === "unknown")
								return {
									name: `Unknown Pokemon #${pokemon.pokeAPIId}`,
									value: `Level: ${pokemon.level}`,
									inline: true,
								};
							return {
								name: `Unknown Pokemon #${pokemon.pokeAPIId}`,
								value: `Level: ${pokemon.level} - Error: Could not fetch details`,
								inline: true,
							};
						}
						return {
							name: `${pokemon.id}. ${pokemon.name} (#${pokemon.pokeAPIId})`,
							value: `Level: ${pokemon.level}`,
							inline: true,
						};
					}),
				),
		],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>({
				components: [
					new ButtonBuilder()
						.setLabel("Previous")
						.setEmoji("⬅")
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`pc-page-${pageNumber - 1}-${user.id}`)
						.setDisabled(pageNumber === 1),
					new ButtonBuilder()
						.setLabel("Refresh")
						.setEmoji("🔃")
						.setStyle(ButtonStyle.Secondary)
						.setCustomId(`pc-page-${pageNumber}-${user.id}`),
					new ButtonBuilder()
						.setLabel("Next")
						.setEmoji("➡")
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`pc-page-${pageNumber + 1}-${user.id}`)
						.setDisabled(pageNumber === maxPage),
				],
			}),
		],
	};
}

export function createPCPokemonViewMessage(user: User, pokemonDetails: PokemonDetails, pokemon: Pokemon) {
	// noinspection JSUnusedLocalSymbols: level is destructured to allow the configuration to use it and to be evaluated
	const { level, health, attack, defense, specialAttack, specialDefense, speed } = pokemon;
	const stats = [health, attack, defense, specialAttack, specialDefense, speed];
	return {
		embeds: [
			new EmbedBuilder()
				.setTitle(`${pokemonDetails.name} (No. ${pokemon.id}/#${pokemon.pokeAPIId})`)
				// biome-ignore lint/security/noGlobalEval: only way to let the configuration have a formula
				.setDescription(`Level: ${pokemon.level} (${pokemon.experience}/${eval(CONFIGURATION.leveling.experiencePerLevel)})
					${pokemonDetails.stats
						.map(
							({ name }, index) =>
								`**${name}** (${stats[index]})\n\`${"#".repeat((stats[index] / POKEMON_MAX_STAT_VALUE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}${"-".repeat(POKEMON_STAT_PROGRESS_BAR_SIZE - (stats[index] / POKEMON_MAX_STAT_VALUE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}\``,
						)
						.join("\n")}`),
		],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>({
				components: [
					new ButtonBuilder()
						.setLabel("Refresh")
						.setEmoji("🔃")
						.setStyle(ButtonStyle.Secondary)
						.setCustomId(`pokemon-view-${pokemon.id}-${user.id}`),
				],
			}),
		],
	};
}

export function createPokedexBaseStatsPokemonMessage(pokemonDetails: PokemonDetails) {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("Red")
				.setThumbnail(pokemonDetails.spriteURL)
				.setFooter({
					text: `BASE STATS -> ${pokemonDetails.name} | #${pokemonDetails.id}`,
				})
				.setTitle(`${pokemonDetails.name} | #${pokemonDetails.id}`)
				.setDescription(`
					\`📜\` **Base Stats**
					${pokemonDetails.stats.map(({ name, stat }) => `**${name}** (${stat})\n\`${"#".repeat((stat / POKEMON_MAX_STAT_VALUE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}${"-".repeat(POKEMON_STAT_PROGRESS_BAR_SIZE - (stat / POKEMON_STAT_PROGRESS_BAR_SIZE) * POKEMON_STAT_PROGRESS_BAR_SIZE)}\``).join("\n")}
				`),
		],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>({
				components: [
					new ButtonBuilder()
						.setLabel("ABOUT")
						.setEmoji("⬅")
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`home-${pokemonDetails.id}`),
				],
			}),
		],
	};
}

export function createPokedexPokemonHomeMessage(pokemonDetails: PokemonDetails) {
	return {
		embeds: [
			new EmbedBuilder()
				.setColor("Red")
				.setThumbnail(pokemonDetails.spriteURL)
				.setFooter({
					text: `HOME -> ${pokemonDetails.name} | #${pokemonDetails.id}`,
				})
				.setTitle(`${pokemonDetails.name} | #${pokemonDetails.id}`)
				.setDescription(`
					\`📜\` **About**
					**Species** ${pokemonDetails.species}
					**Abilities** ${pokemonDetails.abilities.join(", ")}
					**Color** ${pokemonDetails.color}
					**Capture Rate** ${pokemonDetails.captureRate}
					**Habitat** ${pokemonDetails.habitat ?? "Unknown"}
					**Types** ${pokemonDetails.types.join(", ")}
					
					\`🥚\` **Egg Groups**
					**Egg Groups** ${pokemonDetails.eggGroups.length > 0 ? pokemonDetails.eggGroups.join(", ") : "Unknown"}
				`),
		],
		components: [
			new ActionRowBuilder<MessageActionRowComponentBuilder>({
				components: [
					new ButtonBuilder()
						.setLabel("BASE STATS")
						.setEmoji("➡")
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`base-stats-${pokemonDetails.id}`),
				],
			}),
		],
	};
}

export function createEmptyInventoryMessage(user: User) {
	return {
		content: `${user.displayName}'s inventory is empty.\n Use \`/pc inventory add\` to add pokemons`,
		components: [createRefreshButton(user)],
	};
}

export function createInventoryMessage(
	user: User,
	inventoryPokemons: Array<Pokemon & ({ error: "unknown" | "error" } | { name: string })>,
) {
	return {
		embeds: [
			new EmbedBuilder()
				.setTitle(`${user.displayName}'s Inventory`)
				.addFields(
					inventoryPokemons.map((pokemon, index) => {
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
		components: [createRefreshButton(user)],
	};
}

// Should use builder pattern but really time-consuming to implement in this case
export function createRefreshButton(user: User) {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>({
		components: [
			new ButtonBuilder()
				.setLabel("Refresh")
				.setEmoji("🔃")
				.setStyle(ButtonStyle.Secondary)
				.setCustomId(`inventory-refresh-${user.id}`),
		],
	});
}
