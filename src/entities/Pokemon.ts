import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export default class Pokemon {
	@PrimaryGeneratedColumn("rowid")
	id!: number;

	@Column("smallint", { unsigned: true })
	pokeAPIId!: number;

	@Column("smallint", { unsigned: true, default: 1 })
	level!: number;

	@Column("int", { unsigned: true, default: 0 })
	experience!: number;

	@Column("varchar", { nullable: true, default: null })
	storedBy!: string | null;

	@Column("varchar", { nullable: true, default: null })
	heldBy!: string | null;

	@Column("smallint", { unsigned: true, default: 0 })
	health!: number;

	@Column("smallint", { unsigned: true, default: 0 })
	attack!: number;

	@Column("smallint", { unsigned: true, default: 0 })
	defense!: number;

	@Column("smallint", { unsigned: true, default: 0 })
	specialAttack!: number;

	@Column("smallint", { unsigned: true, default: 0 })
	specialDefense!: number;

	@Column("smallint", { unsigned: true, default: 0 })
	speed!: number;
}
