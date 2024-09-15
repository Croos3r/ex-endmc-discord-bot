import { ActivityType } from "discord.js";
import { type ArgsOf, Discord, On } from "discordx";
import {
	applyMessageMultipliers,
	applyMultipliers,
	applyStatusMultiplierAfterRequiredDelay,
	getMultipliersForType,
} from "./experience-multipliers.service.js";

@Discord()
export default class ExperienceMultipliersController {
	@On({ event: "guildMemberAdd" })
	async onGuildMemberJoin([member]: ArgsOf<"guildMemberAdd">) {
		const multipliers = getMultipliersForType("joinedGuild");

		await applyMultipliers(member.user, multipliers);
	}

	@On({ event: "messageCreate", priority: 0 })
	async onMessageCreate([message]: ArgsOf<"messageCreate">) {
		await applyMessageMultipliers(message);
	}

	@On({ event: "presenceUpdate" })
	async onGuildMemberUpdate([_, newPresence]: ArgsOf<"presenceUpdate">) {
		const trainer = newPresence.member;
		if (!trainer) return;

		const newStatus = newPresence.activities.find(({ type }) => type === ActivityType.Custom)?.state;
		if (!newStatus) return;

		await applyStatusMultiplierAfterRequiredDelay(trainer, newStatus);
	}
}
