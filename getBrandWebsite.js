const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (error) {
    // dotenv is optional - if not installed, just continue
    // Environment variables can still be set manually
}

// Global state for graceful shutdown
let isShuttingDown = false;
let currentResults = [];
let currentFinder = null;

// Configuration
const CONFIG = {
    // OpenRouter API configuration
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    
    // Models with internet access (using :online suffix for web search)
    MODELS: {
        'gpt-4o': 'openai/gpt-4o:online',
        'gpt-4o-mini': 'openai/gpt-4o-mini:online',
        'anthropic/claude-sonnet-4': 'anthropic/claude-sonnet-4:online',
        'gemini-2.5-pro': 'google/gemini-2.5-pro-preview:online',
        'gemini-2.0-flash-001': 'google/gemini-2.0-flash-001',
        'qwen-2.5-72b': 'qwen/qwen-2.5-72b-instruct:online',
        'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct:online',
        'perplexity/sonar-deep-research': 'perplexity/sonar-deep-research'
    },
    
    // Default model to use
    DEFAULT_MODEL: 'gpt-4o-mini',
    
    // Number of brands to process initially
    INITIAL_BRAND_COUNT: 10,
    
    // Output directory for results
    OUTPUT_DIR: './results',
    
    // Request timeout in milliseconds
    TIMEOUT: 90000
};

class BrandWebsiteFinder {
    constructor(modelKey = CONFIG.DEFAULT_MODEL) {
        this.modelKey = modelKey;
        this.modelName = CONFIG.MODELS[modelKey];
        
        // Initialize token tracking
        this.tokenUsage = {
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalTokens: 0,
            totalCost: 0, // in credits
            requestCount: 0,
            brandTokens: [] // detailed per-brand tracking
        };
        
        if (!this.modelName) {
            throw new Error(`Model '${modelKey}' not found. Available models: ${Object.keys(CONFIG.MODELS).join(', ')}`);
        }
        
        if (!CONFIG.OPENROUTER_API_KEY) {
            throw new Error('OPENROUTER_API_KEY environment variable is required');
        }
        
        this.ensureOutputDir();
    }
    
