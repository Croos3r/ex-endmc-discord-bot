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
} from 'discord.js'
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { getCachedByIdOrCacheResult, invalidateCache } from './Cache.js'
import DATA_SOURCE from './Database.js'
import { getPokemonDetails } from './PokeAPI.js'
import Pokemon from './entities/Pokemon.js'

@Discord()
@SlashGroup({ name: 'pc', description: 'PC commands' })
@SlashGroup({ name: 'storage', description: 'Storage commands', root: 'pc' })
@SlashGroup('storage', 'pc')
export class Storage {
	public static async getDatabasePokemonDetails(storedPokemon: Pokemon) {
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${storedPokemon.pokeAPIId.toString()}`, () => getPokemonDetails(storedPokemon.pokeAPIId.toString()))
			.catch(error => {
				if (error.response?.status !== 404) {
					console.error(`An error occured during fetch of pokemon's details ${storedPokemon.id} (#${storedPokemon.pokeAPIId})`, error)
					return 'error' as const
				}
				return 'unknown' as const
			})

		if (pokemonDetails === 'unknown' || pokemonDetails === 'error') return {
			...storedPokemon,
			error: pokemonDetails,
		}
		return {
			...storedPokemon,
			name: pokemonDetails.name,
		}
	}

	static async getPCMaxPage(targetUser: User) {
		return getCachedByIdOrCacheResult(`pc:max-page:${targetUser.id}`, async () => {
			const pokemons = DATA_SOURCE.getRepository(Pokemon)
			const count = await pokemons.count({where: {storedBy: targetUser.id}})
			return Math.ceil(count / 24)
		})
	}

	static async getPCPageComponents(targetUser: User, pageNumber: number) {
		const pcPagePokemons = await Storage.getPCPagePokemons(targetUser, pageNumber)
		const maxPage = await Storage.getPCMaxPage(targetUser)
		if (maxPage === 0) {
			return {
				content: `${targetUser.displayName}'s PC is empty`,
				embeds: [],
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>({
						components: [
							new ButtonBuilder().setLabel('Previous').setEmoji('⬅').setStyle(ButtonStyle.Primary).setCustomId(`pc-page-${pageNumber - 1}-${targetUser.id}`).setDisabled(true),
							new ButtonBuilder().setLabel('Refresh').setEmoji('🔃').setStyle(ButtonStyle.Secondary).setCustomId(`pc-page-${pageNumber}-${targetUser.id}`),
							new ButtonBuilder().setLabel('Next').setEmoji('➡').setStyle(ButtonStyle.Primary).setCustomId(`pc-page-${pageNumber + 1}-${targetUser.id}`).setDisabled(true),
						],
					}),
				],
				ephemeral: true,
			}
		}
		if (pageNumber > maxPage) return {content: `Page ${pageNumber} not found`, ephemeral: true}
		return {
			content: "",
			embeds: [
				new EmbedBuilder()
					.setTitle(`${targetUser.displayName}'s PC`)
					.setFooter({text: `Page ${pageNumber}/${maxPage}`})
					.addFields(pcPagePokemons.map(pokemon => {
						if ('error' in pokemon) {
							if (pokemon.error === 'unknown') return {
								name: `Unknown Pokemon #${pokemon.pokeAPIId}`,
								value: `Level: ${pokemon.level}`,
								inline: true,
							}
							return {
								name: `Unknown Pokemon #${pokemon.pokeAPIId}`,
								value: `Level: ${pokemon.level} - Error: Could not fetch details`,
								inline: true,
							}
						}
						return {
							name: `${pokemon.id}. ${pokemon.name} (#${pokemon.pokeAPIId})`,
							value: `Level: ${pokemon.level}`,
							inline: true,
						}
					})),
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>({
					components: [
						new ButtonBuilder().setLabel('Previous').setEmoji('⬅').setStyle(ButtonStyle.Primary).setCustomId(`pc-page-${pageNumber - 1}-${targetUser.id}`).setDisabled(pageNumber === 1),
						new ButtonBuilder().setLabel('Refresh').setEmoji('🔃').setStyle(ButtonStyle.Secondary).setCustomId(`pc-page-${pageNumber}-${targetUser.id}`),
						new ButtonBuilder().setLabel('Next').setEmoji('➡').setStyle(ButtonStyle.Primary).setCustomId(`pc-page-${pageNumber + 1}-${targetUser.id}`).setDisabled(pageNumber === maxPage),
					],
				}),
			],
		}
	}

	static async getPCPagePokemons(targetUser: User, pageNumber: number) {
		const pokemons = DATA_SOURCE.getRepository(Pokemon)
		const targetUsersPokemons = await pokemons.find({where: {storedBy: targetUser.id}, skip: pageNumber ? (pageNumber - 1) * 24 : 0, take: 24})

		if (targetUsersPokemons.length === 0) return []

		return await Promise.all(targetUsersPokemons.map(Storage.getDatabasePokemonDetails))
	}

	@ButtonComponent({id: /pc-page-\d+-\d+/})
	async viewPCPage(interaction: ButtonInteraction) {
		const [pageNumber, userId] = interaction.customId.split('-').slice(2)
		const targetUser = await interaction.client.users.fetch(userId)
		if (!targetUser) return await interaction.reply({content: 'User not found', ephemeral: true})
		const pcPageComponents = await Storage.getPCPageComponents(targetUser, Number.parseInt(pageNumber))

		await interaction.update(pcPageComponents)
	}

	@Slash({ description: 'View an user\'s PC stored Pokemons' })
	async view(
		@SlashOption({name: 'user', description: 'User to view', required: false, type: ApplicationCommandOptionType.User})
		user: User | null,
		@SlashOption({name: 'page', description: 'Page number', required: false, type: ApplicationCommandOptionType.Integer})
		pageNumber: number | null,
		interaction: CommandInteraction) {
		const targetUser = user ?? interaction.user
		const pcPageComponents = await Storage.getPCPageComponents(targetUser, pageNumber ?? 1)

		await interaction.reply({ephemeral: true, ...pcPageComponents})
	}


	@Slash({ description: 'Add a pokemon to an user\'s PC' })
	async add(
		@SlashOption({name: 'pokemon-name-or-id', description: 'Pokemon\'s name or id', required: true, type: ApplicationCommandOptionType.String})
		pokemonNameOrId: string,
		@SlashOption({name: 'user', description: 'User to add the pokemon', required: false, type: ApplicationCommandOptionType.User})
		user: User | null,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user
		const lowerCaseURLEncodedPokemonName = encodeURIComponent(pokemonNameOrId.toLowerCase())
		const pokemonDetails = await getCachedByIdOrCacheResult(`pokemon:${lowerCaseURLEncodedPokemonName}`, () => getPokemonDetails(lowerCaseURLEncodedPokemonName)).catch(error => {
			if (error.response?.status !== 404) {
				console.error(`An error occured during fetch of to-be-stored pokemon ${pokemon.id} (#${pokemon.pokeAPIId})`, error)
				return 'error' as const
			}
			return 'unknown' as const
		})

		if (pokemonDetails === 'unknown') return await interaction.reply('Unknown pokemon')
		if (pokemonDetails === 'error') return await interaction.reply('An error occurred')
		const pokemons = DATA_SOURCE.getRepository(Pokemon)

		const pokemon = pokemons.create({
			pokeAPIId: pokemonDetails.id,
			storedBy: targetUser.id,
		})
		await pokemons.save(pokemon)
		await invalidateCache(`pc:max-page:${targetUser.id}`)

		await interaction.reply({content: `Pokemon ${pokemonDetails.name} (#${pokemonDetails.id}) successfully added to **${targetUser.displayName}**'s PC`, ephemeral: true})
	}

	@Slash({ description: 'Remove a pokemon from an user\'s PC' })
	async remove(
		@SlashOption({name: 'pokemon-id', description: 'Pokemon\'s PC id', required: true, type: ApplicationCommandOptionType.Integer})
		pokemonPCId: number,
		@SlashOption({name: 'user', description: 'User to remove the pokemon', required: false, type: ApplicationCommandOptionType.User})
		user: User | null,
		interaction: CommandInteraction,
	) {
		const targetUser = user ?? interaction.user
		const pokemons = DATA_SOURCE.getRepository(Pokemon)

		const pokemon = await pokemons.findOneBy({id: pokemonPCId, storedBy: targetUser.id})
		if (!pokemon) {
			await interaction.reply({content: `Pokemon #${pokemonPCId} not found in **${targetUser.displayName}**'s PC`, ephemeral: true})
			return
		}

		await pokemons.remove(pokemon)
		await invalidateCache(`pc:max-page:${targetUser.id}`)
		await interaction.reply({content: `Pokemon #${pokemonPCId} successfully removed from **${targetUser.displayName}**'s PC`, ephemeral: true})
	}
}
