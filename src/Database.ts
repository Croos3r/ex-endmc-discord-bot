import { DataSource } from 'typeorm'
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'

export const DATA_SOURCE = new DataSource({
	type: "postgres",
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	username: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	synchronize: process.env.NODE_ENV === "development",
	entities: ["src/entities/*.ts"],
	migrations: ["src/migrations/*.ts"],
	logging: true,
	namingStrategy: new SnakeNamingStrategy(),
});

DATA_SOURCE.initialize()
	.then(() => {
		console.log("Database initialized");
	})
	.catch((error) => {
		console.error("Database initialization failed", error);
		process.exit(1);
	});

export default DATA_SOURCE;
