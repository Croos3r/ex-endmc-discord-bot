import { ApplicationCommandOptionType, type ButtonInteraction, ButtonStyle, type CommandInteraction } from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { getCachedByIdOrCacheResult } from '../cache.service.js'
import {
	createEphemeralContentMessage,
	createEphemeralMessage,
	createPokedexBaseStatsPokemonMessage,
	createPokedexPokemonHomeMessage,
} from '../helpers/ui.js'
import { getPokemonDetails } from '../poke-api.service.js'

@Discord()
@SlashGroup({ name: "pokedex", description: "Pokedex commands" })
@SlashGroup("pokedex")
export class PokedexController {
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
				console.error(`An error occured during fetch of pokemon's details ${pokemonName})`);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		await interaction.reply(createEphemeralMessage(createPokedexPokemonHomeMessage(pokemonDetails)));
	}

	@ButtonComponent({ id: /base-stats-\d+/ })
	async baseStats(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[2];
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemonId}`, () => getPokemonDetails(pokemonId));

		await interaction.update(createPokedexBaseStatsPokemonMessage(pokemonDetails));
	}

	@ButtonComponent({ id: /home-\d+/ })
	async home(interaction: ButtonInteraction): Promise<void> {
		const pokemonId = interaction.customId.split("-")[1];
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemonId}`, () => getPokemonDetails(pokemonId));

		await interaction.reply(createEphemeralMessage(createPokedexPokemonHomeMessage(pokemonDetails)));
	}
}
