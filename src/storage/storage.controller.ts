import { ApplicationCommandOptionType, type ButtonInteraction, type CommandInteraction, type User } from "discord.js";
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { getCachedByIdOrCacheResult } from "../cache.service.js";
import {
	createContentMessage,
	createEmptyPCMessage,
	createEphemeralContentMessage,
	createEphemeralMessage,
	createPCPageMessage,
	createPCPokemonViewMessage,
} from "../helpers/ui.js";
import { getPokemonDetails } from "../poke-api.service.js";
import { createPokemon, getPCMaxPage, getPCPagePokemons, getStoredPokemon, removePokemon } from "./storage.service.js";

@Discord()
@SlashGroup({ name: "pc", description: "PC commands" })
@SlashGroup({ name: "storage", description: "Storage commands", root: "pc" })
@SlashGroup("storage", "pc")
export class StorageController {
	static async getPCPageComponents(trainer: User, pageNumber: number) {
		const pcPagePokemons = await getPCPagePokemons(trainer, pageNumber);
		const maxPage = await getPCMaxPage(trainer);
		if (maxPage === 0) return createEmptyPCMessage(trainer);
		if (pageNumber > maxPage) return createContentMessage(`Page ${pageNumber} not found`);
		return createPCPageMessage(trainer, pageNumber, maxPage, pcPagePokemons);
	}

	static async getPokemonViewMessage(trainer: User, pokemonId: number) {
		const pokemon = await getStoredPokemon(trainer, pokemonId);
		if (!pokemon) return createContentMessage(`Pokemon #${pokemonId} not found in **${trainer.displayName}**'s PC`);

		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${pokemon.pokeAPIId}`, () =>
			getPokemonDetails(pokemon.pokeAPIId.toString()),
		).catch((error) => {
			if (error.response?.status !== 404) {
				console.error(
					`An error occured during fetch of pokemon's details ${pokemon.id} (#${pokemon.pokeAPIId})`,
					error,
				);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown" || pokemonDetails === "error")
			return createContentMessage(`Pokemon #${pokemon.pokeAPIId} not found`);
		return createPCPokemonViewMessage(trainer, pokemonDetails, pokemon);
	}

	@ButtonComponent({ id: /pokemon-view-\d+-\d+/ })
	async viewPokemon(interaction: ButtonInteraction) {
		const [pokemonId, userId] = interaction.customId.split("-").slice(2);
		const trainer = await interaction.client.users.fetch(userId);
		if (!trainer) return await interaction.reply(createEphemeralContentMessage("User not found"));
		const pokemonViewComponents = await StorageController.getPokemonViewMessage(trainer, Number.parseInt(pokemonId));

		await interaction.update(pokemonViewComponents);
	}

	@ButtonComponent({ id: /pc-page-\d+-\d+/ })
	async viewPCPage(interaction: ButtonInteraction) {
		const [pageNumber, userId] = interaction.customId.split("-").slice(2);
		const trainer = await interaction.client.users.fetch(userId);
		if (!trainer) return await interaction.reply(createEphemeralContentMessage("User not found"));
		const pcPageComponents = await StorageController.getPCPageComponents(trainer, Number.parseInt(pageNumber));

		await interaction.update(pcPageComponents);
	}

	@Slash({ description: "View an user's PC stored specific pokemon or list of pokemons" })
	async view(
		@SlashOption({
			name: "user",
			description: "User to view",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		@SlashOption({
			name: "page",
			description: "Page number",
			required: false,
			type: ApplicationCommandOptionType.Integer,
		})
		pageNumber: number | undefined,
		@SlashOption({
			name: "pokemon-id",
			description: "ID of the Pokemon to view",
			required: false,
			type: ApplicationCommandOptionType.Integer,
		})
		pokemonId: number | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;

		if (pokemonId === undefined) {
			const pcPageComponents = await StorageController.getPCPageComponents(targetTrainer, pageNumber ?? 1);
			return await interaction.reply(createEphemeralMessage(pcPageComponents));
		}
		const pokemonViewCmponents = await StorageController.getPokemonViewMessage(targetTrainer, pokemonId);

		return await interaction.reply(createEphemeralMessage(pokemonViewCmponents));
	}

	@Slash({ description: "Add a pokemon to an user's PC" })
	async add(
		@SlashOption({
			name: "pokemon-name-or-id",
			description: "Pokemon's name or id",
			required: true,
			type: ApplicationCommandOptionType.String,
		})
		pokemonNameOrId: string,
		@SlashOption({
			name: "user",
			description: "User to add the pokemon",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(pokemonNameOrId.toLowerCase());
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${lowerCaseURLEncodedPokemonName}`, () =>
			getPokemonDetails(lowerCaseURLEncodedPokemonName),
		).catch((error) => {
			if (error.response?.status !== 404) {
				console.error(`An error occured during fetch of to-be-stored pokemon ${pokemonNameOrId}`, error);
				return "error" as const;
			}
			return "unknown" as const;
		});

		if (pokemonDetails === "unknown") return await interaction.reply(createEphemeralContentMessage("Unknown pokemon"));
		if (pokemonDetails === "error") return await interaction.reply(createEphemeralContentMessage("An error occurred"));
		await createPokemon(targetTrainer, pokemonDetails);
		await interaction.reply(
			createEphemeralContentMessage(
				`Pokemon ${pokemonDetails.name} (#${pokemonDetails.id}) successfully added to **${targetTrainer.displayName}**'s PC`,
			),
		);
	}

	@Slash({ description: "Remove a pokemon from an user's PC" })
	async remove(
		@SlashOption({
			name: "pokemon-id",
			description: "Pokemon's PC id",
			required: true,
			type: ApplicationCommandOptionType.Integer,
		})
		pokemonPCId: number,
		@SlashOption({
			name: "user",
			description: "User to remove the pokemon",
			required: false,
			type: ApplicationCommandOptionType.User,
		})
		trainer: User | undefined,
		interaction: CommandInteraction,
	) {
		const targetTrainer = trainer ?? interaction.user;

		const pokemon = await getStoredPokemon(targetTrainer, pokemonPCId);
		if (!pokemon)
			return await interaction.reply(
				createContentMessage(`Pokemon #${pokemonPCId} not found in **${targetTrainer.displayName}**'s PC`),
			);

		await removePokemon(pokemon);
		await interaction.reply(
			createContentMessage(`Pokemon #${pokemonPCId} successfully removed from **${targetTrainer.displayName}**'s PC`),
		);
	}
}
