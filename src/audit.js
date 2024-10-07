import { Connection, PublicKey } from '@solana/web3.js';

// Solana connection configuration
const SOLANA_RPC_URL =
    'https://solana-mainnet.g.alchemy.com/v2/bnPBOjC_umV9XVb-D4-RURKtfweFMhXp';
const connection = new Connection(SOLANA_RPC_URL);
const TOTAL_RISK_SCORE = 10;

// Function to get program information
async function getProgramInfo(programId) {
    try {
        return await connection.getAccountInfo(new PublicKey(programId));
    } catch (error) {
        console.error('Error getting program info:', error);
        return null;
    }
}

// Convert risk score to trust percentage
function toScorePct(riskScore) {
    let temp = TOTAL_RISK_SCORE - riskScore;
    return Math.round((temp / TOTAL_RISK_SCORE) * 100).toString();
}

// Determine risk level based on score
function getRiskLevel(riskScore) {
    if (riskScore > 7) return chrome.i18n.getMessage('highRisk');
    if (riskScore > 4) return chrome.i18n.getMessage('mediumRisk');
    if (riskScore > 2) return chrome.i18n.getMessage('lowRisk');
    return chrome.i18n.getMessage('noRisk');
}

// Provide risk description based on score
function getRiskDesc(riskScore) {
    if (riskScore > 7) return chrome.i18n.getMessage('highRiskDesc');
    if (riskScore > 4) return chrome.i18n.getMessage('mediumRiskDesc');
    if (riskScore > 2) return chrome.i18n.getMessage('lowRiskDesc');
    return chrome.i18n.getMessage('noRiskDesc');
}

// Function for program audit
async function auditProgram(programId) {
    let riskScore = 0;
    let warnings = [];

    try {
        const programInfo = await getProgramInfo(programId);

        // 1. Verifica l'esistenza del programma
        if (!programInfo) {
            riskScore += 10;
            warnings.push(chrome.i18n.getMessage('war_prog_notFound'));
            return { riskScore, warnings };
        }

        // 2. Dimensione del programma
        if (programInfo.data.length < 100) {
            riskScore += 2;
            warnings.push(chrome.i18n.getMessage('war_prog_size'));
        }

        // 3. Eseguibilità
        if (!programInfo.executable) {
            riskScore += 3;
            warnings.push(chrome.i18n.getMessage('war_prog_notExec'));
        }

        // 4. Età del programma
        const slot = await connection.getSlot();
        const blockTime = await connection.getBlockTime(slot);
        const programAge = blockTime - programInfo.rentEpoch;
        if (programAge < 86400) {
            // meno di un giorno
            riskScore += 2;
            warnings.push(chrome.i18n.getMessage('war_prog_recent'));
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
            warnings.push(chrome.i18n.getMessage('war_prog_highTrans'));
        }

        // 6. Saldo del programma
        const balance = await connection.getBalance(new PublicKey(programId));
        if (balance > 1000 * 1e9) {
            // più di 1000 SOL
            riskScore += 2;
            warnings.push(chrome.i18n.getMessage('war_prog_highBal'));
        }
    } catch (error) {
        console.error('Error in auditProgram:', error);
        riskScore = 10;
        warnings.push(chrome.i18n.getMessage('war_prog_error') + error.message);
    }

    return { riskScore, warnings };
}

// Function for transaction audit
async function auditTransaction(transactionSignature) {
    let riskScore = 0;
    let warnings = [];

    try {
        const transaction = await connection.getTransaction(
            transactionSignature,
            {
                maxSupportedTransactionVersion: 0,
            }
        );

        if (!transaction) {
            riskScore += 10;
            warnings.push(chrome.i18n.getMessage('war_trans_notFound'));
            return { riskScore, warnings };
        }

        // 1. Numero di istruzioni
        const instructionsLength =
            transaction.transaction?.message?.instructions?.length;
        if (instructionsLength && instructionsLength > 5) {
            riskScore += 2;
            warnings.push(chrome.i18n.getMessage('war_trans_instr'));
        }

        // 2. Numero di firmatari
        const signaturesLength = transaction.transaction?.signatures?.length;
        if (signaturesLength && signaturesLength > 1) {
            riskScore += 2;
            warnings.push(chrome.i18n.getMessage('war_trans_sign'));
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

        const signaturesLength = transaction.transaction?.signatures?.length;
        if (signaturesLength && signaturesLength > 1) {
            riskScore += 2;
            warnings.push('Transaction with multiple signers');
        }
    }*/

        // 4. Simula la transazione
        if (transaction.meta?.postBalances && transaction.meta?.preBalances) {
            const balanceChanges = transaction.meta.postBalances.map(
                (post, index) => {
                    return post - (transaction.meta.preBalances[index] || 0);
                }
            );

            const largeBalanceChanges = balanceChanges.filter(
                (change) => Math.abs(change) > 100 * 1e9
            ).length;
            if (largeBalanceChanges > 0) {
                riskScore += 3;
                warnings.push(chrome.i18n.getMessage('war_trans_bal'));
            }
        }

        if (transaction.meta?.err) {
            riskScore += 3;
            warnings.push(chrome.i18n.getMessage('war_trans_fail'));
        }

        if (transaction.meta?.logMessages) {
            const suspiciousLogs = transaction.meta.logMessages.filter(
                (log) =>
                    log.includes('error') ||
                    log.includes('failed') ||
                    log.includes('invalid')
            );
            if (suspiciousLogs.length > 0) {
                riskScore += 2;
                warnings.push(chrome.i18n.getMessage('war_trans_logs'));
            }
        }
    } catch (error) {
        console.error('Error in auditTransaction:', error);
        riskScore = 10;
        warnings.push(
            chrome.i18n.getMessage('war_trans_error') + error.message
        );
    }

    return { riskScore, warnings };
}

// Main audit function
async function audit(type, input) {
    try {
        let riskScore, warnings;
        if (type === 'program') {
            ({ riskScore, warnings } = await auditProgram(input));
        } else if (type === 'transaction') {
            ({ riskScore, warnings } = await auditTransaction(input));
        } else {
            throw new Error(
                'Invalid audit type. Use "program" or "transaction".'
            );
        }

        return {
            id: input,
            trustScore: toScorePct(riskScore),
            riskLevel: getRiskLevel(riskScore),
            riskDesc: getRiskDesc(riskScore),
            warnings: warnings,
        };
    } catch (error) {
        console.error('Error in audit:', error);
        return {
            id: input,
            trustScore: '0',
            riskLevel: chrome.i18n.getMessage('highRisk'),
            riskDesc: chrome.i18n.getMessage('audit_desc'),
            warnings: [chrome.i18n.getMessage('audit_fail') + error.message],
        };
    }
}

export { audit };

// Tx examples
// 5m8iahwGDcGcBRUwbPUo6SRTSnJm4htgAjcL8bmCudcmButCcG9JHhBdArrYJMyaud1NMYdUpAMfme8BcWfF79W4
// Program ex
// 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
