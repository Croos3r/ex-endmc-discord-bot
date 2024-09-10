import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	EmbedBuilder,
	type MessageActionRowComponentBuilder,
} from "discord.js";
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { getCachedByIdOrCacheResult } from "./Cache.js";
import { type PokemonDetails, getPokemonDetails } from "./PokeAPI.js";
import { POKEMON_MAX_STAT_VALUE, POKEMON_STAT_PROGRESS_BAR_SIZE } from "./helpers/constants.js";

@Discord()
@SlashGroup({ name: "pokedex", description: "Pokedex commands" })
@SlashGroup("pokedex")
export class Pokedex {
	static homeEmbedAndComponents(pokemonDetails: PokemonDetails) {
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

	@Slash({ description: "Get a pokemon details" })
	async pokemon(
		@SlashOption({
			name: "pokemon-name-or-id",
			description: "Pokemon's name or id",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		pokemonName: string,
		interaction: CommandInteraction,
	) {
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(pokemonName.toLowerCase());
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${lowerCaseURLEncodedPokemonName}`, () =>
			getPokemonDetails(lowerCaseURLEncodedPokemonName),
		).catch((error) => {
			if (error.response?.status !== 404) {
				console.log(error);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown") return await interaction.reply("Unknown pokemon");
		if (pokemonDetails === "error") return await interaction.reply("An error occurred");
		await interaction.reply({
			ephemeral: true,
			...Pokedex.homeEmbedAndComponents(pokemonDetails),
		});
	}

	@ButtonComponent({ id: /base-stats-\d+/ })
	async baseStats(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[2];
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemonId}`, () => getPokemonDetails(pokemonId));

		await interaction.update({
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
		});
	}

	@ButtonComponent({ id: /home-\d+/ })
	async home(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[1];
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemonId}`, () => getPokemonDetails(pokemonId));

		await interaction.reply({
			ephemeral: true,
			...Pokedex.homeEmbedAndComponents(pokemonDetails),
		});
	}
}
