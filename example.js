#!/usr/bin/env node

const { BrandWebsiteFinder, CONFIG } = require('./getBrandWebsite.js');
const fs = require('fs');

async function runExample() {
    console.log('🚀 Knife Brand Website Finder - Example Usage\n');
    
    // Check if API key is set
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('❌ Please set OPENROUTER_API_KEY environment variable');
        console.log('   export OPENROUTER_API_KEY="your-api-key-here"');
        process.exit(1);
    }
    
    try {
        // Load brand names
        const brandData = JSON.parse(fs.readFileSync('brandNames.json', 'utf8'));
        console.log(`📋 Loaded ${brandData.length} knife brands from brandNames.json\n`);
        
        // Example 1: Test with a fast, cheap model (3 brands)
        console.log('🔍 Example 1: Testing with Claude 3 Haiku (fast & cheap)');
        console.log('Processing first 3 brands...\n');
        
        const finder1 = new BrandWebsiteFinder('claude-3-haiku');
        const results1 = await finder1.processBrands(brandData, 0, 3);
        const filepath1 = finder1.saveResults(results1);
        finder1.printSummary(results1);
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Example 2: Test with a more capable model (2 brands)
        console.log('🔍 Example 2: Testing with GPT-4o Mini (balanced)');
        console.log('Processing brands 3-4...\n');
        
        const finder2 = new BrandWebsiteFinder('gpt-4o-mini');
        const results2 = await finder2.processBrands(brandData, 3, 2);
        const filepath2 = finder2.saveResults(results2);
        finder2.printSummary(results2);
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Example 3: Compare results
        console.log('📊 COMPARISON SUMMARY');
        console.log(`Claude 3 Haiku: ${results1.filter(r => r.website_url).length}/${results1.length} successful`);
        console.log(`GPT-4o Mini: ${results2.filter(r => r.website_url).length}/${results2.length} successful`);
        
        console.log('\n📁 Results saved to:');
        console.log(`  • ${filepath1}`);
        console.log(`  • ${filepath2}`);
        
        console.log('\n✅ Example completed successfully!');
        console.log('\n💡 To run with different models:');
        console.log('   node getBrandWebsite.js claude-3.5-sonnet 5');
        console.log('   node getBrandWebsite.js gemini-2.5-pro 10 20');
        console.log('   node getBrandWebsite.js gpt-4o 3');
        
    } catch (error) {
        console.error('❌ Example failed:', error.message);
        process.exit(1);
    }
}

// Run the example
if (require.main === module) {
    runExample();
} 