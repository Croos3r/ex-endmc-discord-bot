declare global {
	namespace NodeJS {
		interface ProcessEnv {
			BOT_TOKEN: string;
			REDIS_HOST: string;
			REDIS_PORT: string;
			DB_HOST: string;
			DB_PORT: string;
			DB_USER: string;
			DB_PASS: string;
			DB_NAME: string;
		}
	}
}

export type {};
