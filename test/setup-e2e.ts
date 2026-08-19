import 'dotenv/config';
import { config as loadEnv } from 'dotenv';

// Override the development .env so the suite never touches the dev database.
loadEnv({ path: '.env.test', override: true });
