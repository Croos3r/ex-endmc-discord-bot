import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type MessageActionRowComponentBuilder,
	type User,
} from "discord.js";
import type Pokemon from "../entities/Pokemon.js";

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
		ephemeral: true,
	};
}

export function createPCPageNotFoundMessage(pageNumber: number) {
	return { content: `Page ${pageNumber} not found`, ephemeral: true };
}

export function createPCPageMessage(
	user: User,
	pageNumber: number,
	maxPage: number,
	pcPagePokemons: Array<
		Pokemon & ({ error: "unknown" | "error" } | { name: string })
	>,
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
