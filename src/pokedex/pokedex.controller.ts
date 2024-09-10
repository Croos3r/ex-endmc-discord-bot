import { ApplicationCommandOptionType, type ButtonInteraction, type CommandInteraction } from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import {
	createEphemeralContentMessage,
	createEphemeralMessage,
	createPokedexBaseStatsPokemonMessage,
	createPokedexPokemonHomeMessage,
} from '../helpers/ui.js'
import { getPokemonDetails } from './pokedex.service.js'

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
		const pokemonDetails = await getPokemonDetails(lowerCaseURLEncodedPokemonName);

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		await interaction.reply(createEphemeralMessage(createPokedexPokemonHomeMessage(pokemonDetails)));
	}

	@ButtonComponent({ id: /base-stats-\d+/ })
	async baseStats(interaction: ButtonInteraction) {
		const pokemonId = interaction.customId.split("-")[2];
		const pokemonDetails = await getPokemonDetails(pokemonId);

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		await interaction.update(createPokedexBaseStatsPokemonMessage(pokemonDetails));
	}

	@ButtonComponent({ id: /home-\d+/ })
	async home(interaction: ButtonInteraction) {
		const pokemonId = interaction.customId.split("-")[1];
		const pokemonDetails = await getPokemonDetails(pokemonId);

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		await interaction.update(createPokedexPokemonHomeMessage(pokemonDetails));
	}
}
