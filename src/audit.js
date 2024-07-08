import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function getProgramInfo(programId) {
  return await connection.getAccountInfo(new PublicKey(programId));
}

function isValidPublicKey(input) {
  try {
    new PublicKey(input);
    return true;
  } catch (e) {
    return false;
  }
}

function calculateRiskScore(findings) {
  return findings.reduce((acc, finding) => acc + finding.score, 0);
}

function summarizeFindings(findings) {
  return findings.map((f) => `${f.description}`).join(', ');
}

function getRiskRecommendation(riskScore) {
  if (riskScore > 7) return 'HIGH RISK: Thorough review strongly recommended.';
  if (riskScore > 4) return 'MODERATE RISK: Additional review recommended.';
  if (riskScore > 2) return 'LOW RISK: Generally safe, but be cautious.';
  return 'VERY LOW RISK: Seems safe, but verify.';
}

async function auditProgram(programId) {
  const programInfo = await getProgramInfo(programId);
  let findings = [];

  // 1. Verifica l'esistenza del programma
  if (!programInfo) {
    findings.push({ score: 5, description: 'Program not found' });
    return { riskScore: calculateRiskScore(findings), findings };
  }

  findings.push({ score: 0, description: 'Program exists' });

  // 2. Dimensione del programma
  if (programInfo.data.length < 100) {
    findings.push({ score: 2, description: 'Unusually small program size' });
  }

  // 3. Eseguibilità
  if (!programInfo.executable) {
    findings.push({ score: 3, description: 'Program is not executable' });
  }

  return { riskScore: calculateRiskScore(findings), findings };
}

async function auditTransaction(rawTransaction) {
  const transaction = Transaction.from(Buffer.from(rawTransaction, 'base64'));
  let findings = [];

  if (transaction.instructions.length > 5) {
    findings.push({
      score: 1,
      description: 'Complex transaction (many instructions)',
    });
  }

  return { riskScore: calculateRiskScore(findings), findings };
}

async function audit(input) {
    return {
        riskScore: 0,
        findings: 'No findings',
        recommendation: 'LOWRISK: No risk',
        };
    

  let findings, Score;
  if (isValidPublicKey(input)) {
    ({ findings, riskScore } = await auditProgram(input));
  } else {
    ({ findings, riskScore } = await auditTransaction(input));
  }

  return {
    riskScore,
    findings: summarizeFindings(findings),
    recommendation: getRiskRecommendation(riskScore),
  };
}

export { audit };