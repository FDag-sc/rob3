const { ethers } = require('ethers');
const dotenv = require('dotenv');

dotenv.config();

// Log per debug
console.log('API Key loaded:', process.env.ALCHEMY_API_KEY ? 'Yes' : 'No');

// Provider con fallback a provider pubblico se l'API key non è disponibile
const PROVIDER_URL = process.env.ALCHEMY_API_KEY 
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : 'https://cloudflare-eth.com';

console.log('Using provider:', PROVIDER_URL);

class BytecodeAnalyzer {
    analyze(bytecode) {
        return {
            hasSelfdestruct: this.detectSelfdestruct(bytecode),
            hasDelegateCall: this.detectDelegateCall(bytecode),
            hasUnsafeOperations: this.detectUnsafeOperations(bytecode),
            hasReentrancy: this.detectReentrancy(bytecode),
            hasTimestampDependence: this.detectTimestampDependence(bytecode)
        };
    }

    detectSelfdestruct(bytecode) {
        return bytecode.includes('ff');
    }

    detectDelegateCall(bytecode) {
        return bytecode.includes('f4');
    }

    detectUnsafeOperations(bytecode) {
        const unsafeOpcodes = [
            'f4', // delegatecall
            'ff', // selfdestruct
            'f0', // create
            'f5'  // create2
        ];
        return unsafeOpcodes.some(opcode => bytecode.includes(opcode));
    }

    detectReentrancy(bytecode) {
        const externalCallPattern = /callvalue|call|delegatecall/i;
        const stateModPattern = /sstore/i;
        return externalCallPattern.test(bytecode) && stateModPattern.test(bytecode);
    }

    detectTimestampDependence(bytecode) {
        return bytecode.includes('42'); // TIMESTAMP opcode
    }
}

class SmartContractAuditor {
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(
            PROVIDER_URL,
            {
                name: 'mainnet',
                chainId: 1
            }
        );
        this.bytecodeAnalyzer = new BytecodeAnalyzer();
        this.TOTAL_RISK_SCORE = 10;
    }

    async auditContract(contractAddress) {
        let riskScore = 0;
        let warnings = [];
        
        try {
            console.log('Analyzing contract:', contractAddress);

            // 1. Base Contract Verification
            const code = await this.provider.getCode(contractAddress);
            if (code === '0x') {
                return {
                    riskScore: 10,
                    warnings: ['Contract not found or not deployed']
                };
            }

            console.log('Contract bytecode length:', code.length);

            // 2. Bytecode Analysis
            const bytecodeAnalysis = this.bytecodeAnalyzer.analyze(code);
            
            // 3. Check Dangerous Patterns
            if (bytecodeAnalysis.hasSelfdestruct) {
                riskScore += 3;
                warnings.push('Contract contains selfdestruct capability');
            }

            if (bytecodeAnalysis.hasDelegateCall) {
                riskScore += 2;
                warnings.push('Contract uses delegatecall - potential security risk');
            }

            if (bytecodeAnalysis.hasReentrancy) {
                riskScore += 2;
                warnings.push('Potential reentrancy vulnerability detected');
            }

            if (bytecodeAnalysis.hasTimestampDependence) {
                riskScore += 1;
                warnings.push('Contract depends on block timestamp');
            }

            // 4. Contract History Check
            const history = await this.getContractHistory(contractAddress);
            if (history.age < 86400) {
                riskScore += 2;
                warnings.push('Contract is very new');
            }

            // 5. Balance Check
            const balance = await this.provider.getBalance(contractAddress);
            if (balance.gt(ethers.utils.parseEther('100'))) {
                riskScore += 1;
                warnings.push('Contract holds significant funds');
            }

            return {
                address: contractAddress,
                riskScore,
                warnings,
                bytecodeAnalysis,
                trustScore: this.calculateTrustScore(riskScore)
            };
        } catch (error) {
            console.error('Audit error:', error);
            return { 
                riskScore: 10, 
                warnings: ['Audit failed: ' + error.message] 
            };
        }
    }

    calculateTrustScore(riskScore) {
        return Math.max(0, 100 - (riskScore * 10));
    }

    async getContractHistory(address) {
        const currentBlock = await this.provider.getBlockNumber();
        const txCount = await this.provider.getTransactionCount(address);
        
        return {
            transactionCount: txCount,
            age: currentBlock
        };
    }
}

// Example usage
async function main() {
    const auditor = new SmartContractAuditor();
    // Example: USDT contract address
    const result = await auditor.auditContract('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    console.log('Audit Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
