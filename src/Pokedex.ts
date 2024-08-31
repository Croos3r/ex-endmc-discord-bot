import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type CommandInteraction,
	EmbedBuilder,
	type MessageActionRowComponentBuilder,
} from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { getCachedByIdOrCacheResult } from './Cache.js'
import { type PokemonDetails, getPokemonDetails } from './PokeAPI.js'

@Discord()
@SlashGroup({ name: "pokedex", description: "Pokedex commands" })
@SlashGroup("pokedex")
export class Pokedex {
	static homeEmbedAndComponents(pokemonDetails: PokemonDetails) {
		return {
			embeds: [
				new EmbedBuilder()
					.setColor('Red')
					.setThumbnail(pokemonDetails.spriteURL)
					.setFooter({text: `HOME -> ${pokemonDetails.name} | #${pokemonDetails.id}`})
					.setTitle(`${pokemonDetails.name} | #${pokemonDetails.id}`)
					.setDescription(`
					\`📜\` **About**
					**Species** ${pokemonDetails.species}
					**Abilities** ${pokemonDetails.abilities.join(", ")}
					**Color** ${pokemonDetails.color}
					**Capture Rate** ${pokemonDetails.captureRate}
					**Habitat** ${pokemonDetails.habitat}
					**Types** ${pokemonDetails.types.join(", ")}
					
					\`🥚\` **Egg Groups**
					**Egg Groups** ${pokemonDetails.eggGroups.join(", ")}
					`)
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>({
					components: [
						new ButtonBuilder()
							.setLabel("BASE STATS")
							.setEmoji("➡")
							.setStyle(ButtonStyle.Primary)
							.setCustomId(`base-stats-${pokemonDetails.id}`)
					]
				})
			]
		}
	}

	@Slash({ description: "Get a pokemon details" })
	async pokemon(
		@SlashOption({
			name: "pokemon-name-or-id",
			description: "Pokemon's name or id",
			type: ApplicationCommandOptionType.String
		})
		pokemonName: string,
		interaction: CommandInteraction
	): Promise<void> {
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(pokemonName.toLowerCase())
		const pokemonDetails = await getCachedByIdOrCacheResult(lowerCaseURLEncodedPokemonName, () => getPokemonDetails(pokemonName))

		await interaction.reply(Pokedex.homeEmbedAndComponents(pokemonDetails))
	}

	@ButtonComponent({id: /base-stats-\d+/})
	async baseStats(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[2]
		const pokemonDetails = await getCachedByIdOrCacheResult(pokemonId, () => getPokemonDetails(pokemonId))

		await interaction.update({
			embeds: [
				new EmbedBuilder()
					.setColor('Red')
					.setThumbnail(pokemonDetails.spriteURL)
					.setFooter({text: `BASE STATS -> ${pokemonDetails.name} | #${pokemonDetails.id}`})
					.setTitle(`${pokemonDetails.name} | #${pokemonDetails.id}`)
					.setDescription(`
					\`📜\` **Base Stats**
					${pokemonDetails.stats.map(({name, stat}) => `**${name}** (${stat})\n\`${"#".repeat(stat/100*30)}${"-".repeat(30-stat/100*30)}\``).join("\n")}
					`)
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>({
					components: [
						new ButtonBuilder()
							.setLabel("ABOUT")
							.setEmoji("⬅")
							.setStyle(ButtonStyle.Primary)
							.setCustomId(`home-${pokemonDetails.id}`)
					]
				})
			]
		})
	}

	@ButtonComponent({id: /home-\d+/})
	async home(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[1]
		const pokemonDetails = await getCachedByIdOrCacheResult(pokemonId, () => getPokemonDetails(pokemonId))

		await interaction.update(Pokedex.homeEmbedAndComponents(pokemonDetails))
	}
}
