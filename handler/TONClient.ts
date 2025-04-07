import { TonClient } from '../wrappers/community';

import dotenv from 'dotenv';

dotenv.config();


export const TONClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env['TON_API']+""
});
TONClient.endpoint = TONClient.fallback;