    ensureOutputDir() {
        if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
            fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
        }
    }
    
    checkExistingResults(count = CONFIG.INITIAL_BRAND_COUNT) {
        try {
            // Get all result files for this model (using safe filename pattern)
            const safeModelKey = this.modelKey.replace(/[\/\\:*?"<>|]/g, '_');
            const files = fs.readdirSync(CONFIG.OUTPUT_DIR)
                .filter(file => file.startsWith(`brand_websites_${safeModelKey}_`) && file.endsWith('.json'))
                .filter(file => !file.includes('_PARTIAL_'));
            
            if (files.length === 0) {
                return { hasResults: false, message: `No existing results found for ${this.modelKey}` };
            }
            
            // Find the file with the most successful entries
            let bestFile = null;
            let bestSuccessCount = 0;
            let bestData = null;
            
            for (const file of files) {
                try {
                    const filepath = path.join(CONFIG.OUTPUT_DIR, file);
                    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    const successful = data.results.filter(r => r.success === true && r.website_url);
                    
                    if (successful.length > bestSuccessCount) {
                        bestSuccessCount = successful.length;
                        bestFile = file;
                        bestData = data;
                    }
                } catch (error) {
                    console.warn(`⚠️  Error reading ${file}: ${error.message}`);
                    continue;
                }
            }
            
            if (!bestFile) {
                return { hasResults: false, message: `No valid results files found for ${this.modelKey}` };
            }
            
            const filepath = path.join(CONFIG.OUTPUT_DIR, bestFile);
            console.log(`🔍 Checking existing results: ${bestFile}`);
            
            const successful = bestData.results.filter(r => r.success === true && r.website_url);
            const total = bestData.results.length;
            
            if (successful.length >= count) {
                return {
                    hasResults: true,
                    message: `Found existing results with ${successful.length} successful entries (${total} total)`,
                    filepath: filepath,
                    successfulCount: successful.length,
                    totalCount: total,
                    data: bestData
                };
            } else {
                return {
                    hasResults: false,
                    message: `Best existing results only have ${successful.length} successful entries (need ${count})`,
                    filepath: filepath,
                    successfulCount: successful.length,
                    totalCount: total
                };
            }
            
        } catch (error) {
            console.warn(`⚠️  Error checking existing results: ${error.message}`);
            return { hasResults: false, message: 'Error reading existing results' };
        }
    }
    
    async makeOpenRouterRequest(prompt) {
        const response = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/knife-brand-finder',
                'X-Title': 'Knife Brand Website Finder'
            },
            body: JSON.stringify({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that finds official websites for knife and blade brands. Always provide the most accurate and up-to-date official website URL for each brand. If you cannot find an official website, clearly state that and provide any relevant information you found. make sure that the output you produce is valid json.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 1000,
                usage: {
                    include: true  // Enable usage tracking
                }
            }),
            signal: AbortSignal.timeout(CONFIG.TIMEOUT)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }
        
        const responseData = await response.json();
        
        // Track token usage if available
        if (responseData.usage) {
            this.tokenUsage.totalPromptTokens += responseData.usage.prompt_tokens || 0;
            this.tokenUsage.totalCompletionTokens += responseData.usage.completion_tokens || 0;
            this.tokenUsage.totalTokens += responseData.usage.total_tokens || 0;
            this.tokenUsage.totalCost += responseData.usage.cost || 0;
            this.tokenUsage.requestCount += 1;
        }
        
        return responseData;
    }
    
    async findBrandWebsite(brandName) {
        const prompt = `Find the official website URL for the knife/blade brand "${brandName}". 
        
Please provide:
1. The official website URL (if found)
2. A brief description of the brand

please verify the website url is official and not a fan site or a reseller site. 
Also make sure that the website is for a knife or blade brand.

Format your response as JSON with the following structure:
{
    "brand_name": "${brandName}",
    "website_url": "official website URL or null if not found",
    "description": "brief description of the brand",
    "additional_info": {
        "founded": "year or null",
        "location": "country/region or null",
        "specialties": "what they're known for or null"
    },
    "search_confidence": "high/medium/low",
    "notes": "any additional notes or null"
}`;
        
        try {
            console.log(`🔍 Searching for ${brandName} using ${this.modelKey}...`);
            
            // Track tokens before request
            const tokensBefore = {
                prompt: this.tokenUsage.totalPromptTokens,
                completion: this.tokenUsage.totalCompletionTokens,
                total: this.tokenUsage.totalTokens,
                cost: this.tokenUsage.totalCost
            };
            
            const response = await this.makeOpenRouterRequest(prompt);
            const content = response.choices[0]?.message?.content;
            
            // Calculate tokens used for this brand
            const tokensUsed = {
                prompt_tokens: this.tokenUsage.totalPromptTokens - tokensBefore.prompt,
                completion_tokens: this.tokenUsage.totalCompletionTokens - tokensBefore.completion,
                total_tokens: this.tokenUsage.totalTokens - tokensBefore.total,
                cost: this.tokenUsage.totalCost - tokensBefore.cost
            };
            
            // Store per-brand token usage
            this.tokenUsage.brandTokens.push({
                brand_name: brandName,
                ...tokensUsed
            });
            
            if (!content) {
                throw new Error('No content in response from model');
            }
            
            // Try to extract JSON from the response
            let jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const brandData = JSON.parse(jsonMatch[0]);
                    brandData.model_used = this.modelKey;
                    brandData.timestamp = new Date().toISOString();
                    brandData.raw_response = content;
                    brandData.error_type = null;
                    brandData.success = true;
                    brandData.token_usage = tokensUsed; // Add token usage to result
                    return brandData;
                } catch (parseError) {
                    console.warn(`⚠️  JSON parse error for ${brandName}:`, parseError.message);
                    // Continue to fallback below
                }
            }
            
            // Fallback: create structured data from unstructured response
            console.warn(`⚠️  Could not parse JSON response for ${brandName}, using fallback`);
            return {
                brand_name: brandName,
                website_url: null,
                description: content.substring(0, 200) + '...',
                additional_info: {
                    founded: null,
                    location: null,
                    specialties: null
                },
                search_confidence: 'low',
                notes: 'Could not parse structured response from model',
                model_used: this.modelKey,
                timestamp: new Date().toISOString(),
                raw_response: content,
                error_type: 'parse_error',
                success: false,
                token_usage: tokensUsed
            };
            
        } catch (error) {
            console.error(`❌ Error searching for ${brandName}:`, error.message);
            
            // Determine error type for better reporting
            let errorType = 'unknown_error';
            if (error.message.includes('OpenRouter API error')) {
                errorType = 'api_error';
            } else if (error.message.includes('timeout') || error.message.includes('network')) {
                errorType = 'network_error';
            } else if (error.message.includes('No content in response')) {
                errorType = 'model_error';
            } else if (error.message.includes('fetch')) {
                errorType = 'connection_error';
            }
            
            return {
                brand_name: brandName,
                website_url: null,
                description: null,
                additional_info: {
                    founded: null,
                    location: null,
                    specialties: null
                },
                search_confidence: 'low',
                notes: `${errorType.replace('_', ' ').toUpperCase()}: ${error.message}`,
                model_used: this.modelKey,
                timestamp: new Date().toISOString(),
                raw_response: null,
                error_type: errorType,
                success: false,
                token_usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                    cost: 0
                }
            };
        }
    }
    
    async processBrands(brands, startIndex = 0, count = CONFIG.INITIAL_BRAND_COUNT) {
        const brandsToProcess = brands.slice(startIndex, startIndex + count);
        const results = [];
        
        // Set global references for graceful shutdown
        currentResults = results;
        currentFinder = this;
        
        console.log(`🚀 Processing ${brandsToProcess.length} brands using model: ${this.modelKey}`);
        console.log(`📋 Brands: ${brandsToProcess.join(', ')}`);
        
        for (let i = 0; i < brandsToProcess.length; i++) {
            // Check if we're shutting down
            if (isShuttingDown) {
                console.log(`\n⚠️  Shutdown requested. Stopping after ${i} brands.`);
                break;
            }
            
            const brand = brandsToProcess[i];
            console.log(`\n[${i + 1}/${brandsToProcess.length}] Processing: ${brand}`);
            
            const result = await this.findBrandWebsite(brand);
            results.push(result);
            
            // Update global results for potential shutdown
            currentResults = [...results];
            
            // Add a small delay to be respectful to the API (and allow for interruption)
            if (i < brandsToProcess.length - 1 && !isShuttingDown) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }
    
    saveResults(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeModelKey = this.modelKey.replace(/[\/\\:*?"<>|]/g, '_'); // Replace filesystem-unsafe characters
        const filename = `brand_websites_${safeModelKey}_${timestamp}.json`;
        const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
        
        // Calculate detailed statistics
        const successful = results.filter(r => r.success === true);
        const failed = results.filter(r => r.success === false);
        const errorTypes = {};
        
        failed.forEach(result => {
            const errorType = result.error_type || 'unknown';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        });
        
        // Calculate cost estimates (approximate USD conversion)
        const estimatedCostUSD = this.tokenUsage.totalCost * 0.000001; // Credits are typically in micro-dollars
        
        const output = {
            metadata: {
                model_used: this.modelKey,
                model_name: this.modelName,
                timestamp: new Date().toISOString(),
                total_brands_processed: results.length,
                successful_searches: successful.length,
                failed_searches: failed.length,
                success_rate: `${((successful.length / results.length) * 100).toFixed(1)}%`,
                error_breakdown: errorTypes,
                model_availability: failed.filter(r => r.error_type === 'model_error' || r.error_type === 'api_error').length === 0 ? 'working' : 'issues_detected',
                token_usage: {
                    total_prompt_tokens: this.tokenUsage.totalPromptTokens,
                    total_completion_tokens: this.tokenUsage.totalCompletionTokens,
                    total_tokens: this.tokenUsage.totalTokens,
                    total_cost_credits: this.tokenUsage.totalCost,
                    estimated_cost_usd: parseFloat(estimatedCostUSD.toFixed(6)),
                    average_tokens_per_brand: Math.round(this.tokenUsage.totalTokens / Math.max(this.tokenUsage.requestCount, 1)),
                    average_cost_per_brand: parseFloat((this.tokenUsage.totalCost / Math.max(this.tokenUsage.requestCount, 1)).toFixed(2)),
                    total_requests: this.tokenUsage.requestCount,
                    per_brand_breakdown: this.tokenUsage.brandTokens
                }
            },
            results: results
        };
        
        fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
        console.log(`\n💾 Results saved to: ${filepath}`);
        
        return filepath;
    }
    
    printSummary(results) {
        const successful = results.filter(r => r.success === true);
        const failed = results.filter(r => r.success === false);
        const errorTypes = {};
        
        failed.forEach(result => {
            const errorType = result.error_type || 'unknown';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
        });
        
        console.log('\n📊 SUMMARY');
        console.log('='.repeat(50));
        console.log(`Model used: ${this.modelKey}`);
        console.log(`Total brands processed: ${results.length}`);
        console.log(`Successful searches: ${successful.length}`);
        console.log(`Failed searches: ${failed.length}`);
        console.log(`Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
        
        // Token usage summary
        if (this.tokenUsage && this.tokenUsage.requestCount > 0) {
            const estimatedCostUSD = this.tokenUsage.totalCost * 0.000001;
            console.log('\n🔢 TOKEN USAGE');
            console.log('-'.repeat(30));
            console.log(`Total tokens: ${this.tokenUsage.totalTokens.toLocaleString()}`);
            console.log(`  • Prompt tokens: ${this.tokenUsage.totalPromptTokens.toLocaleString()}`);
            console.log(`  • Completion tokens: ${this.tokenUsage.totalCompletionTokens.toLocaleString()}`);
            console.log(`Total cost: ${this.tokenUsage.totalCost.toLocaleString()} credits (~$${estimatedCostUSD.toFixed(6)})`);
            console.log(`Average per brand: ${Math.round(this.tokenUsage.totalTokens / this.tokenUsage.requestCount)} tokens`);
            console.log(`Average cost per brand: ${(this.tokenUsage.totalCost / this.tokenUsage.requestCount).toFixed(2)} credits`);
            console.log(`Total API requests: ${this.tokenUsage.requestCount}`);
        }
        
        // Model health check
        const modelErrors = failed.filter(r => r.error_type === 'model_error' || r.error_type === 'api_error');
        if (modelErrors.length > 0) {
            console.log(`\n⚠️  MODEL ISSUES DETECTED:`);
            console.log(`   Model/API errors: ${modelErrors.length}`);
            console.log(`   This may indicate the model is not working properly`);
        } else {
            console.log(`\n✅ MODEL STATUS: Working properly`);
        }
        
        // Error breakdown
        if (Object.keys(errorTypes).length > 0) {
            console.log('\n🔍 ERROR BREAKDOWN:');
            Object.entries(errorTypes).forEach(([errorType, count]) => {
                const description = {
                    'api_error': 'OpenRouter API returned an error',
                    'model_error': 'Model failed to provide content',
                    'network_error': 'Network/timeout issues',
                    'connection_error': 'Connection problems',
                    'parse_error': 'Could not parse model response',
                    'unknown_error': 'Unclassified error'
                };
                console.log(`  • ${errorType.replace('_', ' ')}: ${count} (${description[errorType] || 'Unknown error type'})`);
            });
        }
        
        console.log('\n🎯 SUCCESSFUL FINDS:');
        if (successful.length > 0) {
            successful.forEach(result => {
                const tokens = result.token_usage ? ` (${result.token_usage.total_tokens} tokens)` : '';
                console.log(`  • ${result.brand_name}: ${result.website_url}${tokens}`);
            });
        } else {
            console.log('  None found');
        }
        
        console.log('\n❌ FAILED SEARCHES:');
        if (failed.length > 0) {
            failed.forEach(result => {
                const tokens = result.token_usage ? ` (${result.token_usage.total_tokens} tokens)` : '';
                console.log(`  • ${result.brand_name}: ${result.notes || 'No website found'}${tokens}`);
            });
        } else {
            console.log('  None');
        }
        
        // Recommendations
        if (failed.length > successful.length) {
            console.log('\n💡 RECOMMENDATIONS:');
            if (modelErrors.length > 0) {
                console.log('  • Try a different model - this one may be experiencing issues');
                console.log('  • Check your OpenRouter API key and account status');
            }
            if (errorTypes.network_error > 0) {
                console.log('  • Check your internet connection');
                console.log('  • Consider increasing timeout or adding retry logic');
            }
            if (errorTypes.parse_error > 0) {
                console.log('  • The model may not be following instructions well');
                console.log('  • Try a more capable model like gpt-4o or claude-3.5-sonnet');
            }
        }
    }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
        if (isShuttingDown) {
            console.log('\n🚨 Force terminating...');
            process.exit(1);
        }
        
        isShuttingDown = true;
        console.log(`\n\n⚠️  Received ${signal}. Gracefully shutting down...`);
        console.log('📝 Saving partial results...');
        
        if (currentFinder && currentResults.length > 0) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const safeModelKey = currentFinder.modelKey.replace(/[\/\\:*?"<>|]/g, '_');
                const filename = `brand_websites_${safeModelKey}_PARTIAL_${timestamp}.json`;
                const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
                
                const successful = currentResults.filter(r => r.success === true);
                const failed = currentResults.filter(r => r.success === false);
                const errorTypes = {};
                
                failed.forEach(result => {
                    const errorType = result.error_type || 'unknown';
                    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
                });
                
                const output = {
                    metadata: {
                        model_used: currentFinder.modelKey,
                        model_name: currentFinder.modelName,
                        timestamp: new Date().toISOString(),
                        total_brands_processed: currentResults.length,
                        successful_searches: successful.length,
                        failed_searches: failed.length,
                        success_rate: `${((successful.length / currentResults.length) * 100).toFixed(1)}%`,
                        error_breakdown: errorTypes,
                        model_availability: failed.filter(r => r.error_type === 'model_error' || r.error_type === 'api_error').length === 0 ? 'working' : 'issues_detected',
                        status: 'PARTIAL_RESULTS_DUE_TO_INTERRUPTION',
                        token_usage: currentFinder.tokenUsage ? {
                            total_prompt_tokens: currentFinder.tokenUsage.totalPromptTokens,
                            total_completion_tokens: currentFinder.tokenUsage.totalCompletionTokens,
                            total_tokens: currentFinder.tokenUsage.totalTokens,
                            total_cost_credits: currentFinder.tokenUsage.totalCost,
                            estimated_cost_usd: parseFloat((currentFinder.tokenUsage.totalCost * 0.000001).toFixed(6)),
                            average_tokens_per_brand: Math.round(currentFinder.tokenUsage.totalTokens / Math.max(currentFinder.tokenUsage.requestCount, 1)),
                            average_cost_per_brand: parseFloat((currentFinder.tokenUsage.totalCost / Math.max(currentFinder.tokenUsage.requestCount, 1)).toFixed(2)),
                            total_requests: currentFinder.tokenUsage.requestCount,
                            per_brand_breakdown: currentFinder.tokenUsage.brandTokens
                        } : null
                    },
                    results: currentResults
                };
                
                fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
                console.log(`💾 Partial results saved to: ${filepath}`);
                
                // Print summary of what was completed
                console.log(`\n📊 PARTIAL SUMMARY (${currentResults.length} brands processed)`);
                console.log(`✅ Successful: ${successful.length}`);
                console.log(`❌ Failed: ${failed.length}`);
                
            } catch (error) {
                console.error('❌ Error saving partial results:', error.message);
            }
        } else {
            console.log('📝 No results to save');
        }
        
        console.log('\n👋 Goodbye!');
        process.exit(0);
    };
    
    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
    
    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle process exit
    process.on('exit', (code) => {
        if (!isShuttingDown && code !== 0) {
            console.log(`\n⚠️  Process exiting with code ${code}`);
        }
    });
    
    console.log('🛡️  Press Ctrl+C to gracefully stop and save partial results');
}

async function main() {
    try {
        // Set up graceful shutdown handling
        setupGracefulShutdown();
        
        // Load brand names
        let brandData;
        try {
            brandData = JSON.parse(fs.readFileSync('brandNames.json', 'utf8'));
        } catch (error) {
            console.error('❌ Error loading brandNames.json:', error.message);
            console.log('💡 Make sure brandNames.json exists in the current directory');
            process.exit(1);
        }
        
        // Get command line arguments
        const args = process.argv.slice(2);
        const modelKey = args[0] || CONFIG.DEFAULT_MODEL;
        const count = parseInt(args[1]) || CONFIG.INITIAL_BRAND_COUNT;
        const startIndex = parseInt(args[2]) || 0;
        
        // Check for force flag
        const forceRun = args.includes('--force') || args.includes('-f');
        const showExisting = args.includes('--show') || args.includes('-s');
        
        console.log('🔧 CONFIGURATION');
        console.log(`Model: ${modelKey}`);
        console.log(`Brands to process: ${count}`);
        console.log(`Starting from index: ${startIndex}`);
        if (forceRun) console.log('🔄 Force mode: Will run even if results exist');
        if (showExisting) console.log('👁️  Show mode: Will display existing results');
        console.log(`Available models: ${Object.keys(CONFIG.MODELS).join(', ')}`);
        
        // Initialize the finder
        let finder;
        try {
            finder = new BrandWebsiteFinder(modelKey);
        } catch (error) {
            // If we're just showing existing results, we don't need a valid API key
            if (showExisting && error.message.includes('OPENROUTER_API_KEY')) {
                // Create a minimal finder just for checking existing results
                finder = {
                    modelKey: modelKey,
                    checkExistingResults: function(count) {
                        try {
                            const safeModelKey = this.modelKey.replace(/[\/\\:*?"<>|]/g, '_');
                            const files = fs.readdirSync(CONFIG.OUTPUT_DIR)
                                .filter(file => file.startsWith(`brand_websites_${safeModelKey}_`) && file.endsWith('.json'))
                                .filter(file => !file.includes('_PARTIAL_'));
                            
                            if (files.length === 0) {
                                return { hasResults: false, message: `No existing results found for ${this.modelKey}` };
                            }
                            
                            // Find the file with the most successful entries
                            let bestFile = null;
                            let bestSuccessCount = 0;
                            let bestData = null;
                            
                            for (const file of files) {
                                try {
                                    const filepath = path.join(CONFIG.OUTPUT_DIR, file);
                                    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                                    const successful = data.results.filter(r => r.success === true && r.website_url);
                                    
                                    if (successful.length > bestSuccessCount) {
                                        bestSuccessCount = successful.length;
                                        bestFile = file;
                                        bestData = data;
                                    }
                                } catch (error) {
                                    console.warn(`⚠️  Error reading ${file}: ${error.message}`);
                                    continue;
                                }
                            }
                            
                            if (!bestFile) {
                                return { hasResults: false, message: `No valid results files found for ${this.modelKey}` };
                            }
                            
                            const filepath = path.join(CONFIG.OUTPUT_DIR, bestFile);
                            console.log(`🔍 Checking existing results: ${bestFile}`);
                            
                            const successful = bestData.results.filter(r => r.success === true && r.website_url);
                            const total = bestData.results.length;
                            
                            return {
                                hasResults: true,
                                message: `Found existing results with ${successful.length} successful entries (${total} total)`,
                                filepath: filepath,
                                successfulCount: successful.length,
                                totalCount: total,
                                data: bestData
                            };
                            
                        } catch (error) {
                            return { hasResults: false, message: 'Error reading existing results' };
                        }
                    },
                    printSummary: function(results) {
                        const successful = results.filter(r => r.success === true);
                        const failed = results.filter(r => r.success === false);
                        const errorTypes = {};
                        
                        failed.forEach(result => {
                            const errorType = result.error_type || 'unknown';
                            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
                        });
                        
                        console.log('\n📊 SUMMARY');
                        console.log('='.repeat(50));
                        console.log(`Model used: ${this.modelKey}`);
                        console.log(`Total brands processed: ${results.length}`);
                        console.log(`Successful searches: ${successful.length}`);
                        console.log(`Failed searches: ${failed.length}`);
                        console.log(`Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
                        
                        if (Object.keys(errorTypes).length > 0) {
                            console.log('\n🔍 ERROR BREAKDOWN:');
                            Object.entries(errorTypes).forEach(([errorType, count]) => {
                                const description = {
                                    'api_error': 'OpenRouter API returned an error',
                                    'model_error': 'Model failed to provide content',
                                    'network_error': 'Network/timeout issues',
                                    'connection_error': 'Connection problems',
                                    'parse_error': 'Could not parse model response',
                                    'unknown_error': 'Unclassified error'
                                };
                                console.log(`  • ${errorType.replace('_', ' ')}: ${count} (${description[errorType] || 'Unknown error type'})`);
                            });
                        }
                        
                        console.log('\n🎯 SUCCESSFUL FINDS:');
                        if (successful.length > 0) {
                            successful.forEach(result => {
                                const tokens = result.token_usage ? ` (${result.token_usage.total_tokens} tokens)` : '';
                                console.log(`  • ${result.brand_name}: ${result.website_url}${tokens}`);
                            });
                        } else {
                            console.log('  None found');
                        }
                        
                        console.log('\n❌ FAILED SEARCHES:');
                        if (failed.length > 0) {
                            failed.forEach(result => {
                                const tokens = result.token_usage ? ` (${result.token_usage.total_tokens} tokens)` : '';
                                console.log(`  • ${result.brand_name}: ${result.notes || 'No website found'}${tokens}`);
                            });
                        } else {
                            console.log('  None');
                        }
                    }
                };
            } else {
                console.error('❌ Initialization error:', error.message);
                if (error.message.includes('OPENROUTER_API_KEY')) {
                    console.log('💡 Set your OpenRouter API key: export OPENROUTER_API_KEY=your_key_here');
                } else if (error.message.includes('Model')) {
                    console.log(`💡 Available models: ${Object.keys(CONFIG.MODELS).join(', ')}`);
                }
                process.exit(1);
            }
        }
        
        // Validate brand data
        if (!Array.isArray(brandData) || brandData.length === 0) {
            console.error('❌ Invalid brand data: brandNames.json should contain an array of brand names');
            process.exit(1);
        }
        
        if (startIndex >= brandData.length) {
            console.error(`❌ Start index ${startIndex} is beyond the available brands (${brandData.length})`);
            process.exit(1);
        }
        
        // Check for existing results (unless forced or showing)
        if (!forceRun) {
            console.log('\n🔍 Checking for existing results...');
            const existingCheck = finder.checkExistingResults(count);
            console.log(`📋 ${existingCheck.message}`);
            
            if (existingCheck.hasResults) {
                if (showExisting) {
                    // Show existing results and exit
                    console.log('\n📊 EXISTING RESULTS SUMMARY');
                    console.log('='.repeat(50));
                    
                    // Display token usage if available
                    if (existingCheck.data.metadata && existingCheck.data.metadata.token_usage) {
                        const tokenUsage = existingCheck.data.metadata.token_usage;
                        console.log('\n🔢 TOKEN USAGE (from previous run)');
                        console.log('-'.repeat(30));
                        console.log(`Total tokens: ${tokenUsage.total_tokens?.toLocaleString() || 'N/A'}`);
                        console.log(`  • Prompt tokens: ${tokenUsage.total_prompt_tokens?.toLocaleString() || 'N/A'}`);
                        console.log(`  • Completion tokens: ${tokenUsage.total_completion_tokens?.toLocaleString() || 'N/A'}`);
                        console.log(`Total cost: ${tokenUsage.total_cost_credits?.toLocaleString() || 'N/A'} credits (~$${tokenUsage.estimated_cost_usd || 'N/A'})`);
                        console.log(`Average per brand: ${tokenUsage.average_tokens_per_brand || 'N/A'} tokens`);
                        console.log(`Average cost per brand: ${tokenUsage.average_cost_per_brand || 'N/A'} credits`);
                        console.log(`Total API requests: ${tokenUsage.total_requests || 'N/A'}`);
                    }
                    
                    finder.printSummary(existingCheck.data.results);
                    console.log(`\n📁 Results file: ${existingCheck.filepath}`);
                    process.exit(0);
                } else {
                    // Ask user what to do
                    console.log('\n✅ Sufficient results already exist!');
                    console.log('💡 Options:');
                    console.log('   • Run with --force to process anyway');
                    console.log('   • Run with --show to view existing results');
                    console.log('   • Use a different model');
                    console.log('   • Increase the count to process more brands');
                    console.log(`\n📁 Existing results: ${existingCheck.filepath}`);
                    process.exit(0);
                }
            } else if (showExisting) {
                // No existing results to show
                console.log('\n❌ No existing results found to display');
                console.log('💡 Run without --show to process new brands');
                process.exit(0);
            }
        }
        
        // Process brands
        console.log(`\n🚀 Starting brand website search...`);
        const results = await finder.processBrands(brandData, startIndex, count);
        
        // Check if we were interrupted
        if (isShuttingDown) {
            // Graceful shutdown already handled the saving and summary
            return;
        }
        
        // Save and display results (normal completion)
        const filepath = finder.saveResults(results);
        finder.printSummary(results);
        
        // Final status
        const successful = results.filter(r => r.success === true);
        const failed = results.filter(r => r.success === false);
        
        if (failed.length === results.length) {
            console.log('\n🚨 ALL SEARCHES FAILED - This indicates a serious issue with the model or API');
            process.exit(1);
        } else if (failed.length > successful.length) {
            console.log('\n⚠️  More searches failed than succeeded - Consider investigating');
            process.exit(0);
        } else {
            console.log('\n✅ Search completed successfully');
            process.exit(0);
        }
        
    } catch (error) {
        if (isShuttingDown) {
            return; // Don't show error if we're already shutting down gracefully
        }
        console.error('❌ Fatal error:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Export for use as module
module.exports = { BrandWebsiteFinder, CONFIG };

// Run if called directly
if (require.main === module) {
    main();
}
