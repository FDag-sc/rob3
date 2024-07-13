import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const SOLANA_RPC_URL =
    'https://solana-mainnet.g.alchemy.com/v2/bnPBOjC_umV9XVb-D4-RURKtfweFMhXp';
const connection = new Connection(SOLANA_RPC_URL);
const TOTAL_RISK_SCORE = 10;

async function getProgramInfo(programId) {
    return await connection.getAccountInfo(new PublicKey(programId));
}

function toScorePct(riskScore) {
    let temp = TOTAL_RISK_SCORE - riskScore;
    return Math.round((temp / TOTAL_RISK_SCORE) * 100).toString();
}

function getRiskLevel(riskScore) {
    if (riskScore > 7) return 'High Risk';
    if (riskScore > 4) return 'Moderate Risk';
    if (riskScore > 2) return 'Low Risk';
    return 'Very Low Risk';
}

function getRiskDesc(riskScore) {
    if (riskScore > 7)
        return 'Proceed with extreme caution. Thorough review strongly recommended.';
    if (riskScore > 4)
        return 'Proceed with caution. Additional review recommended.';
    if (riskScore > 2) return 'Generally safe, but always be cautious.';
    return 'Seems safe, but always verify.';
}

async function auditProgram(programId) {
    const programInfo = await getProgramInfo(programId);

    let riskScore = 0;
    let warnings = [];

    // 1. Verifica l'esistenza del programma
    if (!programInfo) {
        riskScore += 10;
        warnings.push('Program not found');
        return { riskScore, warnings };
    }

    // 2. Dimensione del programma
    if (programInfo.data.length < 100) {
        riskScore += 2;
        warnings.push('Unusually small program size');
    }

    // 3. Eseguibilità
    if (!programInfo.executable) {
        riskScore += 3;
        warnings.push('Program is not executable');
    }

    // 4. Età del programma
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    const programAge = blockTime - programInfo.rentEpoch;
    if (programAge < 86400) {
        // meno di un giorno
        riskScore += 2;
        warnings.push('Very new program');
    }

    // 5. Frequenza delle transazioni
    const recentSignatures = await connection.getSignaturesForAddress(
        new PublicKey(programId),
        { limit: 1000 }
    );
    const txFrequency = recentSignatures.length / (programAge / 86400);
    if (txFrequency > 100) {
        // più di 100 tx al giorno
        riskScore += 1;
        warnings.push('High transaction frequency');
    }

    // 6. Saldo del programma
    const balance = await connection.getBalance(new PublicKey(programId));
    if (balance > 1000 * 1e9) {
        // più di 1000 SOL
        riskScore += 2;
        warnings.push('Large balance in program account');
    }

    return { riskScore, warnings };
}

async function auditTransaction(rawTransaction) {
    const transaction = Transaction.from(Buffer.from(rawTransaction, 'base64'));

    let riskScore = 0;
    let warnings = [];

    // 1. Numero di istruzioni
    if (transaction.instructions.length > 5) {
        riskScore += 2;
        warnings.push('Complex transaction (many instructions)');
    }

    // 2. Numero di firmatari
    if (transaction.signatures.length > 1) {
        riskScore += 2;
        warnings.push('Multiple signers');
    }

    // 3. Analisi delle istruzioni
    /*for (let instruction of transaction.instructions) {
        const programId = instruction.programId.toBase58();
        console.log('Instruction program ID:', programId);

        // Controlla se il programma è noto (questo è un esempio, dovresti espandere questa lista)
        const knownPrograms = [
            '11111111111111111111111111111111',
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        ];
        if (!knownPrograms.includes(programId)) {
            riskScore += 1;
            findings.push(`Interaction with unknown program: ${programId}`);
        }

        // Controlla il numero di account scrivibili
        const writableAccounts = instruction.keys.filter(
            (key) => key.isWritable
        ).length;
        if (writableAccounts > 3) {
            riskScore += 1;
            findings.push('High number of writable accounts in an instruction');
        }
    }*/

    // 4. Simula la transazione
    try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
            riskScore += 3;
            warnings.push('Transaction simulation failed');
        }

        // Analizza i cambiamenti di saldo dalla simulazione
        if (simulation.value.accounts) {
            const largeBalanceChanges = simulation.value.accounts.filter(
                (account) => Math.abs(account.lamports) > 100 * 1e9 // più di 100 SOL
            ).length;
            if (largeBalanceChanges > 0) {
                riskScore += 3;
                warnings.push('Large balance changes detected');
            }
        }
    } catch (error) {
        riskScore += 6;
        warnings.push('Unable to simulate transaction');
    }

    return { riskScore, warnings };
}

async function audit(type, input) {
    let riskScore, warnings;
    if (type === 'program') {
        ({ riskScore, warnings } = await auditProgram(input));
    } else {
        ({ riskScore, warnings } = await auditTransaction(input));
    }

    return {
        id: input,
        trustScore: toScorePct(riskScore),
        riskLevel: getRiskLevel(riskScore),
        riskDesc: getRiskDesc(riskScore),
        warnings: warnings,
    };
}

export { audit };
//ESEMPIO 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
