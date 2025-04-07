import logger from '../handler/logger';
import fs from 'fs';
import * as Path from 'node:path';
import { decompressTheZipFile } from '../handler/zip';
import { Cell } from '@ton/core';

interface StateFace {
    init?: {
        code: Cell;
        data: Cell;
    };
    address: string;
    abi: any;
}

export class TonClient {
    endpoint: string = '';
    apiKey: string;
    fallback: string;
    defaultValue: any = {};

    constructor(params: { endpoint: string; apiKey: string }) {
        this.endpoint = params.endpoint;
        this.apiKey = params.apiKey;
        this.fallback = 'https://global-web3-tonapi.com';
    }

    async callMethod(method: string, body: any) {
        console.log(method, body);
        const url = new URL(this.endpoint || this.fallback);
        url.pathname = `/api/${method}`;
        //RPC
        return await fetch(url.toString(), {
            body: JSON.stringify({
                ...this.defaultValue,
                ...body,
            }),
            headers: {
                authorization: this.apiKey,
            },
            method: 'POST',
        }).then(async (o) => {
            if (o.headers.get('content-type') !== 'application/json') return o;

            const j = await o.json();
            if (j?.message) {
                if (o.ok) logger.successLog(j?.message);
                else logger.errorLog(j?.message);
                if (!o.ok) throw j?.message;
            }
            return j;
        });
    }

    async contractStateInit(params: any) {
        const txtPath = Path.join(process.cwd(), 'data/state');

        if (!fs.existsSync(txtPath)) {
            const data = (await this.callMethod('compileTact', params)) as Response;
            const buffer = await data.arrayBuffer();
            const zipPath = Path.join(process.cwd(), 'data/contract.zip');
            await fs.promises.writeFile(zipPath, Buffer.from(buffer));
            await decompressTheZipFile(zipPath, txtPath);
        }

        const R = JSON.parse(await fs.promises.readFile(txtPath).then((e) => e.toString('utf8')));

        fs.writeFileSync(Path.join(process.cwd(), 'build/SampleJetton.compiled.json'), JSON.stringify(R.compile_data,null,2));

        return {
            ...R,
            compiled: {
                ...R.compiled,
                init: {
                    code: Cell.fromBoc(Buffer.from(R.compiled.init.code.data))[0],
                    data: Cell.fromBoc(Buffer.from(R.compiled.init.data.data))[0],
                }
            }
        } as {
            compiled: StateFace;
            compile_data: any;
        };
    }

    async walletStateInit(params: any) {
        const data = await this.callMethod('walletInit', params);


        return {
            ...data,
            init: data.init ? {
                code: Cell.fromBase64(data.init.code),
                data: Cell.fromBase64(data.init.data)
            }:undefined
        } as StateFace
    }
}
