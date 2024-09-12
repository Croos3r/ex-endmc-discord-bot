import type { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1726095711433 implements MigrationInterface {
	name = "Initial1726095711433";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "pokemon" ("id" SERIAL NOT NULL, "poke_api_id" smallint NOT NULL, "level" smallint NOT NULL DEFAULT '1', "experience" integer NOT NULL DEFAULT '0', "stored_by" character varying, "held_by" character varying, "health" smallint NOT NULL DEFAULT '0', "attack" smallint NOT NULL DEFAULT '0', "defense" smallint NOT NULL DEFAULT '0', "special_attack" smallint NOT NULL DEFAULT '0', "special_defense" smallint NOT NULL DEFAULT '0', "speed" smallint NOT NULL DEFAULT '0', CONSTRAINT "PK_0b503db1369f46c43f8da0a6a0a" PRIMARY KEY ("id"))`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "pokemon"`);
	}
}
