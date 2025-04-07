import { Address, contractAddress, toNano } from '@ton/core';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import fs from 'fs';
import * as Path from 'node:path';
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'node:process';
import logger from '../handler/logger';
import { TONClient } from '../handler/TONClient';
import { NetworkProvider } from '@ton/blueprint';
import { TonClient } from '@ton/ton';

const rl = readline.createInterface({ input, output });

rl.once('SIGINT',console.log)
rl.on('line',console.log)

const askQuestion = (question: string) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer+"");
        });
    });
};

export const dataPath = Path.join(process.cwd(),'data');
export const metadataPath = Path.join(dataPath,'metadata.json');
export const deployPath = Path.join(process.cwd(),'data/deployed');


if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, {
        recursive: true
    });
}

const requiredKey = ['name','description','symbol', 'image'] as const;
let data: Partial<{
    name: string,
    description: string,
    symbol: string,
    image: string,
}> = {};

try {
    data = JSON.parse(fs.readFileSync(metadataPath).toString('utf8'));
} catch {}

async function prompt(msg: string): Promise<string> {
    return (await askQuestion(msg+"\n"))+"";
}

export async function run(provider: NetworkProvider) {
    input.resume();
    input.setEncoding('utf8');



    logger.yellowLog("Validating Token Metadata...");
    for (let key of requiredKey) {
        if (!data[key]) {
            data[key] = await prompt(`Enter ${key}`);
        }
    }
    await fs.promises.writeFile(metadataPath, JSON.stringify(data, null, 2)).catch((e)=>{
        console.warn('Fail to save metadata',e);
    });
    logger.yellowLog("Validation done.");

    let deployed = fs.existsSync(deployPath);

    //@ts-ignore
    const [{SampleJetton},{JettonDefaultWallet} ] = await Promise.all([
        import(`../wrappers/SampleJetton`),
        //@ts-ignore
        import(`../build/SampleJetton/tact_JettonDefaultWallet`)
    ] as const)



    const address = provider.sender().address!;
    const { compiled: state } = await TONClient.contractStateInit({
        ...data,
        address: address.toString({bounceable: false})
    });
    if (!state.init) throw("INITIALIZE FAILED");

    const cAddress = contractAddress(0,state.init);

    let content = buildOnchainMetadata(data as Required<typeof data>);
    const contract =  await SampleJetton.fromInit(provider.sender().address as Address, content, 1000000000000000000n);
    //@ts-ignore
    contract.init = state.init;contract.abi = state.abi;contract.address = cAddress;

    const sampleJetton = provider.open(contract);
    if (!deployed) {
        logger.yellowLog('Deployed and Mint...', address.toString());
        await sampleJetton.send(
            provider.sender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'Mint',
                amount: 100000000000000000n,
                receiver: address
            }
        );
        await fs.promises.writeFile(deployPath, "");
    }

    async function circle() {
        const input = await prompt(`${data.symbol} 
Enter number to continue:

1. Mint 10M ${data.symbol} (give yourself token)
2. Add Wallet Address to whitelist
3. Remove Wallet Address From whitelist
4. Change Token Metadata (symbol,image,...)
5. Delete build data
6. Mint Custom Value (give yourself token)
0. Exit`);

        switch (input) {
            case "6":
            case "1":
                await sampleJetton.send(
                    provider.sender(),
                    {
                        value: toNano('0.05'),
                        bounce: false,
                    },
                    {
                        $$type: 'Mint',
                        amount: input === "6" ? toNano(await prompt("Enter value").then(e=>e+"")):100000000000000000n,
                        receiver: Address.parse(address.toString()),
                    },
                );
                break;
            case "2":
            case "3":
                const target = Address.parse(await prompt("Enter wallet address")+"");
                const jettonWalletAddress = await sampleJetton.getGetWalletAddress(target);
                const params = {
                    address: address.toString(),
                    target: target.toString(),
                    contract: contract.address.toString()
                };
                const walletState = await TONClient.walletStateInit(params);

                let defaultWallet = JettonDefaultWallet.fromAddress(jettonWalletAddress);
                //@ts-ignore
                defaultWallet.abi = walletState.abi;defaultWallet.init = walletState.init;defaultWallet.address = Address.parse(walletState.address);

                // Open the jetton wallet contract
                const jettonWallet = provider.open(defaultWallet);

                await jettonWallet.send(
                    provider.sender(),
                    {
                        value: toNano('0.05'), // Attach some TON for gas
                        bounce: true,
                    },
                    {
                        $$type: 'ChangeCan',
                        can: input === "2"
                    },
                );
                break;
            case "4":
            case "5":
                if (!(await prompt("this operation delete current token and make another one. continue? (yes/no)\n")+"").toLowerCase().startsWith("y")) break;

                console.log("Deleting build data...");
                await fs.promises.rm(dataPath, {
                    recursive: true
                }).catch(console.error);
            case "0":
                console.log("EXIT\nyou can start project with npm run start");
                process.exit(0);
                break;
            default:
                console.log("Invalid command");
                break;
        }
        console.log("Operation done");
        circle().catch(console.error);
    }

    do {
        console.log("Start Circle");
        try {
            await circle()
        } catch (e) {
            console.error(e);
            await prompt("error, Enter any word to continue!");
        }
    } while(true);
}
