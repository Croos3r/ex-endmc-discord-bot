import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

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
}
